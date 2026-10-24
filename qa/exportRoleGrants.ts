/**
 * READ-ONLY export of every Role and Group with its FeaturePermission allowedFeatures, group→role
 * links and member counts. SELECT only — it never writes. Produces a JSON file you hand back so the
 * RBAC-enforce preflight (`qa:enforceprep --grants=<file>`) can run against prod's REAL grants
 * instead of the local DB's.
 *
 *   npx ts-node qa/exportRoleGrants.ts                       (local DB)
 *   npx ts-node qa/exportRoleGrants.ts --allow-remote        (prod — required when DB host is remote)
 *   npx ts-node qa/exportRoleGrants.ts --out=prodGrants.json (custom output path)
 *
 * Safe on prod: no inserts/updates/deletes, no env changes.
 */
import fs from "fs";
import path from "path";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[exportRoleGrants] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`);
  process.exit(2);
}

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : path.join(__dirname, "_roleGrants.json");

/** Union the allowedFeatures across every (non-deleted) FeaturePermission row for a parent. */
function unionAllowed(rows: { permissions: any }[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const arr: unknown = (r.permissions as any)?.allowedFeatures;
    if (Array.isArray(arr)) for (const f of arr) if (typeof f === "string" && f) s.add(f);
  }
  return [...s].sort();
}

async function main() {
  const roles = await prisma.role.findMany({ where: { isDeleted: null } as any, select: { id: true, name: true } });
  const groups = await prisma.group.findMany({ where: { isDeleted: null } as any, select: { id: true, name: true } });
  const parentIds = [...roles.map((r) => r.id), ...groups.map((g) => g.id)];

  const fps = await prisma.featurePermission.findMany({
    where: { parentId: { in: parentIds }, isDeleted: null } as any,
    select: { parentId: true, permissions: true },
  });
  const byParent = new Map<string, { permissions: any }[]>();
  for (const fp of fps) { if (!byParent.has(fp.parentId)) byParent.set(fp.parentId, []); byParent.get(fp.parentId)!.push(fp); }

  const groupRoles = await prisma.groupRole.findMany({ where: { isDeleted: null } as any, select: { groupId: true, roleId: true } });
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
  const rolesForGroup = new Map<string, string[]>();
  for (const gr of groupRoles) {
    const name = roleNameById.get(gr.roleId);
    if (!name) continue;
    if (!rolesForGroup.has(gr.groupId)) rolesForGroup.set(gr.groupId, []);
    rolesForGroup.get(gr.groupId)!.push(name);
  }

  const roleOut = [] as any[];
  for (const r of roles) {
    const memberCount = await prisma.userRole.count({ where: { roleId: r.id, active: true, isDeleted: null } as any });
    roleOut.push({ id: r.id, name: r.name, allowedFeatures: unionAllowed(byParent.get(r.id) || []), memberCount });
  }
  const groupOut = [] as any[];
  for (const g of groups) {
    const memberCount = await prisma.userGroup.count({ where: { groupId: g.id, active: true, isDeleted: null } as any });
    groupOut.push({
      id: g.id, name: g.name,
      allowedFeatures: unionAllowed(byParent.get(g.id) || []),
      roleNames: (rolesForGroup.get(g.id) || []).sort(),
      memberCount,
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    host, // which DB this came from (sanity only; no credentials)
    counts: { roles: roleOut.length, groups: groupOut.length },
    roles: roleOut.sort((a, b) => a.name.localeCompare(b.name)),
    groups: groupOut.sort((a, b) => a.name.localeCompare(b.name)),
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[exportRoleGrants] host=${host} roles=${roleOut.length} groups=${groupOut.length} -> ${outPath}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
