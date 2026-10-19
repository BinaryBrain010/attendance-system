/**
 * Gate-pass status workflow + web-list harness. Local-only. Verifies the state machine
 * (approve/dispatch/return/close/reject/cancel + 409s), stock restock, status history, the
 * mobile status-mapping (existing endpoints stay APK-safe), webList filters, webDetail, and RBAC
 * gating. Self-cleaning (QA_GP_ prefixes). Run with the backend up on :3002 (RBAC_ENFORCE=on).
 *
 *   npx ts-node qa/gatePass.ts
 */
import bcrypt from "bcrypt";
import { api, mintGodToken, mintTokenFor, IS_LOCAL, QA_PASSWORD } from "./lib";
import prisma from "../src/core/models/base.model";

if (!IS_LOCAL) process.exit(2);
let pass = 0, fail = 0; const fails: string[] = [];
function check(n: string, c: boolean, e = "") { if (c) pass++; else { fail++; fails.push(`${n} ${e}`); console.log("  FAIL", n, e); } }

const TAG = "QA_GP_";
const god = mintGodToken();
const fpIds: string[] = [];
async function grant(userId: string, features: string[]) {
  const r = await prisma.featurePermission.create({ data: { parentType: "User", parentId: userId, permissions: { allowedFeatures: features } as any, createdAt: new Date() } });
  fpIds.push(r.id);
}

async function mkPass(customerId: string, itemId: string, vehicle = `${TAG}CAR1`) {
  const r = await api("POST", "/gatePass/create", god, {
    GatePass: { customerId, location: "QA Dock", vehicleNo: vehicle, storeIncharge: "QA Incharge", notes: `${TAG}note` },
    GatePassItem: [{ itemId, quantity: 2, serialNos: [`${TAG}S1`, `${TAG}S2`] }],
  });
  const g = Array.isArray(r.data) ? r.data[0] : r.data;
  return { status: r.status, id: g?.id as string };
}

async function main() {
  console.log("[gp] setup…");
  const cust = await prisma.customer.create({ data: { name: `${TAG}Cust`, createdAt: new Date() } });
  const item = await prisma.item.create({ data: { name: `${TAG}Item`, quantity: 10, unitPrice: 5, createdAt: new Date() } });

  console.log("[gp] ===== happy path: pending -> approved -> dispatched -> returned -> closed =====");
  const p = await mkPass(cust.id, item.id);
  check("create gate pass -> 200", p.status === 200, `status ${p.status}`);
  const id = p.id;
  check("created pass is pending", (await prisma.gatePass.findUnique({ where: { id } }))?.status === "pending");

  check("approve (existing endpoint) -> ok", (await api("POST", "/gatePass/approve", god, { id })).status === 200);
  const afterApprove = await prisma.item.findUnique({ where: { id: item.id } });
  check("approve decremented stock 10 -> 8", afterApprove?.quantity === 8, `got ${afterApprove?.quantity}`);

  check("dispatch -> ok", (await api("POST", "/gatePass/dispatch", god, { id })).status === 200);
  check("status is dispatched", (await prisma.gatePass.findUnique({ where: { id } }))?.status === "dispatched");

  check("return -> ok", (await api("POST", "/gatePass/return", god, { id })).status === 200);
  check("status is returned", (await prisma.gatePass.findUnique({ where: { id } }))?.status === "returned");
  const afterReturn = await prisma.item.findUnique({ where: { id: item.id } });
  check("return restocked 8 -> 10", afterReturn?.quantity === 10, `got ${afterReturn?.quantity}`);

  check("close (return+close) -> ok", (await api("POST", "/gatePass/return", god, { id, close: true })).status === 200);
  check("status is closed", (await prisma.gatePass.findUnique({ where: { id } }))?.status === "closed");

  console.log("[gp] ===== invalid transitions -> 409 =====");
  const p2 = await mkPass(cust.id, item.id);
  check("dispatch a PENDING pass -> 409", (await api("POST", "/gatePass/dispatch", god, { id: p2.id })).status === 409);
  check("return a PENDING pass -> 409", (await api("POST", "/gatePass/return", god, { id: p2.id })).status === 409);
  check("reject with no reason -> 400", (await api("POST", "/gatePass/reject", god, { id: p2.id, reason: "" })).status === 400);
  check("reject PENDING with reason -> ok", (await api("POST", "/gatePass/reject", god, { id: p2.id, reason: "bad paperwork" })).status === 200);
  check("status is rejected", (await prisma.gatePass.findUnique({ where: { id: p2.id } }))?.status === "rejected");
  check("reject an already-rejected pass -> 409", (await api("POST", "/gatePass/reject", god, { id: p2.id, reason: "again" })).status === 409);

  console.log("[gp] ===== cancel from approved restocks =====");
  const p3 = await mkPass(cust.id, item.id);
  await api("POST", "/gatePass/approve", god, { id: p3.id }); // 10 -> 8
  check("cancel needs reason -> 400", (await api("POST", "/gatePass/cancel", god, { id: p3.id })).status === 400);
  check("cancel approved with reason -> ok", (await api("POST", "/gatePass/cancel", god, { id: p3.id, reason: "customer changed mind" })).status === 200);
  check("cancel restocked back to 10", (await prisma.item.findUnique({ where: { id: item.id } }))?.quantity === 10, `got ${(await prisma.item.findUnique({ where: { id: item.id } }))?.quantity}`);

  console.log("[gp] ===== status history =====");
  const hist = await api("POST", "/gatePass/statusHistory", god, { id });
  const hrows: any[] = hist.data || [];
  check("history has rows with who/when/reason fields", hrows.length >= 4 && hrows.every((r) => r.toStatus && "reason" in r && "changedAt" in r), `rows ${hrows.length}`);
  check("history newest-first includes closed then returned", hrows[0]?.toStatus === "closed" && hrows.some((r) => r.toStatus === "returned"));

  console.log("[gp] ===== mobile mapping vs web real status =====");
  const p4 = await mkPass(cust.id, item.id);
  await api("POST", "/gatePass/approve", god, { id: p4.id });
  await api("POST", "/gatePass/dispatch", god, { id: p4.id }); // real = dispatched
  const mobile = await api("POST", "/gatePass/getById", god, { id: p4.id });
  check("mobile getById maps dispatched -> approved", (mobile.data?.status || mobile.data?.[0]?.status) === "approved", `got ${mobile.data?.status}`);
  const web = await api("POST", "/gatePass/webDetail", god, { id: p4.id });
  check("web detail keeps real status dispatched", web.data?.status === "dispatched", `got ${web.data?.status}`);
  check("web detail includes status history", Array.isArray(web.data?.history) && web.data.history.length >= 1);

  console.log("[gp] ===== webList filters =====");
  const byRejected = await api("POST", "/gatePass/webList", god, { status: "rejected", pageSize: 50 });
  const rejRows: any[] = byRejected.data?.data || [];
  check("webList status=rejected returns only rejected", rejRows.length > 0 && rejRows.every((r) => r.status === "rejected"));
  const bySearch = await api("POST", "/gatePass/webList", god, { search: `${TAG}CAR1`, pageSize: 50 });
  check("webList search by vehicle returns matches", (bySearch.data?.data || []).length > 0);

  console.log("[gp] ===== RBAC gating (new features) =====");
  const hash = await bcrypt.hash(QA_PASSWORD, 4);
  const u = await prisma.user.create({ data: { username: `${TAG}limited@test.local`, password: hash, createdAt: new Date() } });
  await grant(u.id, ["voucher.*"]); // has gate-pass read/create/approve but NOT gatePass.dispatch.*
  const uTok = mintTokenFor(u.id);
  const p5 = await mkPass(cust.id, item.id);
  await api("POST", "/gatePass/approve", god, { id: p5.id });
  check("user without gatePass.dispatch.* -> dispatch 403", (await api("POST", "/gatePass/dispatch", uTok, { id: p5.id })).status === 403);
  await grant(u.id, ["gatePass.dispatch.*"]);
  check("user WITH gatePass.dispatch.* -> dispatch 200", (await api("POST", "/gatePass/dispatch", mintTokenFor(u.id), { id: p5.id })).status === 200);

  console.log("[gp] ===== update guard (mobile edit path) =====");
  // The happy-path pass `id` ended CLOSED — editing it must be rejected.
  const upLocked = await api("PUT", "/gatePass/update", god, { id, GatePass: { location: "changed" }, GatePassItem: [] });
  check("update a closed pass -> 409", upLocked.status === 409, `status ${upLocked.status}`);
  check("update 409 says moved past approval", /moved past approval/i.test(upLocked.message || upLocked.text || ''));
  // A pending pass can be edited, but status is NEVER changed even if the body sends one.
  const pEdit = await mkPass(cust.id, item.id, `${TAG}EDIT`);
  const upOk = await api("PUT", "/gatePass/update", god, { id: pEdit.id, GatePass: { status: 'approved', location: 'Edited Dock' }, GatePassItem: [{ itemId: item.id, quantity: 1, serialNos: [`${TAG}E1`] }] });
  check("update a pending pass -> 200", upOk.status === 200, `status ${upOk.status}`);
  const edited = await prisma.gatePass.findUnique({ where: { id: pEdit.id } });
  check("update did NOT change status (still pending)", edited?.status === 'pending', `got ${edited?.status}`);
  check("update applied the editable field", edited?.location === 'Edited Dock');

  console.log(`\n[gp] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  if (fail) console.log("FAILURES:\n" + fails.map((f) => "  - " + f).join("\n"));
  await cleanup();
  process.exit(fail ? 1 : 0);
}

async function cleanup() {
  try {
    const passes = await prisma.gatePass.findMany({ where: { OR: [{ vehicleNo: { startsWith: TAG } }, { storeIncharge: "QA Incharge" }, { notes: { startsWith: TAG } }] }, select: { id: true } });
    const pids = passes.map((x) => x.id);
    if (pids.length) {
      await prisma.gatePassStatusHistory.deleteMany({ where: { gatePassId: { in: pids } } }).catch(() => {});
      await prisma.gatePassItem.deleteMany({ where: { gatePassId: { in: pids } } }).catch(() => {});
      await prisma.gatePass.deleteMany({ where: { id: { in: pids } } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { entity: "GatePass", entityId: { in: pids } } }).catch(() => {});
    for (const fp of fpIds) await prisma.featurePermission.delete({ where: { id: fp } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } }).catch(() => {});
    await prisma.item.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
  } catch (e) { console.error("cleanup error", e); }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); });
