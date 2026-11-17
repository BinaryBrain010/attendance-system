/**
 * READ-ONLY export of every Role and Group with its FeaturePermission allowedFeatures, group→role
 * links and member counts. SELECT only — it never writes. Produces a JSON file you hand back so the
 * RBAC-enforce preflight (`qa:enforceprep --grants=<file>`) can run against prod's REAL grants
 * instead of the local DB's.
 *
 *   npx ts-node qa/exportRoleGrants.ts                       (local DB -> OS temp dir, outside the repo)
 *   npx ts-node qa/exportRoleGrants.ts --allow-remote        (prod — required when DB host is remote)
 *   npx ts-node qa/exportRoleGrants.ts --out=/path/prodGrants.json  (custom output path, outside the repo)
 *
 * Per role it dumps: id, name, allowedFeatures, the groups that grant it (groupNames), the direct
 * member count, and the DISTINCT effective user count (direct userRole + via any granting group).
 * Default output is the OS temp dir so a prod dump never lands in the working tree. Safe on prod:
 * SELECT only — no inserts/updates/deletes, no env changes.
 */
import fs from "fs";
import path from "path";
import os from "os";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[exportRoleGrants] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`);
  process.exit(2);
}

// Default OUTSIDE the repo (OS temp dir) so the prod dump is never written into the working tree or
// accidentally committed; override with --out=<abs path>. The filename carries the host + date.
const outArg = process.argv.find((a) => a.startsWith("--out="));
const defaultOut = path.join(os.tmpdir(), `solarmax-roleGrants-${new Date().toISOString().slice(0, 10)}.json`);
const outPath = outArg ? outArg.slice("--out=".length) : defaultOut;

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
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const rolesForGroup = new Map<string, string[]>(); // groupId -> role names
  const groupsForRole = new Map<string, string[]>(); // roleId  -> group names (the role's groups)
  const groupIdsForRole = new Map<string, string[]>();
  for (const gr of groupRoles) {
    const rName = roleNameById.get(gr.roleId);
    const gName = groupNameById.get(gr.groupId);
    if (rName) { if (!rolesForGroup.has(gr.groupId)) rolesForGroup.set(gr.groupId, []); rolesForGroup.get(gr.groupId)!.push(rName); }
    if (gName) { if (!groupsForRole.has(gr.roleId)) groupsForRole.set(gr.roleId, []); groupsForRole.get(gr.roleId)!.push(gName); }
    if (!groupIdsForRole.has(gr.roleId)) groupIdsForRole.set(gr.roleId, []);
    groupIdsForRole.get(gr.roleId)!.push(gr.groupId);
  }

  const roleOut = [] as any[];
  for (const r of roles) {
    // Distinct users who hold this role directly (userRole) OR via a group that grants it (userGroup).
    const directUsers = await prisma.userRole.findMany({ where: { roleId: r.id, active: true, isDeleted: null } as any, select: { userId: true } });
    const gIds = groupIdsForRole.get(r.id) || [];
    const viaGroupUsers = gIds.length
      ? await prisma.userGroup.findMany({ where: { groupId: { in: gIds }, active: true, isDeleted: null } as any, select: { userId: true } })
      : [];
    const userSet = new Set<string>([...directUsers.map((u) => u.userId), ...viaGroupUsers.map((u) => u.userId)]);
    roleOut.push({
      id: r.id, name: r.name,
      allowedFeatures: unionAllowed(byParent.get(r.id) || []),
      groupNames: (groupsForRole.get(r.id) || []).sort(),
      directMemberCount: directUsers.length,
      effectiveUserCount: userSet.size, // distinct users holding the role directly or through a group
      // The distinct user ids (UUIDs, not PII) let rbacPreflight attribute each denial-log line to the
      // exact role of the user who hit it ("its users actually called …").
      userIds: [...userSet].sort(),
    });
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
