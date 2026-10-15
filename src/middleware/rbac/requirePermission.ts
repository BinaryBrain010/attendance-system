import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import prisma from "../../core/models/base.model";
import AccessService from "../../modules/rbac/Access/service/access.service";
import logger from "../../core/logger/logger";

/**
 * Server-side permission enforcement.
 *   RBAC_ENFORCE = off  -> middleware is a no-op (default; prod stays here until rollout)
 *                  log  -> evaluate and LOG would-be denials, but allow the request
 *                  on   -> deny (403) on failure
 *
 * Decision uses the same union resolver the app already uses (AccessService), and the parent rule:
 * holding a parent feature (e.g. voucher.*) grants all descendants (voucher.read.*, voucher.post.*).
 * Route -> feature mapping is generated into featureMap.json. An unmapped route is DENIED under "on".
 */

const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
const MAP: Record<string, { access: string; feature: string; kind: string }> =
  JSON.parse(fs.readFileSync(path.join(__dirname, "featureMap.json"), "utf8"));
const accessService = new AccessService();
const PARENT_FEATURE: Record<string, string> = { User: "user", Role: "role", Group: "group" };
const LOG_FILE = path.join(__dirname, "..", "..", "..", "logs", "rbac_denials.log");

function mode(): "off" | "log" | "on" {
  const m = (process.env.RBAC_ENFORCE || "off").toLowerCase();
  return m === "on" ? "on" : m === "log" ? "log" : "off";
}

function logDenial(info: Record<string, any>) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...info }) + "\n");
  } catch { /* logging must never break the request */ }
}

// ancestors of "a.b.c.*" -> ["a.*","a.b.*"]
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

// per-request cache of the caller's effective feature set
async function permSet(req: any, userId: string): Promise<Set<string>> {
  if (req._permSet) return req._permSet;
  const feats = await accessService.getAllowedFeaturesForUser(userId);
  const s = new Set<string>(Array.isArray(feats) ? feats : []);
  req._permSet = s;
  return s;
}

async function callerEmployeeId(userId: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    return (u && (u as any).employeeId) || null;
  } catch { return null; }
}

export default async function requirePermission(req: Request, res: Response, next: NextFunction) {
  const m = mode();
  if (m === "off") return next();

  const userId = (req as Request & { userId?: string }).userId || "";
  const fullPath = (req.baseUrl + (req.path || "")).replace(/\/+$/, "") || "/";
  const key = `${req.method} ${fullPath}`;
  const entry = MAP[key];

  const deny = (reason: string) => {
    logDenial({ userId, route: key, reason, mode: m });
    if (m === "on") return res.status(403).json({ success: false, message: `Forbidden: ${reason}` });
    return next(); // log mode: allow but recorded
  };

  try {
    if (userId === GOD_ID) return next();           // god bypass
    if (!entry) return deny("unmapped route");
    const { access, feature } = entry;

    if (access === "open" || access === "token") return next();
    if (access === "god") return deny("god-only route");

    if (access === "self") {
      const body: any = req.body || {};
      const query: any = req.query || {};
      const reqEmp = body.employeeId ?? query.employeeId ?? null;
      const reqUser = body.userId ?? query.userId ?? null;
      if (reqEmp === null && reqUser === null) return next();   // no target -> the caller's own record
      if (reqUser !== null && String(reqUser) === String(userId)) return next(); // own user account
      if (reqEmp !== null) {
        const ownEmp = await callerEmployeeId(userId);
        if (ownEmp && String(ownEmp) === String(reqEmp)) return next();           // own employee
      }
      const s = await permSet(req, userId);
      if (holds(s, feature)) return next();          // acting on another employee/user needs the feature
      return deny(`self: not own and missing ${feature}`);
    }

    if (access === "dynamic") {
      // featurePermission.* : parentType from the EXISTING row for update/delete/restore, body for create
      const body: any = req.body || {};
      let parentType: string | undefined;
      // create and the read-only allowedFeatures endpoint both carry parentType in the body;
      // update/delete/restore only carry the row id, so the parentType is read from the row.
      if (/(\/create|\/allowedFeatures)$/i.test(key)) parentType = body.parentType;
      else if (body.id) {
        const row = await prisma.featurePermission.findUnique({ where: { id: String(body.id) }, select: { parentType: true } });
        parentType = row ? (row as any).parentType : undefined;
      }
      if (!parentType || !PARENT_FEATURE[parentType]) return deny("dynamic: parentType is not Role/User/Group");
      const isRead = /(\/get|allowedFeatures)$/i.test(key);
      const f = `${PARENT_FEATURE[parentType]}.${isRead ? "read" : "update"}.*`;
      const s = await permSet(req, userId);
      if (holds(s, f)) return next();
      return deny(`dynamic: missing ${f}`);
    }

    // access === "feature"
    const s = await permSet(req, userId);
    if (holds(s, feature)) return next();
    return deny(`missing ${feature}`);
  } catch (e: any) {
    logger.error(`requirePermission error on ${key}: ${e?.message}`);
    if (m === "on") return res.status(403).json({ success: false, message: "Forbidden: permission check error" });
    return next();
  }
}
