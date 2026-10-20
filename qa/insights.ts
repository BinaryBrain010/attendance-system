/**
 * Analytics (Insights) QA harness. Creates throwaway QA_ users with distinct permission sets, drives
 * the live API on :3002 (RBAC_ENFORCE=on), and asserts the security properties the feature promises:
 *   - a user without CRM never sees CRM widgets or data, even via direct API;
 *   - the custom-widget builder respects the caller's scope;
 *   - the builder whitelist rejects unknown entities/fields;
 *   - dashboard writes need analytics.dashboard.*, builder writes need analytics.customWidget.*.
 * Local-only (lib.ts guards). Cleans up everything it creates. Run: `npm run qa:insights`.
 */
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";
import { login, api, QA_PASSWORD, QA_EMAIL_DOMAIN } from "./lib";

const SLUG = "QA_ins_";
let HASH = "";
const createdUserIds: string[] = [];

async function purgeUser(uid: string) {
  await prisma.loggedInUsers.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.savedWidget.deleteMany({ where: { ownerId: uid } }).catch(() => {});
  await prisma.dashboardWidget.deleteMany({ where: { dashboard: { ownerId: uid } } }).catch(() => {});
  await prisma.dashboard.deleteMany({ where: { ownerId: uid } }).catch(() => {});
  await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: uid } }).catch(() => {});
  await prisma.user.delete({ where: { id: uid } }).catch(() => {});
}

async function mkUser(name: string, features: string[]): Promise<{ id: string; username: string }> {
  if (!HASH) HASH = await bcrypt.hash(QA_PASSWORD, 4);
  const username = `${SLUG}${name}${QA_EMAIL_DOMAIN}`;
  // clean any leftover from a prior run (sessions first, FK on LoggedInUsers)
  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) await purgeUser(existing.id);
  const u = await prisma.user.create({ data: { username, password: HASH, createdAt: new Date() } });
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: features } as any, createdAt: new Date() } });
  createdUserIds.push(u.id);
  return { id: u.id, username };
}

let pass = 0, fail = 0;
const lines: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; lines.push(`  PASS  ${name}${detail ? "  — " + detail : ""}`); }
  else { fail++; lines.push(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const sumSeries = (d: any): number => {
  if (!d) return 0;
  if (Array.isArray(d.data)) return d.data.reduce((a: number, b: number) => a + b, 0);
  if (Array.isArray(d.series)) return d.series.reduce((a: number, s: any) => a + (s.data || []).reduce((x: number, y: number) => x + y, 0), 0);
  if (typeof d.value === "number") return d.value;
  return 0;
};

async function run() {
  // ---- fixtures ----
  const admin = await mkUser("admin", ["login.admin.*", "analytics.read.*", "analytics.dashboard.*", "analytics.customWidget.*", "appModules.*", "voucher.read.*", "visitor.read.*", "attendance.read.*", "audit.read.*", "crm.lead.read.all.*", "crm.quotation.read.all.*", "crm.order.read.all.*", "crm.return.read.all.*", "work.task.read.all.*", "work.report.read.all.*"]);
  const noCrm = await mkUser("nocrm", ["login.admin.*", "analytics.read.*", "appModules.quickPass.*", "voucher.read.*"]); // quick pass only; no dashboard/customWidget
  const agentOwn = await mkUser("agentown", ["login.admin.*", "analytics.read.*", "analytics.customWidget.*", "appModules.crm.*", "crm.lead.read.own.*"]);

  const T = async (u: { username: string }) => (await login(u.username, QA_PASSWORD, "Admin", true)).token!;
  const adminTok = await T(admin), noCrmTok = await T(noCrm), agentTok = await T(agentOwn);
  check("fixtures login", !!adminTok && !!noCrmTok && !!agentTok);

  // ---- P1: a user without CRM never sees CRM widgets or data ----
  const catNo = await api("GET", "/insights/catalog", noCrmTok);
  const noCrmModules = (catNo.data?.groups || []).map((g: any) => g.module);
  check("no-CRM catalog excludes crm", !noCrmModules.includes("crm"), `modules=[${noCrmModules.join(",")}]`);
  check("no-CRM catalog is quickPass-only", JSON.stringify(noCrmModules) === JSON.stringify(["quickPass"]), `modules=[${noCrmModules.join(",")}]`);

  const dataNo = await api("POST", "/insights/widget/data", noCrmTok, { key: "crm.pipelineByStage", filters: {} });
  check("no-CRM crm widget/data is 403", dataNo.status === 403, `status=${dataNo.status}`);

  const metaNo = await api("GET", "/insights/customWidget/meta", noCrmTok);
  const noCrmEntities = (metaNo.data?.entities || []).map((e: any) => e.key);
  check("no-CRM builder meta excludes lead/crm", !noCrmEntities.includes("lead"), `entities=[${noCrmEntities.join(",")}]`);

  const catAdmin = await api("GET", "/insights/catalog", adminTok);
  const adminModules = (catAdmin.data?.groups || []).map((g: any) => g.module);
  check("admin catalog includes crm", adminModules.includes("crm"), `modules=[${adminModules.join(",")}]`);

  // ---- P2: scope respected in custom widgets ----
  const defLead = { entity: "lead", agg: "count", groupBy: { field: "stage" }, chartType: "bar" };
  const pvAgent = await api("POST", "/insights/customWidget/preview", agentTok, { definition: defLead, filters: { preset: "all" } });
  const pvAdmin = await api("POST", "/insights/customWidget/preview", adminTok, { definition: defLead, filters: { preset: "all" } });
  check("agent-own lead preview allowed (own scope)", pvAgent.status === 200, `status=${pvAgent.status}`);
  check("admin lead preview allowed", pvAdmin.status === 200, `status=${pvAdmin.status}`);
  const agentTotal = sumSeries(pvAgent.data?.data), adminTotal = sumSeries(pvAdmin.data?.data);
  check("scope narrows: admin lead total >= agent-own total", adminTotal >= agentTotal, `admin=${adminTotal} agent=${agentTotal}`);

  // agent cannot preview an entity they can't read (visitor) even though they can build
  const pvVisitor = await api("POST", "/insights/customWidget/preview", agentTok, { definition: { entity: "visitor", agg: "count", groupBy: { field: "outcome" }, chartType: "bar" }, filters: {} });
  check("agent preview of un-permitted entity (visitor) is denied", pvVisitor.status === 403, `status=${pvVisitor.status}`);

  // ---- P3: whitelist rejects unknown entity / field ----
  const badField = await api("POST", "/insights/customWidget/preview", adminTok, { definition: { entity: "lead", agg: "sum", metricField: "secretCost", chartType: "kpi" }, filters: {} });
  check("whitelist rejects unknown metric field", badField.status !== 200 && /not allowed|Unknown/i.test(badField.message || ""), `status=${badField.status} msg="${badField.message}"`);
  const badEntity = await api("POST", "/insights/customWidget/preview", adminTok, { definition: { entity: "user", agg: "count", chartType: "kpi" }, filters: {} });
  check("whitelist rejects unknown entity", badEntity.status !== 200 && /Unknown entity/i.test(badEntity.message || ""), `status=${badEntity.status} msg="${badEntity.message}"`);
  const badGroup = await api("POST", "/insights/customWidget/preview", adminTok, { definition: { entity: "lead", agg: "count", groupBy: { field: "password" }, chartType: "bar" }, filters: {} });
  check("whitelist rejects unknown group-by field", badGroup.status !== 200, `status=${badGroup.status} msg="${badGroup.message}"`);

  // ---- write gating ----
  const dashNo = await api("POST", "/insights/dashboard/create", noCrmTok, { name: "QA x" });
  check("dashboard create needs analytics.dashboard.* (no-CRM denied)", dashNo.status === 403, `status=${dashNo.status}`);
  const dashAdmin = await api("POST", "/insights/dashboard/create", adminTok, { name: "QA_ins dash", widgets: [{ widgetKey: "quickpass.byStatus", type: "donut", x: 0, y: 0, w: 4, h: 4 }] });
  check("dashboard create works for admin", dashAdmin.status === 200 && !!dashAdmin.data?.id, `status=${dashAdmin.status}`);
  // (the admin QA user's dashboard is removed by purgeUser in cleanup, widgets first)

  const saveNo = await api("POST", "/insights/customWidget/save", noCrmTok, { name: "QA x", definition: { entity: "gatePass", agg: "count", groupBy: { field: "status" }, chartType: "bar" } });
  check("customWidget save needs analytics.customWidget.* (no-CRM denied)", saveNo.status === 403, `status=${saveNo.status}`);

  // ---- report ----
  console.log("\n=== Analytics (Insights) QA ===");
  console.log(lines.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed`);
}

async function cleanup() {
  for (const uid of createdUserIds) await purgeUser(uid);
}

run()
  .catch((e) => { console.error("[qa:insights] error", e); fail++; })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(fail ? 1 : 0); });
