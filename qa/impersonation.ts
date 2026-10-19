/**
 * Impersonation ("login as user") harness. Local-only. Exercises: allowed/denied guards, blocked
 * actions, own-activity-log hiding vs audit visibility, token expiry, exit, and attendance/mobile
 * rejection. Self-cleaning (all entities under QA_IMP_ prefixes).
 *
 *   (backend up on :3002 with RBAC_ENFORCE=on)
 *   npx ts-node qa/impersonation.ts
 */
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { api, http, mintTokenFor, mintGodToken, BASE, GOD_ID, IS_LOCAL, QA_PASSWORD } from "./lib";
import prisma from "../src/core/models/base.model";

if (!IS_LOCAL) process.exit(2);
const SECRET = process.env.JWT_SECRET!;
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else { fail++; fails.push(`${name} ${extra}`); console.log("  FAIL", name, extra); }
}

const TAG = "QA_IMP_";
const createdFP: string[] = [];
async function grant(userId: string, features: string[]) {
  const row = await prisma.featurePermission.create({
    data: { parentType: "User", parentId: userId, permissions: { allowedFeatures: features } as any, createdAt: new Date() },
  });
  createdFP.push(row.id);
}
let HASH = "";
async function mkUser(slug: string) {
  if (!HASH) HASH = await bcrypt.hash(QA_PASSWORD, 4);
  return prisma.user.create({ data: { username: `${TAG}${slug}@test.local`, password: HASH, createdAt: new Date() } });
}
/** fetch with an optional x-platform header (for the attendance/mobile rejection test). */
async function httpP(method: string, path: string, token: string, platform?: string, body?: any) {
  const headers: any = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  if (platform) headers["x-platform"] = platform;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
}

async function main() {
  console.log("[imp] setup…");
  // boss = admin with impersonate + a broad set (superset of staff).
  const boss = await mkUser("boss");
  await grant(boss.id, ["user.impersonate.*", "user.read.*", "audit.read.*", "crm.lead.read.all.*", "crm.lead.create.*", "activityLog.read.own.*"]);
  // staff = ordinary user (subset of boss).
  const staff = await mkUser("staff");
  await grant(staff.id, ["crm.lead.read.own.*", "crm.lead.create.*", "activityLog.read.own.*"]);
  // peer = also holds impersonate (cannot be impersonated by boss).
  const peer = await mkUser("peer");
  await grant(peer.id, ["user.impersonate.*"]);
  // superUser = holds a feature boss does NOT (cannot be impersonated — would escalate).
  const superUser = await mkUser("super");
  await grant(superUser.id, ["crm.lead.read.own.*", "zzz.secret.feature.*"]);

  const bossTok = mintTokenFor(boss.id);
  const staffTok = mintTokenFor(staff.id);
  const godTok = mintGodToken();

  console.log("[imp] ===== denials =====");
  check("deny self", (await api("POST", "/user/impersonate", bossTok, { userId: boss.id, reason: "testing" })).status === 400);
  check("deny god", (await api("POST", "/user/impersonate", bossTok, { userId: GOD_ID, reason: "testing" })).status === 403);
  check("deny system user", (await api("POST", "/user/impersonate", bossTok, { userId: SYSTEM_USER_ID, reason: "testing" })).status === 403);
  check("deny target-holds-impersonate", (await api("POST", "/user/impersonate", bossTok, { userId: peer.id, reason: "testing" })).status === 403);
  check("deny target-has-more-perms", (await api("POST", "/user/impersonate", bossTok, { userId: superUser.id, reason: "testing" })).status === 403);
  check("deny empty reason", (await api("POST", "/user/impersonate", bossTok, { userId: staff.id, reason: "" })).status === 400);
  check("deny no-impersonate-feature (staff cannot impersonate)", (await api("POST", "/user/impersonate", staffTok, { userId: boss.id, reason: "x" })).status === 403);

  console.log("[imp] ===== allowed start =====");
  const start = await api("POST", "/user/impersonate", bossTok, { userId: staff.id, reason: "help debug staff view" });
  check("start -> 200", start.status === 200, `status ${start.status} ${start.text?.slice(0,120)}`);
  const impToken = start.data?.token as string;
  const impId = start.data?.impersonationId as string;
  check("start returns a token", !!impToken);
  check("start returns impersonationId", !!impId);
  check("token claims: userId=target, impersonatorId=boss", (() => {
    const d: any = jwt.decode(impToken || "");
    return d?.userId === staff.id && d?.impersonatorId === boss.id && d?.impersonationId === impId;
  })());
  // session row
  const sess = impId ? await prisma.impersonationSession.findUnique({ where: { id: impId } }) : null;
  check("ImpersonationSession row created", !!sess && sess.impersonatorId === boss.id && sess.targetUserId === staff.id && !sess.endedAt);
  // IMPERSONATE_START audit event
  const startEvt = await prisma.auditLog.findFirst({ where: { action: "IMPERSONATE_START", impersonationId: impId } });
  check("IMPERSONATE_START event logged (userId=target, impersonatorId=boss)", !!startEvt && startEvt.userId === staff.id && startEvt.impersonatorId === boss.id);

  console.log("[imp] ===== acts as target; createdBy = impersonator =====");
  const lead = await api("POST", "/lead/create", impToken, { customerName: `${TAG}lead`, stage: "NEW", company: "OKASHASMART" });
  const leadRow = Array.isArray(lead.data) ? lead.data[0] : lead.data;
  check("impersonated create lead -> 201", lead.status === 201, `status ${lead.status}`);
  const dbLead = leadRow?.id ? await prisma.lead.findUnique({ where: { id: leadRow.id } }) : null;
  check("lead.createdById = impersonator (boss), not target", !!dbLead && (dbLead as any).createdById === boss.id, `got ${(dbLead as any)?.createdById}`);
  const leadAudit = leadRow?.id ? await prisma.auditLog.findFirst({ where: { entity: "Lead", entityId: leadRow.id, action: "CREATE" } }) : null;
  check("lead CREATE audit: userId=target, impersonatorId=boss", !!leadAudit && leadAudit.userId === staff.id && leadAudit.impersonatorId === boss.id);

  console.log("[imp] ===== blocked actions while impersonating =====");
  check("block nested impersonate", (await api("POST", "/user/impersonate", impToken, { userId: peer.id, reason: "x" })).status === 403);
  check("block changePassword", (await api("POST", "/user/changePassword", impToken, { password: "whatever123" })).status === 403);
  check("block linkEmployee", (await api("POST", "/user/linkEmployee", impToken, { userId: staff.id, employeeId: null })).status === 403);
  check("block role create", (await api("POST", "/role/create", impToken, { name: `${TAG}role` })).status === 403);
  check("block featurePermission create", (await api("POST", "/featurePermission/create", impToken, { parentType: "User", parentId: staff.id, allowedFeatures: [] })).status === 403);
  check("block logout-all (auth group)", (await httpP("GET", "/auth/logoutOfAllDevices", impToken)).status === 403);

  console.log("[imp] ===== attendance/mobile reject impersonation token =====");
  check("reject on x-platform=Attendance App", (await httpP("POST", "/lead/get", impToken, "Attendance App", {})).status === 401);
  check("reject on x-platform=Mobile", (await httpP("POST", "/lead/get", impToken, "Mobile", {})).status === 401);
  check("allowed on x-platform=Admin", (await httpP("POST", "/lead/get", impToken, "Admin", {})).status === 200);

  console.log("[imp] ===== own activity log hides impersonated rows; audit shows them =====");
  // Two activity rows for staff: one normal, one produced under impersonation.
  await (prisma as any).activityLog.create({ data: { userId: staff.id, action: "READ", entityType: "Lead", description: `${TAG}normal`, impersonatorId: null } });
  await (prisma as any).activityLog.create({ data: { userId: staff.id, action: "UPDATE", entityType: "Lead", description: `${TAG}by-admin`, impersonatorId: boss.id } });
  // GET /activityLog/me is the self-service own view (POST /me requires activityLog.read.*).
  const myLogs = await api("GET", "/activityLog/me?page=1&pageSize=50", staffTok);
  const myRows: any[] = myLogs.data?.data || myLogs.data || [];
  const sawNormal = myRows.some((r) => r.description === `${TAG}normal`);
  const sawImpersonated = myRows.some((r) => r.description === `${TAG}by-admin`);
  check("own activity log shows the user's own row", sawNormal, `rows ${myRows.length}`);
  check("own activity log HIDES the impersonated row", !sawImpersonated);
  // Admin audit log (list) shows the impersonated lead action with impersonator attribution.
  const auditList = await api("POST", "/auditLog/get", bossTok, { impersonated: true, page: 1, pageSize: 50 });
  const auditRows: any[] = auditList.data?.data || auditList.data || [];
  check("admin audit (impersonated filter) returns only impersonated rows", auditRows.length > 0 && auditRows.every((r) => r.impersonatorId));
  check("admin audit row carries impersonator attribution", auditRows.some((r) => r.impersonator && r.impersonator.id === boss.id));

  console.log("[imp] ===== token expiry rejected =====");
  const expired = jwt.sign({ userId: staff.id, unitIds: [], impersonatorId: boss.id, impersonationId: impId, platform: "Admin" }, SECRET, { expiresIn: -10 });
  check("expired impersonation token rejected", (await httpP("POST", "/lead/get", expired, "Admin", {})).status === 403);

  console.log("[imp] ===== exit ends the session =====");
  const exit = await api("POST", "/user/impersonate/exit", impToken, {});
  check("exit -> 200", exit.status === 200, `status ${exit.status}`);
  const sessAfter = impId ? await prisma.impersonationSession.findUnique({ where: { id: impId } }) : null;
  check("exit sets endedAt", !!sessAfter?.endedAt);
  const endEvt = await prisma.auditLog.findFirst({ where: { action: "IMPERSONATE_END", impersonationId: impId } });
  check("IMPERSONATE_END event logged", !!endEvt && endEvt.impersonatorId === boss.id);
  // the admin's own token still works (never touched) — "exit restores admin"
  check("admin's own token still valid after exit", (await api("GET", "/user/getLoggedInUser", bossTok)).status === 200);

  console.log(`\n[imp] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  if (fail) console.log("FAILURES:\n" + fails.map((f) => "  - " + f).join("\n"));
  await cleanup();
  process.exit(fail ? 1 : 0);
}

async function cleanup() {
  try {
    await prisma.auditLog.deleteMany({ where: { OR: [{ changes: { path: ["target"], string_contains: TAG } }, { entity: "ImpersonationSession" }] } }).catch(() => {});
    await (prisma as any).activityLog.deleteMany({ where: { description: { startsWith: TAG } } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { customerName: { startsWith: TAG } } }).catch(() => {});
    for (const id of createdFP) await prisma.featurePermission.delete({ where: { id } }).catch(() => {});
    const users = await prisma.user.findMany({ where: { username: { startsWith: TAG } }, select: { id: true } });
    const uids = users.map((u) => u.id);
    await prisma.impersonationSession.deleteMany({ where: { OR: [{ impersonatorId: { in: uids } }, { targetUserId: { in: uids } }] } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: uids } }, { impersonatorId: { in: uids } }] } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } }).catch(() => {});
  } catch (e) { console.error("cleanup error", e); }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); });
