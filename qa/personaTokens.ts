/**
 * READ-ONLY dev helper for browser QA of the app launcher. For each distinct role profile it finds a
 * representative real user, mints a short-lived JWT (no password, no DB writes), asks the live backend
 * webhook for that user's real permissions, and classifies which launcher tiles they would see.
 * Prints a token per chosen persona so it can be dropped into the admin's `auth_token` cookie.
 *
 *   npx ts-node qa/personaTokens.ts            # against the backend on :3002
 */
import "dotenv/config";
import jwt from "jsonwebtoken";
import prisma from "../src/core/models/base.model";

// Safety: this helper mints login tokens for real users, so it must only ever run against a LOCAL dev
// database — never a remote/production DATABASE_URL.
const DB = process.env.DATABASE_URL || "";
const DB_HOST = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(DB_HOST)) {
  console.error(`[personaTokens] REFUSING — DATABASE_URL host "${DB_HOST}" is not local. This helper only runs against a local dev DB.`);
  process.exit(2);
}

const API = process.env.QA_API || "http://localhost:3002";
const SECRET = process.env.JWT_SECRET!;
const mint = (userId: string) => jwt.sign({ userId, unitIds: [] }, SECRET, { expiresIn: "3h" });

// Mirror of the frontend wildcard check (incl. the appModules.* special cases) so the tile set we
// print matches what the launcher will actually render.
function has(perms: string[], req: string): boolean {
  if (perms.includes(req)) return true;
  const explicitOnly = [
    "appModules.quickMark.*", "appModules.quickPass.*", "appModules.accessControl.*",
    "appModules.frontdesk.*", "appModules.crm.*",
  ];
  if (explicitOnly.includes(req)) return perms.includes(req);
  for (const p of perms) {
    if (p.endsWith(".*")) {
      const base = p.slice(0, -2);
      if (req.startsWith(base + ".") || req === base) return true;
    }
    if (req.endsWith(".*")) {
      const base = req.slice(0, -2);
      if (p.startsWith(base + ".") || p === base) return true;
    }
  }
  return false;
}

function tilesFor(perms: string[]): string[] {
  const h = (r: string) => has(perms, r);
  const tiles: string[] = [];
  if (h("analytics.*")) tiles.push("Analytics");
  if (h("user.*") || h("role.*") || h("group.*")) tiles.push("Access Control");
  if (h("employee.*") || h("attendance.*") || h("attendanceReq.read.*") || h("leave.*") || h("holiday.*") || h("unit.*") || h("shift.*")) tiles.push("Quick Mark");
  if (h("appModules.frontdesk.*") || h("visitor.*")) tiles.push("Frontdesk");
  if (h("crm.lead.read.own.*") || h("crm.quotation.read.own.*") || h("crm.order.read.own.*") || h("crm.return.read.own.*") || h("crm.catalogue.read.*") || h("crm.agent.read.*") || h("crm.report.read.*")) tiles.push("CRM");
  if (h("appModules.work.*") && (h("work.task.read.own.*") || h("work.report.read.own.*") || h("work.team.read.*"))) tiles.push("Work");
  if (h("audit.read.*")) tiles.push("Settings");
  tiles.push("Help"); // utility, always
  return tiles;
}

async function fetchPerms(token: string): Promise<string[]> {
  try {
    const r = await fetch(`${API}/webhook/permissions?token=${encodeURIComponent(token)}`);
    const j: any = await r.json();
    return Array.isArray(j?.data) ? j.data : [];
  } catch (e) {
    return [];
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isDeleted: null },
    select: {
      id: true, username: true,
      userRoles: { where: { isDeleted: null, active: true }, select: { role: { select: { name: true } } } },
      userGroups: { where: { isDeleted: null, active: true }, select: { group: { select: { name: true } } } },
    },
    orderBy: { username: "asc" },
  });

  // One representative per distinct role+group signature (groups also carry roles/permissions).
  const seen = new Map<string, typeof users[number]>();
  for (const u of users) {
    const roles = u.userRoles.map((r) => r.role.name).sort().join("+") || "(no roles)";
    const groups = u.userGroups.map((g) => g.group.name).sort().join("+") || "(no groups)";
    const sig = `${roles} | grp:${groups}`;
    if (!seen.has(sig)) seen.set(sig, u);
  }

  console.log(`[personaTokens] ${users.length} users, ${seen.size} distinct role profiles. API=${API}\n`);
  const rows: { username: string; sig: string; tiles: string[]; id: string; token: string }[] = [];
  for (const [sig, u] of seen) {
    const token = mint(u.id);
    const perms = await fetchPerms(token);
    const tiles = tilesFor(perms);
    const moduleTiles = tiles.filter((t) => t !== "Help");
    rows.push({ username: u.username, sig, tiles, id: u.id, token });
    console.log(`• ${u.username}`);
    console.log(`    roles : ${sig}`);
    console.log(`    perms : ${perms.length}`);
    console.log(`    tiles : ${tiles.join(", ")}  (${moduleTiles.length} module app${moduleTiles.length === 1 ? " -> opens directly" : "s"})`);
  }

  // Suggest a persona for each scenario the QA asks for.
  const pick = (want: (t: string[]) => boolean) => rows.find((r) => want(r.tiles.filter((x) => x !== "Help")));
  const admin = pick((t) => t.length >= 6);
  const sales = pick((t) => t.length === 2 && t.includes("CRM") && t.includes("Work"));
  const employee = pick((t) => t.length === 1 && t.includes("Work"));

  // Also probe the GOD/admin user directly.
  const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
  const godUser = await prisma.user.findUnique({ where: { id: GOD_ID }, select: { username: true } });
  if (godUser) {
    const token = mint(GOD_ID);
    const perms = await fetchPerms(token);
    const tiles = tilesFor(perms);
    console.log(`\n• [GOD] ${godUser.username}`);
    console.log(`    perms : ${perms.length}`);
    console.log(`    tiles : ${tiles.join(", ")}`);
    rows.push({ username: godUser.username, sig: "GOD", tiles, id: GOD_ID, token });
  } else {
    console.log(`\n• [GOD] user ${GOD_ID} not found`);
  }

  console.log("\n===== SUGGESTED PERSONAS (auth_token cookie values) =====");
  for (const [name, r] of [["ADMIN", admin], ["SALES (CRM+Work)", sales], ["EMPLOYEE (Work only)", employee]] as const) {
    if (r) {
      console.log(`\n## ${name}: ${r.username}  [${r.tiles.join(", ")}]`);
      console.log(r.token);
    } else {
      console.log(`\n## ${name}: no exact match found among real users`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
