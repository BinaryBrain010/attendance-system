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

const SLUG = "QA_pg_admin" + QA_EMAIL_DOMAIN;
// Broad read grants so RBAC permits every list (mirrors a full admin, without god bypass).
const FEATURES = [
  "login.admin.*", "appModules.*",
  "user.*", "role.*", "group.*", "groupRole.*", "featurePermission.*", "appFeature.*", "setting.*",
  "employee.*", "attendance.*", "attendanceReq.*", "leave.*", "leaveReq.*", "leaveAlloc.*", "leaveConfig.*",
  "holiday.*", "unit.*", "shift.*", "systemConfig.*", "activityLog.*",
  "customer.*", "item.*", "voucher.*", "gatePass.*", "visitor.*",
  "crm.*", "work.*", "audit.*", "analytics.*", "notification.*",
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

async function run() {
  // fixture
  const existing = await prisma.user.findFirst({ where: { username: SLUG } });
  if (existing) await purge(existing.id);
  const hash = await bcrypt.hash(QA_PASSWORD, 4);
  const u = await prisma.user.create({ data: { username: SLUG, password: hash, createdAt: new Date() } });
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: FEATURES } as any, createdAt: new Date() } });

  const token = (await login(SLUG, QA_PASSWORD, "Admin", true)).token;
  if (!token) { console.error("login failed"); await purge(u.id); process.exit(2); }

  const endpoints = listEndpoints();
  const failures: { endpoint: string; variant: string; status: number; body: string }[] = [];
  let calls = 0;

  for (const ep of endpoints) {
    for (const v of variants(ep.path)) {
      calls++;
      let res;
      if (ep.method === "GET") res = await http("GET", `${ep.path}?${toQuery(v)}`, { token });
      else res = await http("POST", ep.path, { token, body: v });
      // 500 or network error (0) = fail. 4xx (incl 403/400) is not a crash.
      if (res.status === 500 || res.status === 0) {
        failures.push({ endpoint: `${ep.method} ${ep.path}`, variant: JSON.stringify(v), status: res.status, body: (res.json?.message || res.text || "").toString().slice(0, 160) });
      }
    }
  }

  await purge(u.id);

  console.log(`\n=== List-paging sweep ===`);
  console.log(`  endpoints: ${endpoints.length}  calls: ${calls}  failures(500/err): ${failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f.endpoint}  ${f.variant}  -> ${f.status}  ${f.body}`);
  if (!failures.length) console.log("  all list endpoints paged without a 500.");
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (e) => { console.error("[qa:listpaging] error", e); process.exit(1); });
