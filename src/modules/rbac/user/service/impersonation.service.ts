/**
 * Impersonation ("login as user"). An admin holding `user.impersonate.*` can obtain a short-lived
 * (30 min, no refresh) token for another user to see the app exactly as they do. The token carries
 * `userId = target` (so scope/data behave as the target) plus `impersonatorId` + `impersonationId`
 * claims used for audit attribution and for blocking sensitive actions. The admin keeps their own
 * session client-side and can Exit at any time.
 */
import prisma from "../../../../core/models/base.model";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { secretKey } from "../../../../environment/environment";
import AccessService from "../../Access/service/access.service";
import { logEvent } from "../../../../core/audit/event";
import { AppError, NotFoundError } from "../../../../core/errors/app.error";
import { SYSTEM_USER_ID, SYSTEM_USERNAME } from "../../../../core/context/requestContext";

// The hardcoded god account (see requirePermission.ts / staticData.ts) — never impersonable.
const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
const IMPERSONATE_FEATURE = "user.impersonate.*";
const TOKEN_TTL = "30m";

// Parent-wildcard rule, mirrored from requirePermission.ts: holding "a.*"/"a.b.*" grants "a.b.c.*".
function ancestorsOf(f: string): string[] {
  if (!f.endsWith(".*")) return [];
  const segs = f.slice(0, -2).split(".");
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}
function holds(set: Set<string>, f: string): boolean {
  if (!f || f.startsWith("(")) return false;
  if (set.has(f)) return true;
  for (const a of ancestorsOf(f)) if (set.has(a)) return true;
  return false;
}

/** Does the caller effectively hold feature `f`? Like `holds`, but also honours CRM/Work read-scope
 *  widening: a caller with `x.read.all.*` (or `.team.*`) covers a target's narrower `x.read.own.*`. */
function callerCovers(set: Set<string>, f: string): boolean {
  if (holds(set, f)) return true;
  const m = f.match(/^(.*\.read)\.(own|team|all)\.\*$/);
  if (m) {
    const base = m[1];
    const scope = m[2];
    if (holds(set, `${base}.*`)) return true; // read.* grants any scope
    const wider = scope === "own" ? ["team", "all"] : scope === "team" ? ["all"] : [];
    for (const w of wider) if (holds(set, `${base}.${w}.*`)) return true;
  }
  return false;
}

export interface ImpersonationMeta {
  ip?: string | null;
  userAgent?: string | null;
  alreadyImpersonating?: boolean; // the caller's own request is itself an impersonation (no nesting)
}

export interface ImpersonationResult {
  token: string;
  impersonationId: string;
  expiresAt: string | null;
  target: { id: string; username: string };
  impersonator: { id: string; username: string };
}

class ImpersonationService {
  private access = new AccessService();

  /** Validate, open a session, and mint the impersonation token. */
  async start(callerId: string, targetUserId: string, reason: string, meta: ImpersonationMeta): Promise<ImpersonationResult> {
    if (!callerId) throw new AppError(401, "Unauthorized");
    if (meta.alreadyImpersonating) throw new AppError(409, "You are already impersonating a user. Exit first.");
    const cleanReason = (reason || "").trim();
    if (cleanReason.length < 3) throw new AppError(400, "A reason (at least 3 characters) is required to log in as a user.");
    if (!targetUserId) throw new AppError(400, "A target user is required.");
    if (targetUserId === callerId) throw new AppError(400, "You cannot impersonate yourself.");
    if (targetUserId === GOD_ID) throw new AppError(403, "This account cannot be impersonated.");
    if (targetUserId === SYSTEM_USER_ID) throw new AppError(403, "The System user cannot be impersonated.");

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, isDeleted: null },
      select: { id: true, username: true, employeeId: true },
    });
    if (!target) throw new NotFoundError("User");
    if (target.username === SYSTEM_USERNAME) throw new AppError(403, "The System user cannot be impersonated.");

    // Privilege checks: the target must not be able to impersonate, and must not hold any permission
    // the caller lacks (so impersonation can never be used to escalate).
    const [callerFeats, targetFeats] = await Promise.all([
      this.access.getAllowedFeaturesForUser(callerId),
      this.access.getAllowedFeaturesForUser(targetUserId),
    ]);
    const callerSet = new Set<string>(Array.isArray(callerFeats) ? callerFeats : []);
    const targetSet = new Set<string>(Array.isArray(targetFeats) ? targetFeats : []);
    if (holds(targetSet, IMPERSONATE_FEATURE)) {
      throw new AppError(403, "You cannot impersonate a user who can themselves impersonate.");
    }
    for (const f of targetSet) {
      if (!callerCovers(callerSet, f)) {
        throw new AppError(403, "You cannot impersonate a user who has permissions you do not have.");
      }
    }

    const unitIds = await this.unitIdsFor(target.employeeId);

    const session = await prisma.impersonationSession.create({
      data: {
        impersonatorId: callerId,
        targetUserId,
        reason: cleanReason,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    const token = jwt.sign(
      { userId: targetUserId, unitIds, jti: randomUUID(), impersonatorId: callerId, impersonationId: session.id, platform: "Admin" },
      secretKey,
      { expiresIn: TOKEN_TTL },
    );
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    const caller = await prisma.user.findUnique({ where: { id: callerId }, select: { username: true } });

    await logEvent({
      module: "RBAC",
      entity: "ImpersonationSession",
      entityId: session.id,
      action: "IMPERSONATE_START",
      changes: { reason: cleanReason, target: target.username, by: caller?.username ?? null },
      userId: targetUserId,              // the acting identity
      impersonatorId: callerId,          // the real admin
      impersonationId: session.id,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      platform: "Admin",
    });

    return {
      token,
      impersonationId: session.id,
      expiresAt,
      target: { id: target.id, username: target.username },
      impersonator: { id: callerId, username: caller?.username ?? "admin" },
    };
  }

  /** End an impersonation session (Exit). `impersonationId` comes from the token claim, so only the
   *  live impersonation session can close itself. Idempotent. */
  async end(impersonationId: string, meta: ImpersonationMeta): Promise<{ ok: true }> {
    if (!impersonationId) throw new AppError(400, "No active impersonation session.");
    const session = await prisma.impersonationSession.findUnique({ where: { id: impersonationId } });
    if (!session) throw new NotFoundError("ImpersonationSession");
    if (!session.endedAt) {
      await prisma.impersonationSession.update({ where: { id: impersonationId }, data: { endedAt: new Date() } });
    }
    await logEvent({
      module: "RBAC",
      entity: "ImpersonationSession",
      entityId: impersonationId,
      action: "IMPERSONATE_END",
      changes: { target: session.targetUserId },
      userId: session.targetUserId,
      impersonatorId: session.impersonatorId,
      impersonationId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      platform: "Admin",
    });
    return { ok: true };
  }

  /** The target's unit scope (same sources the login handler uses), so scope behaves as the target. */
  private async unitIdsFor(employeeId: string | null): Promise<string[]> {
    if (!employeeId) return [];
    try {
      const unitEmployeeModel = (await import("../../../AMS/Unit/models/unitEmployee.model")).default;
      const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getUnitsByEmployeeId(employeeId);
      const assigned = unitEmployees ? unitEmployees.map((ue: any) => ue.unitId) : [];
      const managed = await prisma.unit.findMany({ where: { attendanceManagerId: employeeId, isDeleted: null }, select: { id: true } });
      return [...new Set([...assigned, ...managed.map((u: any) => u.id)])];
    } catch (e) {
      console.error("impersonation: unitIds lookup failed:", (e as Error)?.message);
      return [];
    }
  }
}

export default ImpersonationService;
