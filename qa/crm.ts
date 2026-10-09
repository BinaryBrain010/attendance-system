/**
 * CRM Phase 1 harness (LOCAL ONLY). Runs against the live API with RBAC_ENFORCE=on.
 * Verifies: featureMap coverage, CRUD, cost/margin gating, and own/team/all scope on leads,
 * quotations and orders including reports & exports.
 *
 *   RBAC_ENFORCE=on  (server)   then   npx ts-node qa/crm.ts
 *
 * Personas (features granted via a FeaturePermission row per user; cleaned up at the end):
 *   ADMIN_ALL   crm.* (incl cost)                      no agent  -> scope ALL
 *   AGENT_OWN   crm.{lead,quotation,order}.read.own.*  AG001     -> scope OWN
 *   TEAM_LEAD   + .read.team.*                          AG006     -> scope TEAM (members AG001, AG003)
 *   VIEWER      read.all.* + report.* (NO cost)         no agent  -> scope ALL, cost denied
 *   NO_CRM      (nothing)                                         -> every CRM route 403
 *   UMBRELLA    appModules.crm.* only                             -> functional routes 403
 */
import fs from "fs";
import path from "path";
import { mintTokenFor, api, IS_LOCAL } from "./lib";
import prisma from "../src/core/models/base.model";

if (!IS_LOCAL) process.exit(2);

let pass = 0, fail = 0;
const fails: string[] = [];
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; /* console.log("  PASS", name); */ }
  else { fail++; fails.push(`${name} ${extra}`); console.log("  FAIL", name, extra); }
}

const createdFP: string[] = [];
async function grant(userId: string, features: string[]) {
  const row = await prisma.featurePermission.create({
    data: { parentType: "User", parentId: userId, permissions: { allowedFeatures: features } as any, createdAt: new Date() },
  });
  createdFP.push(row.id);
}

const OWN = (e: string) => `crm.${e}.read.own.*`;
const TEAM = (e: string) => `crm.${e}.read.team.*`;
const ALL = (e: string) => `crm.${e}.read.all.*`;
const ENTS = ["lead", "quotation", "order"];

async function pickNonAgentUsers(n: number, exclude: string[]): Promise<string[]> {
  const agents = await prisma.salesAgent.findMany({ select: { userId: true } });
  const agentUserIds = new Set(agents.map((a) => a.userId).filter(Boolean) as string[]);
  const users = await prisma.user.findMany({
    where: { isDeleted: null, NOT: { username: { startsWith: "qa." } }, employeeId: { not: null } },
    select: { id: true }, take: 200,
  });
  const out: string[] = [];
  for (const u of users) {
    if (agentUserIds.has(u.id) || exclude.includes(u.id) || u.id === "58c55d6a-910c-46f8-a422-4604bea6cd15") continue;
    out.push(u.id);
    if (out.length >= n) break;
  }
  return out;
}

const QTAG = "QA_CRM_";
const createdLeads: string[] = [], createdOrders: string[] = [], createdCats: string[] = [];

async function cleanupFixtures() {
  const qaLeads = await prisma.lead.findMany({ where: { customerName: { startsWith: QTAG } }, select: { id: true } }).catch(() => [] as { id: string }[]);
  const ids = qaLeads.map((l) => l.id);
  if (ids.length) await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } }).catch(() => {});
  await prisma.salesOrderItem.deleteMany({ where: { order: { customerName: { startsWith: QTAG } } } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { customerName: { startsWith: QTAG } } }).catch(() => {});
  await prisma.quotationItem.deleteMany({ where: { quotation: { customerName: { startsWith: QTAG } } } }).catch(() => {});
  await prisma.quotation.deleteMany({ where: { customerName: { startsWith: QTAG } } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { customerName: { startsWith: QTAG } } }).catch(() => {});
  await prisma.visitor.deleteMany({ where: { name: { startsWith: QTAG } } }).catch(() => {});
  await prisma.category.deleteMany({ where: { name: { startsWith: QTAG } } }).catch(() => {});
}

async function main() {
  // ---- resolve agents ----
  const ag = async (code: string) => prisma.salesAgent.findUnique({ where: { agentCode: code } });
  const AG001 = await ag("AG001"), AG003 = await ag("AG003"), AG004 = await ag("AG004"), AG006 = await ag("AG006");
  if (!AG001?.userId || !AG006?.userId || !AG003 || !AG004) {
    console.error("[crm] required seeded agents missing (need AG001+user, AG003, AG004, AG006+user). Run crmSeed.ts and resolve agent gaps.");
    process.exit(1);
  }
  // team: AG006 leads AG001 + AG003
  await prisma.salesAgent.update({ where: { id: AG006.id }, data: { scope: "TEAM" } });
  await prisma.salesAgent.update({ where: { id: AG001.id }, data: { scope: "OWN", teamLeadId: AG006.id } });
  await prisma.salesAgent.update({ where: { id: AG003.id }, data: { scope: "OWN", teamLeadId: AG006.id } });
  await prisma.salesAgent.update({ where: { id: AG004.id }, data: { scope: "OWN", teamLeadId: null } });

  const agentOwnUser = AG001.userId!, teamLeadUser = AG006.userId!;
  const [adminUser, viewerUser, noCrmUser, umbrellaUser] = await pickNonAgentUsers(4, [agentOwnUser, teamLeadUser]);

  // ---- clean any prior run, then grant ----
  await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: { in: [adminUser, viewerUser, umbrellaUser, agentOwnUser, teamLeadUser] }, permissions: { path: ["allowedFeatures"], array_contains: ["crm.*"] } as any } }).catch(() => {});
  await cleanupFixtures();

  // write features (create/update/delete/restore) a selling agent needs; scope of WHICH rows they can
  // touch is then enforced in the service layer, not by these features.
  const WRITES = ENTS.flatMap((e) => [`crm.${e}.create.*`, `crm.${e}.update.*`, `crm.${e}.delete.*`, `crm.${e}.restore.*`]);
  const OPS = ["crm.lead.transition.*", "crm.lead.assign.*", "crm.quotation.transition.*", "crm.quotation.export.*", "crm.order.transition.*", "crm.order.reattempt.*", "crm.return.transition.*"];
  await grant(adminUser, ["crm.*"]);
  await grant(agentOwnUser, [...ENTS.map(OWN), ...WRITES, ...OPS, "crm.catalogue.read.*", "crm.report.read.*"]);
  await grant(teamLeadUser, [...ENTS.map(OWN), ...ENTS.map(TEAM), ...WRITES, ...OPS, "crm.catalogue.read.*", "crm.report.read.*"]);
  await grant(viewerUser, [...ENTS.map(OWN), ...ENTS.map(TEAM), ...ENTS.map(ALL), "crm.report.read.*", "crm.report.export.*", "crm.catalogue.read.*"]);
  await grant(umbrellaUser, ["appModules.crm.*"]);

  const tAdmin = mintTokenFor(adminUser), tOwn = mintTokenFor(agentOwnUser), tTeam = mintTokenFor(teamLeadUser),
    tViewer = mintTokenFor(viewerUser), tNo = mintTokenFor(noCrmUser), tUmb = mintTokenFor(umbrellaUser);

  // ---- fixtures: leads (via prisma, tagged) ----
  const mkLead = async (agentId: string, i: number, extra: any = {}) => {
    const l = await prisma.lead.create({ data: { customerName: `${QTAG}Lead ${agentId.slice(0, 4)}-${i}`, agentId, stage: "CONTACTED", estimatedValue: 50000, company: "OKASHASMART", ...extra } });
    createdLeads.push(l.id); return l;
  };
  const ownA1 = await mkLead(AG001.id, 1); await mkLead(AG001.id, 2);
  const teamA3 = await mkLead(AG003.id, 1); await mkLead(AG003.id, 2);
  await mkLead(AG006.id, 1);
  const outLead1 = await mkLead(AG004.id, 1); await mkLead(AG004.id, 2);
  // counts: AG001=2, AG003=2, AG006=1, AG004=2 -> OWN(AG001)=2, TEAM(AG006+AG001+AG003)=5, ALL=7

  // ---- fixtures: orders (DELIVERED, with item cost) ----
  const mkOrder = async (agentId: string, outlet: string, total: number, cost: number, i: number) => {
    const o = await prisma.salesOrder.create({
      data: { orderNo: `${QTAG}${agentId.slice(0, 4)}-${outlet}-${i}-${Date.now()}`, customerName: `${QTAG}Ord ${i}`, agentId, outlet, status: "DELIVERED", total, company: "OKASHASMART",
        items: { create: [{ description: "x", quantity: 1, unitPrice: total, unitCost: cost, lineTotal: total }] } },
    });
    createdOrders.push(o.id); return o;
  };
  await mkOrder(AG001.id, "Lahore", 50000, 30000, 1);
  await mkOrder(AG003.id, "Lahore", 30000, 20000, 2);
  await mkOrder(AG006.id, "Karachi", 40000, 25000, 3);
  await mkOrder(AG004.id, "Karachi", 60000, 45000, 4);
  // ALL: Lahore 80000(2), Karachi 100000(2); revenue 180000 cost 120000 margin 60000
  // OWN(AG001): Lahore 50000(1). TEAM: Lahore 80000(2) + Karachi 40000(1).

  console.log("\n[crm] ===== featureMap coverage =====");
  const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "middleware", "rbac", "featureMap.json"), "utf8"));
  const crmKeys = Object.keys(MAP).filter((k) => /\s\/(crm|lead|quotation|salesOrder|salesAgent)/.test(k));
  check("crm routes mapped >= 80", crmKeys.length >= 80, `got ${crmKeys.length}`);
  check("all crm routes access=feature with crm.* feature", crmKeys.every((k) => MAP[k].access === "feature" && MAP[k].feature.startsWith("crm.")));

  console.log("\n[crm] ===== enforcement (RBAC_ENFORCE=on) =====");
  check("NO_CRM -> /crmCategory/getAll 403", (await api("GET", "/crmCategory/getAll", tNo)).status === 403);
  check("NO_CRM -> /lead/get 403", (await api("POST", "/lead/get", tNo, {})).status === 403);
  check("UMBRELLA(appModules.crm) -> /lead/get 403", (await api("POST", "/lead/get", tUmb, {})).status === 403);
  check("AGENT_OWN -> /crmCategory/getAll 200", (await api("GET", "/crmCategory/getAll", tOwn)).status === 200);

  console.log("\n[crm] ===== CRUD (ADMIN) =====");
  const cCreate = await api("POST", "/crmCategory/create", tAdmin, { name: `${QTAG}Cat ${Date.now()}` });
  check("category create 201", cCreate.status === 201, `got ${cCreate.status}`);
  const catId = cCreate.data?.[0]?.id; if (catId) createdCats.push(catId);
  check("category update 200", (await api("PUT", "/crmCategory/update", tAdmin, { id: catId, description: "upd" })).status === 200);
  check("category delete 200", (await api("POST", "/crmCategory/delete", tAdmin, { id: catId })).status === 200);
  check("category restore 200", (await api("POST", "/crmCategory/restore", tAdmin, { id: catId })).status === 200);

  console.log("\n[crm] ===== scope: leads =====");
  const leadCount = async (t: string) => { const r = await api("POST", "/lead/get", t, { page: 1, pageSize: 100 }); return { status: r.status, n: (r.data?.data || []).filter((l: any) => String(l.customerName || "").startsWith(QTAG)).length, mode: r.data?.scope }; };
  const lo = await leadCount(tOwn), lt = await leadCount(tTeam), la = await leadCount(tAdmin), lv = await leadCount(tViewer);
  check("AGENT_OWN sees 2 leads (own)", lo.n === 2, `got ${lo.n} mode=${lo.mode}`);
  check("TEAM_LEAD sees 5 leads (team)", lt.n === 5, `got ${lt.n} mode=${lt.mode}`);
  check("ADMIN sees 7 leads (all)", la.n === 7, `got ${la.n} mode=${la.mode}`);
  check("VIEWER sees 7 leads (all)", lv.n === 7, `got ${lv.n} mode=${lv.mode}`);

  console.log("\n[crm] ===== scope: getById out-of-scope -> 403 =====");
  check("AGENT_OWN getById AG004 lead -> 403", (await api("POST", "/lead/getById", tOwn, { id: outLead1.id })).status === 403);
  check("TEAM_LEAD getById AG004 lead -> 403", (await api("POST", "/lead/getById", tTeam, { id: outLead1.id })).status === 403);
  check("ADMIN getById AG004 lead -> 200", (await api("POST", "/lead/getById", tAdmin, { id: outLead1.id })).status === 200);

  console.log("\n[crm] ===== scope: writes (update / delete / reassign) =====");
  const upd = (t: string, body: any) => api("PUT", "/lead/update", t, body);
  const crLead = (t: string, agentId?: string) => api("POST", "/lead/create", t, { customerName: `${QTAG}W ${Date.now()}${Math.random()}`, stage: "NEW", ...(agentId !== undefined ? { agentId } : {}) });
  check("AGENT_OWN update own lead -> 200", (await upd(tOwn, { id: ownA1.id, requirement: "x" })).status === 200);
  check("AGENT_OWN update out-of-scope lead -> 403", (await upd(tOwn, { id: outLead1.id, requirement: "x" })).status === 403);
  check("AGENT_OWN delete out-of-scope lead -> 403", (await api("POST", "/lead/delete", tOwn, { id: outLead1.id })).status === 403);
  check("AGENT_OWN create lead for self -> 201", (await crLead(tOwn, AG001.id)).status === 201);
  check("AGENT_OWN create lead for ANOTHER agent -> 403", (await crLead(tOwn, AG004.id)).status === 403);
  const defAssign = await crLead(tOwn); // no agentId -> defaults to own
  check("AGENT_OWN create lead (no agent) -> 201 defaulted to own", defAssign.status === 201 && defAssign.data?.[0]?.agentId === AG001.id, `status ${defAssign.status} agent ${defAssign.data?.[0]?.agentId}`);
  check("AGENT_OWN reassign own lead to another agent -> 403", (await upd(tOwn, { id: ownA1.id, agentId: AG004.id })).status === 403);
  check("TEAM_LEAD update team member lead -> 200", (await upd(tTeam, { id: teamA3.id, requirement: "y" })).status === 200);
  check("TEAM_LEAD update out-of-team lead -> 403", (await upd(tTeam, { id: outLead1.id, requirement: "y" })).status === 403);
  const reTeam = await upd(tTeam, { id: ownA1.id, agentId: AG003.id }); // reassign within team
  check("TEAM_LEAD reassign within team -> 200", reTeam.status === 200);
  await prisma.lead.update({ where: { id: ownA1.id }, data: { agentId: AG001.id } }); // restore fixture
  check("TEAM_LEAD reassign to out-of-team agent -> 403", (await upd(tTeam, { id: teamA3.id, agentId: AG004.id })).status === 403);
  check("ADMIN create lead for any agent -> 201", (await crLead(tAdmin, AG004.id)).status === 201);

  console.log("\n[crm] ===== scope: conflict (narrower of agent.scope and feature wins) =====");
  const conflictUser = AG003.userId;
  if (conflictUser) {
    const tConf = mintTokenFor(conflictUser);
    // (a) feature ALL but agent.scope OWN -> OWN wins
    await prisma.salesAgent.update({ where: { id: AG003.id }, data: { scope: "OWN", teamLeadId: AG006.id } });
    const g1 = await prisma.featurePermission.create({ data: { parentType: "User", parentId: conflictUser, permissions: { allowedFeatures: [...ENTS.map(OWN), ...ENTS.map(TEAM), ...ENTS.map(ALL)] } as any, createdAt: new Date() } });
    const c1 = await api("POST", "/lead/get", tConf, { page: 1, pageSize: 100 });
    const c1n = (c1.data?.data || []).filter((l: any) => String(l.customerName || "").startsWith(QTAG)).length;
    check("feature ALL + agent OWN -> OWN (sees 2, AG003 own)", c1.data?.scope === "OWN" && c1n === 2, `mode ${c1.data?.scope} n ${c1n}`);
    await prisma.featurePermission.delete({ where: { id: g1.id } });
    // (b) feature OWN but agent.scope ALL -> OWN wins
    await prisma.salesAgent.update({ where: { id: AG003.id }, data: { scope: "ALL" } });
    const g2 = await prisma.featurePermission.create({ data: { parentType: "User", parentId: conflictUser, permissions: { allowedFeatures: [...ENTS.map(OWN)] } as any, createdAt: new Date() } });
    const c2 = await api("POST", "/lead/get", tConf, { page: 1, pageSize: 100 });
    const c2n = (c2.data?.data || []).filter((l: any) => String(l.customerName || "").startsWith(QTAG)).length;
    check("feature OWN + agent ALL -> OWN (sees 2, AG003 own)", c2.data?.scope === "OWN" && c2n === 2, `mode ${c2.data?.scope} n ${c2n}`);
    await prisma.featurePermission.delete({ where: { id: g2.id } });
    await prisma.salesAgent.update({ where: { id: AG003.id }, data: { scope: "OWN" } });
  }

  console.log("\n[crm] ===== scope: reports (salesByOutlet) =====");
  const sbo = async (t: string) => (await api("POST", "/crmReport/salesByOutlet", t, {})).data?.byOutlet || [];
  const rev = (rows: any[], outlet: string) => (rows.find((r) => r.outlet === outlet)?.revenue) || 0;
  const sAdmin = await sbo(tAdmin), sOwn = await sbo(tOwn), sTeam = await sbo(tTeam);
  check("ADMIN salesByOutlet Lahore=80000", rev(sAdmin, "Lahore") === 80000, `got ${rev(sAdmin, "Lahore")}`);
  check("ADMIN salesByOutlet Karachi=100000", rev(sAdmin, "Karachi") === 100000, `got ${rev(sAdmin, "Karachi")}`);
  check("AGENT_OWN salesByOutlet Lahore=50000", rev(sOwn, "Lahore") === 50000, `got ${rev(sOwn, "Lahore")}`);
  check("AGENT_OWN salesByOutlet Karachi=0", rev(sOwn, "Karachi") === 0, `got ${rev(sOwn, "Karachi")}`);
  check("TEAM_LEAD salesByOutlet Lahore=80000 Karachi=40000", rev(sTeam, "Lahore") === 80000 && rev(sTeam, "Karachi") === 40000, `L=${rev(sTeam, "Lahore")} K=${rev(sTeam, "Karachi")}`);

  console.log("\n[crm] ===== report filter (company/outlet) =====");
  const sboFilt = (await api("POST", "/crmReport/salesByOutlet", tAdmin, { outlet: "Lahore" })).data?.byOutlet || [];
  check("ADMIN filter outlet=Lahore -> only Lahore", sboFilt.length === 1 && sboFilt[0].outlet === "Lahore", `rows ${sboFilt.length}`);

  console.log("\n[crm] ===== cost / margin gating =====");
  const mAdmin = await api("POST", "/crmReport/margin", tAdmin, {});
  check("ADMIN margin 200 with margin=60000", mAdmin.status === 200 && mAdmin.data?.margin === 60000, `status ${mAdmin.status} margin ${mAdmin.data?.margin}`);
  check("AGENT_OWN margin -> 403", (await api("POST", "/crmReport/margin", tOwn, {})).status === 403);
  check("VIEWER margin -> 403", (await api("POST", "/crmReport/margin", tViewer, {})).status === 403);
  // price list cost strip
  const prod = await prisma.product.findFirst({ where: { isDeleted: null }, select: { id: true } });
  const plAdmin = (await api("POST", "/crmPriceList/byProduct", tAdmin, { productId: prod!.id })).data || [];
  const plOwn = (await api("POST", "/crmPriceList/byProduct", tOwn, { productId: prod!.id })).data || [];
  check("ADMIN price has cost", plAdmin[0] && "cost" in plAdmin[0]);
  check("AGENT_OWN price cost stripped", plOwn[0] && !("cost" in plOwn[0]));
  check("AGENT_OWN /crmPriceList/withCost -> 403", (await api("POST", "/crmPriceList/withCost", tOwn, { productId: prod!.id })).status === 403);
  check("ADMIN /crmPriceList/withCost -> 200", (await api("POST", "/crmPriceList/withCost", tAdmin, { productId: prod!.id })).status === 200);

  console.log("\n[crm] ===== exports (scope + cost) =====");
  check("VIEWER export salesByOutlet -> 200", (await api("POST", "/crmReport/export", tViewer, { report: "salesByOutlet" })).status === 200);
  check("VIEWER export margin -> 403 (no cost)", (await api("POST", "/crmReport/export", tViewer, { report: "margin" })).status === 403);
  check("AGENT_OWN export -> 403 (no report.export)", (await api("POST", "/crmReport/export", tOwn, { report: "salesByOutlet" })).status === 403);
  check("ADMIN export margin -> 200", (await api("POST", "/crmReport/export", tAdmin, { report: "margin" })).status === 200);

  console.log("\n[crm] ===== pricing guard + Shopify import (dry-run) =====");
  const pend = await prisma.product.findFirst({ where: { sku: { startsWith: "OKS-" } }, select: { id: true } });
  const qPend = await api("POST", "/quotation/create", tAdmin, { quotationNo: `${QTAG}${Date.now()}`, customerName: `${QTAG}q`, items: [{ productId: pend!.id, quantity: 1 }] });
  check("quotation line w/ pending-price product (no unitPrice) -> 400", qPend.status === 400, `got ${qPend.status}`);
  const qExpl = await api("POST", "/quotation/create", tAdmin, { quotationNo: `${QTAG}E${Date.now()}`, customerName: `${QTAG}q`, items: [{ productId: pend!.id, quantity: 1, unitPrice: 1000 }] });
  check("quotation line w/ explicit unitPrice -> 201", qExpl.status === 201, `got ${qExpl.status}`);
  const csv = "Handle,Title,Variant SKU,Variant Price,Cost per item,Image Src,Product Type,Vendor\nnova-lock,Nova Door Lock,S31870,17500,12000,http://img/x.jpg,Smart Locks,Okasha\nnova-lock,,S31871,18000,12500,http://img/y.jpg,,\n";
  const dry = await api("POST", "/crmProduct/import", tAdmin, { csv, dryRun: true });
  check("shopify dry-run -> 200, 1 product, 2 variants, persists nothing", dry.status === 200 && dry.data?.counts?.products === 1 && dry.data?.counts?.variants === 2 && !dry.data?.persisted, `status ${dry.status} counts ${JSON.stringify(dry.data?.counts)}`);
  check("shopify dry-run keeps Shopify SKU + real price", dry.data?.products?.[0]?.sku === "S31870" && dry.data?.products?.[0]?.defaultPrice === 17500);
  await prisma.quotationItem.deleteMany({ where: { quotation: { customerName: { startsWith: QTAG } } } }).catch(() => {});
  await prisma.quotation.deleteMany({ where: { customerName: { startsWith: QTAG } } }).catch(() => {});

  console.log("\n[crm] ===== Phase 2: lead state machine =====");
  const newLead = async (t: string, agentId: string, extra: any = {}) => {
    const r = await api("POST", "/lead/create", t, { customerName: `${QTAG}SM ${Date.now()}${Math.random()}`, stage: "NEW", agentId, ...extra });
    return r.data?.[0]?.id as string;
  };
  const trans = (t: string, id: string, to: string, reason?: string) => api("POST", "/lead/transition", t, { id, to, ...(reason ? { reason } : {}) });
  const smLead = await newLead(tAdmin, AG001.id);
  check("transition NEW->CONTACTED 200", (await trans(tAdmin, smLead, "CONTACTED")).status === 200);
  check("transition CONTACTED->QUALIFIED 200", (await trans(tAdmin, smLead, "QUALIFIED")).status === 200);
  check("invalid skip QUALIFIED->WON 409", (await trans(tAdmin, smLead, "WON")).status === 409);
  check("transition QUALIFIED->QUOTATION 200", (await trans(tAdmin, smLead, "QUOTATION")).status === 200);
  check("transition QUOTATION->WON 200", (await trans(tAdmin, smLead, "WON")).status === 200);
  check("transition from terminal WON->LOST 409", (await trans(tAdmin, smLead, "LOST", "x")).status === 409);
  const lostLead = await newLead(tAdmin, AG001.id);
  check("LOST without reason -> 400", (await trans(tAdmin, lostLead, "LOST")).status === 400);
  check("LOST with reason -> 200", (await trans(tAdmin, lostLead, "LOST", "price too high")).status === 200);
  const holdLead = await newLead(tAdmin, AG001.id);
  check("ON_HOLD without reason -> 400", (await trans(tAdmin, holdLead, "ON_HOLD")).status === 400);
  check("AGENT_OWN transition out-of-scope lead -> 403", (await trans(tOwn, outLead1.id, "CONTACTED")).status === 403);

  console.log("\n[crm] ===== Phase 2: LeadActivity + timeline =====");
  const actLead = await newLead(tOwn, AG001.id);
  const futureFu = new Date(Date.now() + 3 * 86400000).toISOString();
  const aCreate = await api("POST", "/leadActivity/create", tOwn, { leadId: actLead, type: "CALL", outcome: "spoke", notes: "called", nextFollowUpAt: futureFu });
  check("AGENT_OWN log activity on own lead -> 201", aCreate.status === 201, `got ${aCreate.status}`);
  const aList = await api("POST", "/leadActivity/byLead", tOwn, { leadId: actLead });
  check("byLead returns the activity", (aList.data || []).length === 1);
  check("activity set lead.nextFollowUpAt (UPCOMING)", (await api("POST", "/lead/getById", tOwn, { id: actLead })).data?.followUpStatus === "UPCOMING");
  check("AGENT_OWN log activity on out-of-scope lead -> 403", (await api("POST", "/leadActivity/create", tOwn, { leadId: outLead1.id, type: "CALL" })).status === 403);
  const tl = await api("POST", "/lead/timeline", tOwn, { id: actLead });
  check("timeline merges activity + audit", Array.isArray(tl.data) && tl.data.some((e: any) => e.source === "activity") && tl.data.some((e: any) => e.source === "audit"), `len ${tl.data?.length}`);

  console.log("\n[crm] ===== Phase 2: follow-up status (computed) =====");
  const overdue = await newLead(tAdmin, AG001.id, { nextFollowUpAt: new Date(Date.now() - 2 * 86400000).toISOString() });
  check("overdue lead -> followUpStatus OVERDUE", (await api("POST", "/lead/getById", tAdmin, { id: overdue })).data?.followUpStatus === "OVERDUE");
  check("lead carries computed probability", typeof (await api("POST", "/lead/getById", tAdmin, { id: overdue })).data?.probability === "number");

  console.log("\n[crm] ===== Phase 2: Visitor -> Lead =====");
  const vis = await prisma.visitor.create({ data: { name: `${QTAG}Visitor`, phone: "0300-1234567", purpose: "wants a smart lock", visitDate: new Date() } });
  const conv = await api("POST", "/lead/fromVisitor", tAdmin, { visitorId: vis.id });
  check("Visitor->Lead 201, stage NEW, visitorId set", conv.status === 201 && conv.data?.[0]?.stage === "NEW" && conv.data?.[0]?.visitorId === vis.id, `status ${conv.status}`);
  check("Visitor->Lead again -> 409 (already converted)", (await api("POST", "/lead/fromVisitor", tAdmin, { visitorId: vis.id })).status === 409);

  console.log("\n[crm] ===== Phase 3: quotation builder =====");
  const qc = await api("POST", "/quotation/create", tAdmin, {
    customerName: `${QTAG}QCust`,
    items: [{ description: "Item A", quantity: 2, unitPrice: 1000, lineDiscount: 100 }, { description: "Item B", quantity: 1, unitPrice: 5000, unitCost: 3000 }],
    discount: 200,
  });
  check("quotation create 201", qc.status === 201, `got ${qc.status}`);
  const qid = qc.data?.id;
  const qg = await api("POST", "/quotation/getById", tAdmin, { id: qid });
  check("persisted 2 line items", (qg.data?.items || []).length === 2, `got ${(qg.data?.items || []).length}`);
  check("totals: lineA=1900, subtotal=6900, total=6700", (qg.data?.items || []).some((i: any) => i.lineTotal === 1900) && qg.data?.subtotal === 6900 && qg.data?.total === 6700, `sub ${qg.data?.subtotal} tot ${qg.data?.total}`);
  check("quotationNo generated (Q-NNNN)", /^Q-\d{4}$/.test(qg.data?.quotationNo || ""), qg.data?.quotationNo);
  check("ADMIN sees margin", typeof qg.data?.margin === "number");
  const qgv = await api("POST", "/quotation/getById", tViewer, { id: qid });
  check("VIEWER (no cost) margin stripped + no unitCost", qgv.status === 200 && qgv.data?.margin === undefined && (qgv.data?.items || []).every((i: any) => !("unitCost" in i)));

  check("transition DRAFT->ACCEPTED invalid -> 409", (await api("POST", "/quotation/transition", tAdmin, { id: qid, to: "ACCEPTED" })).status === 409);
  check("transition SENT without items ok DRAFT->SENT -> 200", (await api("POST", "/quotation/transition", tAdmin, { id: qid, to: "SENT" })).status === 200);
  check("transition SENT->REJECTED no reason -> 400", (await api("POST", "/quotation/transition", tAdmin, { id: qid, to: "REJECTED" })).status === 400);

  const v2 = await api("POST", "/quotation/newVersion", tAdmin, { id: qid });
  check("newVersion -> 201 v2", v2.status === 201 && v2.data?.version === 2, `status ${v2.status} v ${v2.data?.version}`);
  const v2id = v2.data?.id;
  check("v1 isActive false after newVersion", (await api("POST", "/quotation/getById", tAdmin, { id: qid })).data?.isActive === false);
  check("v2 isActive true", (await api("POST", "/quotation/getById", tAdmin, { id: v2id })).data?.isActive === true);
  check("send v2 while v1 is SENT -> 409 (single active)", (await api("POST", "/quotation/transition", tAdmin, { id: v2id, to: "SENT" })).status === 409);

  const qpdf = await api("POST", "/quotation/pdf", tAdmin, { id: qid });
  check("quotation PDF -> 200", qpdf.status === 200, `got ${qpdf.status}`);

  // scope on quotation ops: AG004 quotation, AGENT_OWN cannot transition
  const outQ = await prisma.quotation.create({ data: { quotationNo: `${QTAG}${Date.now()}`, customerName: `${QTAG}out`, agentId: AG004.id, status: "DRAFT", company: "OKASHASMART" } });
  check("AGENT_OWN transition out-of-scope quotation -> 403", (await api("POST", "/quotation/transition", tOwn, { id: outQ.id, to: "SENT" })).status === 403);

  // ---- cleanup ----
  await cleanupFixtures();
  await prisma.featurePermission.deleteMany({ where: { id: { in: createdFP } } });
  await prisma.salesAgent.update({ where: { id: AG006.id }, data: { scope: "OWN" } }).catch(() => {});
  await prisma.salesAgent.update({ where: { id: AG001.id }, data: { teamLeadId: null } }).catch(() => {});
  await prisma.salesAgent.update({ where: { id: AG003.id }, data: { teamLeadId: null } }).catch(() => {});

  console.log(`\n[crm] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  if (fail) { console.log("FAILURES:\n - " + fails.join("\n - ")); }
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); try { await cleanupFixtures(); await prisma.featurePermission.deleteMany({ where: { id: { in: createdFP } } }); } catch {} process.exit(1); });
