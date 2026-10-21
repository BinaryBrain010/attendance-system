/**
 * List-paging sweep. A throwaway QA_ admin (broad read grants) pages through EVERY list endpoint
 * (page 1, 2, a deep page past the data, plus a sort and a search variant) and FAILS on any 500 /
 * network error. Catches pagination/sort/filter crashes across modules and roles. Local-only; cleans
 * up its QA_ user. Run: `npm run qa:listpaging`.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";
import { http, login, QA_PASSWORD, QA_EMAIL_DOMAIN } from "./lib";
const routes: any = JSON.parse(fs.readFileSync(path.join(__dirname, "_routes.json"), "utf8"));

// Two personas: a broad admin (exercises every list) and a LIMITED non-admin (RBAC paths can 500
// differently from a god/all-access token — a 403 is fine, a 500 is a bug).
const PERSONAS: { slug: string; features: string[] }[] = [
  {
    slug: "QA_pg_admin" + QA_EMAIL_DOMAIN,
    features: [
      "login.admin.*", "appModules.*",
      "user.*", "role.*", "group.*", "groupRole.*", "featurePermission.*", "appFeature.*", "setting.*",
      "employee.*", "attendance.*", "attendanceReq.*", "leave.*", "leaveReq.*", "leaveAlloc.*", "leaveConfig.*",
      "holiday.*", "unit.*", "shift.*", "systemConfig.*", "activityLog.*",
      "customer.*", "item.*", "voucher.*", "gatePass.*", "visitor.*",
      "crm.*", "work.*", "audit.*", "analytics.*", "notification.*",
    ],
  },
  {
    slug: "QA_pg_limited" + QA_EMAIL_DOMAIN,
    features: [
      "login.admin.*", "appModules.quickPass.*", "appModules.crm.*",
      "voucher.read.*", "customer.read.*", "item.read.*",
      "crm.lead.read.own.*", "crm.quotation.read.own.*", "crm.order.read.own.*",
      "employee.read.*", "attendance.read.*",
    ],
  },
];

async function purge(uid: string) {
  await prisma.loggedInUsers.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: uid } }).catch(() => {});
  await prisma.user.delete({ where: { id: uid } }).catch(() => {});
}

interface R { method: string; path: string }
function listEndpoints(): R[] {
  const arr: any[] = Array.isArray(routes) ? (routes as any) : ((routes as any).routes || []);
  const rx = /(\/get|\/getAll|\/getDeleted|\/list|\/webList|\/report)$/i;
  const seen = new Set<string>();
  const out: R[] = [];
  for (const x of arr) {
    const method = (x.method || "").toUpperCase();
    const path = x.path || x.route || "";
    if (!rx.test(path)) continue;
    if (!["GET", "POST"].includes(method)) continue;
    const key = method + " " + path;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method, path });
  }
  return out;
}

function variants(path: string): Record<string, any>[] {
  const isSearch = /\/search$/i.test(path);
  const base: Record<string, any>[] = [
    { page: 1, pageSize: 15 },
    { page: 2, pageSize: 15 },
    { page: 9999, pageSize: 15 },
    { page: 1, pageSize: 15, sortBy: "username", sortOrder: "asc" },
    { page: 1, pageSize: 15, search: "a" },
  ];
  if (isSearch) return base.map((v) => ({ ...v, searchTerm: ["a"] }));
  return base;
}

const toQuery = (o: Record<string, any>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`).join("&");

async function sweepAs(persona: { slug: string; features: string[] }, endpoints: R[]) {
  const existing = await prisma.user.findFirst({ where: { username: persona.slug } });
  if (existing) await purge(existing.id);
  const hash = await bcrypt.hash(QA_PASSWORD, 4);
  const u = await prisma.user.create({ data: { username: persona.slug, password: hash, createdAt: new Date() } });
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: persona.features } as any, createdAt: new Date() } });

  const token = (await login(persona.slug, QA_PASSWORD, "Admin", true)).token;
  const failures: { endpoint: string; variant: string; status: number; body: string }[] = [];
  let calls = 0;
  if (!token) { await purge(u.id); return { calls, failures: [{ endpoint: "(login)", variant: "", status: 0, body: "login failed" }] }; }

  for (const ep of endpoints) {
    for (const v of variants(ep.path)) {
      calls++;
      const res = ep.method === "GET" ? await http("GET", `${ep.path}?${toQuery(v)}`, { token }) : await http("POST", ep.path, { token, body: v });
      if (res.status === 500 || res.status === 0) {
        failures.push({ endpoint: `${ep.method} ${ep.path}`, variant: JSON.stringify(v), status: res.status, body: (res.json?.message || res.text || "").toString().slice(0, 160) });
      }
    }
  }
  await purge(u.id);
  return { calls, failures };
}

/**
 * Orphan-relation case: the client's prod 500 is likely a data shape not present locally. Create a
 * QA_ employee + a user linked to it + a leave request for it, then SOFT-DELETE the employee, and a
 * second user with no employee (employeeId null). Then page the users + leave-request lists and read
 * a user's detail — assert none 500 on these edge relations. Cleans up everything it makes.
 */
async function orphanCase(): Promise<{ failures: string[] }> {
  const failures: string[] = [];
  const stamp = Date.now();
  const hash = await bcrypt.hash(QA_PASSWORD, 4);
  const emp = await prisma.employee.create({ data: {
    name: "QA", surname: "Orphan", address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"),
    bloodGroup: "O+", contactNo: "00000000000", designation: "QA", department: "QA", martialStatus: "SINGLE",
    company: "OKASHASMART" as any, code: `QA_ORPH_${stamp}`,
  } });
  const uLinked = await prisma.user.create({ data: { username: `QA_orph_linked_${stamp}${QA_EMAIL_DOMAIN}`, password: hash, employeeId: emp.id, createdAt: new Date() } });
  const uNoEmp = await prisma.user.create({ data: { username: `QA_orph_noemp_${stamp}${QA_EMAIL_DOMAIN}`, password: hash, employeeId: null, createdAt: new Date() } });
  const lr = await prisma.leaveRequest.create({ data: { employeeId: emp.id, startDate: new Date(), endDate: new Date(Date.now() + 864e5), status: "PENDING" as any } });
  await prisma.employee.update({ where: { id: emp.id }, data: { isDeleted: new Date() } }); // orphan: soft-deleted employee still referenced

  // broad admin token
  const admin = PERSONAS[0];
  const existing = await prisma.user.findFirst({ where: { username: admin.slug } });
  let aUid: string;
  if (existing) { aUid = existing.id; } else {
    const au = await prisma.user.create({ data: { username: admin.slug, password: hash, createdAt: new Date() } });
    await prisma.featurePermission.create({ data: { parentType: "User", parentId: au.id, permissions: { allowedFeatures: admin.features } as any, createdAt: new Date() } });
    aUid = au.id;
  }
  if (!existing) { /* created above */ } else {
    await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: aUid } });
    await prisma.featurePermission.create({ data: { parentType: "User", parentId: aUid, permissions: { allowedFeatures: admin.features } as any, createdAt: new Date() } });
  }
  const token = (await login(admin.slug, QA_PASSWORD, "Admin", true)).token;

  const checks: Array<[string, Promise<any>]> = [
    ["GET /user/get", http("GET", "/user/get?page=1&pageSize=50", { token })],
    ["GET /leaveReq/get", http("GET", "/leaveReq/get?page=1&pageSize=50", { token })],
    ["POST /leaveReq/get", http("POST", "/leaveReq/get", { token, body: { page: 1, pageSize: 50 } })],
    ["POST /user/getById (no-emp user)", http("POST", "/user/getById", { token, body: { id: uNoEmp.id } })],
    ["POST /user/getById (orphan-emp user)", http("POST", "/user/getById", { token, body: { id: uLinked.id } })],
  ];
  for (const [label, p] of checks) { const r = await p; if (r.status === 500 || r.status === 0) failures.push(`${label} -> ${r.status} ${(r.json?.message || r.text || "").toString().slice(0, 120)}`); }

  // cleanup
  await prisma.leaveRequest.delete({ where: { id: lr.id } }).catch(() => {});
  await prisma.loggedInUsers.deleteMany({ where: { userId: { in: [uLinked.id, uNoEmp.id, aUid] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [uLinked.id, uNoEmp.id] } } }).catch(() => {});
  await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: aUid } }).catch(() => {});
  await prisma.user.delete({ where: { id: aUid } }).catch(() => {});
  await prisma.employee.delete({ where: { id: emp.id } }).catch(() => {});
  return { failures };
}

const MAX_BYTES = 1024 * 1024; // 1MB per page-of-25 (blob columns must never ride along in lists)
async function sizeCheck(persona: { slug: string; features: string[] }, endpoints: R[]) {
  const existing = await prisma.user.findFirst({ where: { username: persona.slug } });
  if (existing) await purge(existing.id);
  const hash = await bcrypt.hash(QA_PASSWORD, 4);
  const u = await prisma.user.create({ data: { username: persona.slug, password: hash, createdAt: new Date() } });
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: persona.features } as any, createdAt: new Date() } });
  const token = (await login(persona.slug, QA_PASSWORD, "Admin", true)).token;
  const over: { endpoint: string; bytes: number }[] = [];
  if (token) {
    for (const ep of endpoints) {
      const v = { page: 1, pageSize: 25 };
      const res = ep.method === "GET" ? await http("GET", `${ep.path}?${toQuery(v)}`, { token }) : await http("POST", ep.path, { token, body: v });
      const bytes = Buffer.byteLength(res.text || "", "utf8");
      if (bytes > MAX_BYTES) over.push({ endpoint: `${ep.method} ${ep.path}`, bytes });
    }
  }
  await purge(u.id);
  return over;
}

async function run() {
  const endpoints = listEndpoints();
  let totalFail = 0;
  console.log(`\n=== List-paging sweep (${endpoints.length} list endpoints) ===`);
  for (const p of PERSONAS) {
    const { calls, failures } = await sweepAs(p, endpoints);
    totalFail += failures.length;
    console.log(`\n  [${p.slug}]  calls: ${calls}  failures(500/err): ${failures.length}`);
    for (const f of failures) console.log(`    FAIL ${f.endpoint}  ${f.variant}  -> ${f.status}  ${f.body}`);
    if (!failures.length) console.log("    all list endpoints paged without a 500.");
  }

  const orphan = await orphanCase();
  totalFail += orphan.failures.length;
  console.log(`\n  [orphan relations] failures: ${orphan.failures.length}`);
  for (const f of orphan.failures) console.log(`    FAIL ${f}`);
  if (!orphan.failures.length) console.log("    users/leave lists + user detail survive orphan/null-employee relations.");

  const over = await sizeCheck(PERSONAS[0], endpoints);
  totalFail += over.length;
  console.log(`\n  [payload size] lists over 1MB for a page of 25: ${over.length}`);
  for (const o of over) console.log(`    BLOAT ${o.endpoint}  ${(o.bytes / 1048576).toFixed(2)}MB`);
  if (!over.length) console.log("    no list page exceeds 1MB.");

  process.exit(totalFail ? 1 : 0);
}

run().catch(async (e) => { console.error("[qa:listpaging] error", e); process.exit(1); });
