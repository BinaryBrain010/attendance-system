/**
 * RBAC enforcement impact: for every real role/group/user, which mapped endpoints they would LOSE
 * (be denied) once RBAC_ENFORCE=on. Replicates the union resolver + parent rule directly against the
 * DB, so it can be run against a pg_dump restored locally.
 *
 *   npx ts-node qa/impact.ts                 # against the default DATABASE_URL
 *   IMPACT_DB_URL=postgresql://... npx ts-node qa/impact.ts   # against a restored copy
 *
 * Writes qa/RBAC_Impact_Report.md and prints a summary.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
const MAP: Record<string, { access: string; feature: string; kind: string }> =
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "middleware", "rbac", "featureMap.json"), "utf8"));
const ROUTES = Object.entries(MAP).map(([k, v]) => ({ route: k, ...v }));

const url = process.env.IMPACT_DB_URL || process.env.DATABASE_URL;
const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

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

async function fpFeatures(parentType: string, parentIds: string[], into: Set<string>) {
  if (!parentIds.length) return;
  const fps = await db.featurePermission.findMany({ where: { parentType: parentType as any, parentId: { in: parentIds }, isDeleted: null } });
  for (const fp of fps) {
    const af = (fp as any).permissions?.allowedFeatures;
    if (Array.isArray(af)) for (const f of af) into.add(f);
  }
}

async function effectiveFeatures(userId: string): Promise<Set<string>> {
  const set = new Set<string>();
  await fpFeatures("User", [userId], set);
  const ugs = await db.userGroup.findMany({ where: { userId, isDeleted: null }, select: { groupId: true } });
  const groupIds = Array.from(new Set(ugs.map((g) => g.groupId)));
  await fpFeatures("Group", groupIds, set);
  const urs = await db.userRole.findMany({ where: { userId, isDeleted: null }, select: { roleId: true } });
  const grs = groupIds.length ? await db.groupRole.findMany({ where: { groupId: { in: groupIds }, isDeleted: null }, select: { roleId: true } }) : [];
  const roleIds = Array.from(new Set([...urs.map((r) => r.roleId), ...grs.map((r) => r.roleId)]));
  await fpFeatures("Role", roleIds, set);
  return set;
}

// would this user be ALLOWED on this route under enforce=on? (static approximation for self/dynamic)
function allowed(r: { access: string; feature: string }, set: Set<string>, hasEmployee: boolean): "yes" | "no" | "self" | "cond" {
  switch (r.access) {
    case "open":
    case "token": return "yes";
    case "god": return "no";
    case "self": return hasEmployee ? "self" : (holds(set, r.feature) ? "yes" : "no"); // own record -> yes; else needs feature
    case "dynamic": return (holds(set, "user.update.*") || holds(set, "role.update.*") || holds(set, "group.update.*")) ? "cond" : "no";
    default: return holds(set, r.feature) ? "yes" : "no";
  }
}

async function main() {
  const target = url ? url.replace(/:[^:@/]+@/, ":***@") : "(default)";
  const users = await db.user.findMany({ where: { isDeleted: null, NOT: { username: { startsWith: "qa." } } }, select: { id: true, username: true, employeeId: true } });
  const roles = await db.role.findMany({ where: { isDeleted: null }, select: { id: true, name: true } });
  const groups = await db.group.findMany({ where: { isDeleted: null }, select: { id: true, name: true } });

  // enforce-relevant routes (exclude open/token which never lose access)
  const enforceable = ROUTES.filter((r) => r.access !== "open" && r.access !== "token");

  // per-user impact
  const perUser: { username: string; features: number; denied: number; selfOnly: number; sampleDenied: string[] }[] = [];
  const routeLostBy: Record<string, number> = {};
  for (const u of users) {
    const set = u.id === GOD_ID ? null : await effectiveFeatures(u.id);
    let denied = 0, selfOnly = 0; const sample: string[] = [];
    for (const r of enforceable) {
      if (u.id === GOD_ID) continue; // god keeps everything
      const a = allowed(r, set!, !!u.employeeId);
      if (a === "no") { denied++; if (sample.length < 8) sample.push(r.route); routeLostBy[r.route] = (routeLostBy[r.route] || 0) + 1; }
      else if (a === "self") selfOnly++;
    }
    perUser.push({ username: u.username, features: set ? set.size : -1, denied, selfOnly, sampleDenied: sample });
  }

  // per-role / per-group feature coverage
  const roleCov = [] as { name: string; features: number; routesCovered: number }[];
  for (const role of roles) {
    const set = new Set<string>(); await fpFeatures("Role", [role.id], set);
    const cov = enforceable.filter((r) => r.access === "feature" && holds(set, r.feature)).length;
    roleCov.push({ name: role.name, features: set.size, routesCovered: cov });
  }
  const groupCov = [] as { name: string; features: number; routesCovered: number }[];
  for (const g of groups) {
    const set = new Set<string>(); await fpFeatures("Group", [g.id], set);
    // include roles-in-group
    const grs = await db.groupRole.findMany({ where: { groupId: g.id, isDeleted: null }, select: { roleId: true } });
    await fpFeatures("Role", grs.map((x) => x.roleId), set);
    const cov = enforceable.filter((r) => r.access === "feature" && holds(set, r.feature)).length;
    groupCov.push({ name: g.name, features: set.size, routesCovered: cov });
  }

  // report
  let md = `# RBAC enforcement impact report\n\nTarget DB: ${target}\nReal users: ${users.length} | roles: ${roles.length} | groups: ${groups.length}\nEnforceable routes (excl. open/token): ${enforceable.length} of ${ROUTES.length}\n\n`;
  md += `A user "loses" a route under RBAC_ENFORCE=on when they do not hold the mapped feature (or, for self routes, are not linked to an employee). god keeps everything. Dynamic (featurePermission) routes depend on the request body and are approximated.\n\n`;
  md += `## Per-user impact (sorted by most endpoints lost)\n\n| User | Effective features | Endpoints lost | Self-only (own record) |\n|---|---|---|---|\n`;
  perUser.sort((a, b) => b.denied - a.denied);
  for (const u of perUser) md += `| ${u.username} | ${u.features < 0 ? "god (all)" : u.features} | ${u.denied} | ${u.selfOnly} |\n`;
  md += `\n## Users who would lose the most (with a sample of lost routes)\n\n`;
  for (const u of perUser.slice(0, 15)) if (u.denied) md += `- **${u.username}** loses ${u.denied}: ${u.sampleDenied.join(", ")}${u.denied > u.sampleDenied.length ? " …" : ""}\n`;
  md += `\n## Per-role feature coverage (feature routes a role alone grants)\n\n| Role | Features | Feature-routes covered |\n|---|---|---|\n`;
  roleCov.sort((a, b) => b.routesCovered - a.routesCovered);
  for (const r of roleCov) md += `| ${r.name} | ${r.features} | ${r.routesCovered} |\n`;
  md += `\n## Per-group coverage (own + roles-in-group)\n\n| Group | Features | Feature-routes covered |\n|---|---|---|\n`;
  groupCov.sort((a, b) => b.routesCovered - a.routesCovered);
  for (const g of groupCov) md += `| ${g.name} | ${g.features} | ${g.routesCovered} |\n`;

  fs.writeFileSync(path.join(__dirname, "RBAC_Impact_Report.md"), md);
  const totalLost = perUser.reduce((a, u) => a + (u.features >= 0 ? u.denied : 0), 0);
  const usersLosingSomething = perUser.filter((u) => u.features >= 0 && u.denied > 0).length;
  console.log(`[impact] target=${target}`);
  console.log(`[impact] users=${users.length} roles=${roles.length} groups=${groups.length} enforceableRoutes=${enforceable.length}`);
  console.log(`[impact] users who lose >=1 endpoint: ${usersLosingSomething}/${users.length}; total (user,route) losses: ${totalLost}`);
  console.log(`[impact] top losers:`, perUser.slice(0, 5).map((u) => `${u.username}(${u.denied})`).join(", "));
  console.log(`[impact] wrote qa/RBAC_Impact_Report.md`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
