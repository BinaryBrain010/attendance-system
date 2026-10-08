/**
 * LOCAL-ONLY browser-test setup for CRM Phase 2 pages. Gives two existing agent users a known
 * password + the CRM grants needed to exercise the admin pages, wires a team, and seeds demo leads.
 * Prints the two logins. Re-runnable.
 *
 *   npx ts-node qa/crmBrowserPersonas.ts
 *
 * NOTE: this sets a LOCAL test password on usama_liaqat@phw (own agent) and usman_arshad@phw
 * (manager). Local DB only; prod is untouched.
 */
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) { console.error("refusing: not local"); process.exit(2); }

const PASSWORD = "CrmTest!2026";
const DEMO = "CRM Demo";

const AGENT_FEATURES = [
  "login.admin.*", "appModules.crm.*", "crm.catalogue.read.*", "crm.agent.read.*",
  "crm.lead.read.own.*", "crm.lead.create.*", "crm.lead.update.*", "crm.lead.transition.*", "crm.lead.assign.*",
];
const MANAGER_FEATURES = [...AGENT_FEATURES, "crm.lead.read.team.*"];

async function setPassword(userId: string) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
}
async function grant(userId: string, features: string[]) {
  // replace any prior CRM test grant for this user (identify by containing login.admin.*)
  const rows = await prisma.featurePermission.findMany({ where: { parentType: "User", parentId: userId, isDeleted: null } });
  for (const r of rows) {
    const f = (r.permissions as any)?.allowedFeatures || [];
    if (Array.isArray(f) && f.includes("login.admin.*") && f.some((x: string) => x.startsWith("crm."))) {
      await prisma.featurePermission.delete({ where: { id: r.id } });
    }
  }
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: userId, permissions: { allowedFeatures: features } as any, createdAt: new Date() } });
}

async function main() {
  const AG001 = await prisma.salesAgent.findUnique({ where: { agentCode: "AG001" } });
  const AG003 = await prisma.salesAgent.findUnique({ where: { agentCode: "AG003" } });
  const AG006 = await prisma.salesAgent.findUnique({ where: { agentCode: "AG006" } });
  if (!AG001?.userId || !AG006?.userId || !AG003) { console.error("need AG001+user, AG003, AG006+user — run crmSeed first"); process.exit(1); }

  // team: AG006 leads AG001 + AG003
  await prisma.salesAgent.update({ where: { id: AG006.id }, data: { scope: "TEAM" } });
  await prisma.salesAgent.update({ where: { id: AG001.id }, data: { scope: "OWN", teamLeadId: AG006.id } });
  await prisma.salesAgent.update({ where: { id: AG003.id }, data: { scope: "OWN", teamLeadId: AG006.id } });

  await setPassword(AG001.userId!);
  await setPassword(AG006.userId!);
  await grant(AG001.userId!, AGENT_FEATURES);
  await grant(AG006.userId!, MANAGER_FEATURES);

  const agentUser = await prisma.user.findUnique({ where: { id: AG001.userId! }, select: { username: true } });
  const mgrUser = await prisma.user.findUnique({ where: { id: AG006.userId! }, select: { username: true } });

  // demo leads across stages (idempotent by customerName)
  await prisma.lead.deleteMany({ where: { customerName: { startsWith: DEMO } } });
  const mk = (agentId: string, who: string, n: number, stage: any, value: number, fu: Date | null) =>
    prisma.lead.create({ data: { customerName: `${DEMO} ${who}-${n}`, phone: `0300-00000${n}`, city: n % 2 ? "Lahore" : "Karachi", channel: "PHONE", stage, priority: "MEDIUM", estimatedValue: value, agentId, company: "OKASHASMART", dateReceived: new Date(), nextFollowUpAt: fu } });
  const past = new Date(Date.now() - 2 * 86400000), future = new Date(Date.now() + 3 * 86400000);
  // AG001 (own) — spread across stages for the kanban
  await mk(AG001.id, "A1", 1, "NEW", 50000, past);
  await mk(AG001.id, "A1", 2, "CONTACTED", 30000, future);
  await mk(AG001.id, "A1", 3, "QUOTATION", 120000, future);
  await mk(AG001.id, "A1", 4, "WON", 45000, null);
  // AG003 (team member) — visible to manager, NOT to AG001
  await mk(AG003.id, "A3", 1, "NEGOTIATION", 80000, past);
  await mk(AG003.id, "A3", 2, "CONTACTED", 15000, future);
  // AG006 (manager own)
  await mk(AG006.id, "M", 1, "QUALIFIED", 60000, future);

  console.log("=== CRM browser personas ready (LOCAL) ===");
  console.log(`OWN agent   : ${agentUser?.username}  /  ${PASSWORD}   (AG001, scope OWN — sees 4 demo leads)`);
  console.log(`MANAGER     : ${mgrUser?.username}  /  ${PASSWORD}   (AG006, scope TEAM over AG001+AG003 — sees all 7 demo leads)`);
  console.log("platform = Admin");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
