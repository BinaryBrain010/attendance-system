/**
 * Audit harness (Run 11 Part 5, LOCAL ONLY). Proves the central audit trail:
 *  - create/update/delete/restore stamp the actor columns AND write exactly one AuditLog row with
 *    the right user, module and action;
 *  - secrets are masked (password never stored in plaintext);
 *  - cron/import work (runAsSystem) is attributed to the System user;
 *  - the History-tab API is scoped: a user only sees the history of records they can read.
 * Self-cleaning (removes its own entities, audit rows and users). Runs with audit ON.
 *
 *   RBAC_ENFORCE=on QA_BASE_URL=http://localhost:3002 npx ts-node qa/audit.ts
 */
// Harness-process prisma writes (scaffolding + cleanup) must not pollute the trail. The API calls we
// assert on hit the SERVER (always audits); we toggle local auditing ON only for the one direct
// runAsSystem write we verify. Read lazily by the audit hook, so these env flips take effect.
process.env.AUDIT_LOG = "0";
import { api, mintGodToken, mintTokenFor, IS_LOCAL } from "./lib";
import prisma from "../src/core/models/base.model";
import { runAsSystem, SYSTEM_USER_ID } from "../src/core/context/requestContext";
import { randomUUID } from "crypto";

if (!IS_LOCAL) { console.error("[audit] refuse: non-local DB"); process.exit(2); }

const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

async function auditRows(entity: string, entityId: string) {
  return prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { createdAt: "asc" } });
}

async function mkUser(username: string, feats: string[], employeeId: string | null): Promise<string> {
  const old = await prisma.user.findFirst({ where: { username } });
  if (old) { await prisma.featurePermission.deleteMany({ where: { parentId: old.id } }); await prisma.loggedInUsers.deleteMany({ where: { userId: old.id } }); await prisma.auditLog.deleteMany({ where: { userId: old.id } }); await prisma.user.delete({ where: { id: old.id } }); }
  const uid = randomUUID();
  await prisma.user.create({ data: { id: uid, username, password: "x", employeeId, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.featurePermission.create({ data: { id: randomUUID(), parentType: "User", parentId: uid, permissions: { allowedFeatures: feats }, createdAt: new Date(), updatedAt: new Date() } });
  return uid;
}

async function main() {
  const god = mintGodToken();
  const createdHolidayIds: string[] = [];

  console.log("[audit] create/update/delete/restore lifecycle (Holiday, god)...");
  const c = await api("POST", "/holiday/create", god, { date: "2035-06-06", reason: "QA_AUDIT_LC", isActive: true });
  const id = c.data?.id; createdHolidayIds.push(id);
  const afterCreate = await prisma.holiday.findUnique({ where: { id } });
  ok("create stamps createdById=god", afterCreate?.createdById === GOD_ID, `got ${afterCreate?.createdById}`);
  let rows = await auditRows("Holiday", id);
  ok("create writes exactly one CREATE row", rows.filter((r) => r.action === "CREATE").length === 1);
  ok("CREATE row userId=god", rows.find((r) => r.action === "CREATE")?.userId === GOD_ID);
  ok("CREATE row module=AMS", rows.find((r) => r.action === "CREATE")?.module === "AMS");

  await api("PUT", "/holiday/update", god, { id, reason: "QA_AUDIT_LC2", description: "changed" });
  const afterUpd = await prisma.holiday.findUnique({ where: { id } });
  ok("update stamps updatedById=god", afterUpd?.updatedById === GOD_ID);
  rows = await auditRows("Holiday", id);
  const upd = rows.filter((r) => r.action === "UPDATE" || r.action === "STATUS_CHANGE");
  ok("update writes one change row", upd.length === 1, `got ${upd.length}`);
  ok("update row has before+after", (() => { const ch: any = upd[0]?.changes; return ch && ch.reason && "before" in ch.reason && "after" in ch.reason; })());

  await api("POST", "/holiday/delete", god, { id });
  const afterDel = await prisma.holiday.findUnique({ where: { id } });
  ok("soft delete stamps deletedById=god + isDeleted", afterDel?.deletedById === GOD_ID && !!afterDel?.isDeleted);
  rows = await auditRows("Holiday", id);
  ok("delete writes one DELETE row", rows.filter((r) => r.action === "DELETE").length === 1);

  await api("POST", "/holiday/restore", god, { id });
  const afterRes = await prisma.holiday.findUnique({ where: { id } });
  ok("restore clears deletedById + isDeleted", afterRes?.deletedById === null && afterRes?.isDeleted === null);
  rows = await auditRows("Holiday", id);
  ok("restore writes one RESTORE row", rows.filter((r) => r.action === "RESTORE").length === 1);

  console.log("[audit] secret masking (User create)...");
  const uname = "qa.audit.secret." + Date.now() + "@test.local";
  await api("POST", "/user/create", god, { username: uname, password: "TopSecretPw!123", confirmPassword: "TopSecretPw!123" });
  const u = await prisma.user.findFirst({ where: { username: uname } });
  const uRows = u ? await auditRows("User", u.id) : [];
  const createRow: any = uRows.find((r) => r.action === "CREATE");
  const chStr = JSON.stringify(createRow?.changes || {});
  ok("user CREATE logged", !!createRow);
  ok("password masked in audit", chStr.includes("***") && !chStr.includes("TopSecretPw"));

  console.log("[audit] System attribution (runAsSystem = cron/import path)...");
  let sysId = "";
  process.env.AUDIT_LOG = "1"; // verify this direct write audits as System
  await runAsSystem(async () => {
    const h = await prisma.holiday.create({ data: { date: new Date("2035-07-07"), reason: "QA_AUDIT_SYS", isActive: true, createdAt: new Date(), updatedAt: new Date() } as any });
    sysId = h.id;
  });
  process.env.AUDIT_LOG = "0";
  createdHolidayIds.push(sysId);
  const sysRow = await prisma.holiday.findUnique({ where: { id: sysId } });
  ok("runAsSystem stamps createdById=System", sysRow?.createdById === SYSTEM_USER_ID);
  const sysAudit = await auditRows("Holiday", sysId);
  ok("System write logs userId=System", sysAudit.find((r) => r.action === "CREATE")?.userId === SYSTEM_USER_ID);

  console.log("[audit] History-tab API scope (only records you can read)...");
  // A lead owned by nobody in particular; test three callers.
  await api("POST", "/lead/create", god, { customerName: "QA_AUDIT_SCOPE", phone: "03009998877", city: "Lahore" });
  const leadRow = await prisma.lead.findFirst({ where: { customerName: "QA_AUDIT_SCOPE" }, orderBy: { createdAt: "desc" } });
  const leadId = leadRow?.id as string;
  const uNoCrm = await mkUser("qa.audit.nocrm@test.local", ["login.admin.*"], null);
  const tNoCrm = mintTokenFor(uNoCrm);
  const histGod = await api("POST", "/auditLog/entity", god, { entity: "Lead", entityId: leadId });
  ok("god sees lead history", histGod.status === 200 && Array.isArray(histGod.data) && histGod.data.length >= 1, `status=${histGod.status}`);
  const histNo = await api("POST", "/auditLog/entity", tNoCrm, { entity: "Lead", entityId: leadId });
  ok("user without crm.lead.read is denied history", histNo.status === 403, `status=${histNo.status}`);
  // admin list endpoint is admin-only
  const listNo = await api("POST", "/auditLog/get", tNoCrm, { entity: "Lead" });
  ok("non-admin denied audit list", listNo.status === 403, `status=${listNo.status}`);
  const listGod = await api("POST", "/auditLog/get", god, { entity: "Lead", pageSize: 5 });
  ok("admin audit list works", listGod.status === 200 && typeof listGod.data?.total === "number");

  // ---- cleanup ----
  console.log("[audit] cleanup...");
  if (leadId) { await prisma.auditLog.deleteMany({ where: { entityId: leadId } }); await prisma.leadActivity.deleteMany({ where: { leadId } }); await prisma.lead.deleteMany({ where: { id: leadId } }); }
  for (const hid of createdHolidayIds) if (hid) { await prisma.auditLog.deleteMany({ where: { entityId: hid } }); }
  await prisma.holiday.deleteMany({ where: { reason: { in: ["QA_AUDIT_LC", "QA_AUDIT_LC2", "QA_AUDIT_SYS"] } } });
  if (u) { await prisma.auditLog.deleteMany({ where: { entityId: u.id } }); await prisma.featurePermission.deleteMany({ where: { parentId: u.id } }); await prisma.loggedInUsers.deleteMany({ where: { userId: u.id } }); await prisma.user.deleteMany({ where: { id: u.id } }); }
  await prisma.auditLog.deleteMany({ where: { userId: { in: [uNoCrm] } } });
  await prisma.featurePermission.deleteMany({ where: { parentId: uNoCrm } });
  await prisma.user.deleteMany({ where: { id: uNoCrm } });
  // sweep any stray audit rows named with our QA markers
  await prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE changes::text LIKE '%QA_AUDIT_%'`);

  console.log(`\n[audit] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch { /* */ } process.exit(1); });
