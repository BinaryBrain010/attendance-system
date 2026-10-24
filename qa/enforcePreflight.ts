/**
 * RBAC_ENFORCE flip preflight (read-mostly, QA_ users only, self-cleaning).
 *
 * For each real prod role/group, provisions a throwaway QA_ user that COPIES that role's (and the
 * same-named group's) grants, then checks every feature-gated route in featureMap.json with the
 * server's own checkUserPermission(). Any feature route the role does NOT satisfy is a route that
 * currently works under RBAC_ENFORCE=log but would start returning 403 once prod flips to "on".
 *
 * Output: console summary + docs/RBAC_ENFORCE_PREFLIGHT_2026-10-24.md (per role, the exact routes +
 * the missing feature to grant). It does NOT change the env or any real user/role.
 *
 *   npx ts-node qa/enforcePreflight.ts
 */
import fs from "fs";
import path from "path";
import prisma from "../src/core/models/base.model";
import accessModel from "../src/modules/rbac/Access/models/access.model";

type FM = Record<string, { access: string; feature: string; kind: string }>;
const featureMap: FM = require("../src/middleware/rbac/featureMap.json");

// Named real roles the client listed -> exact Role/Group names in the DB (both are attached when
// present, since a real user of that role typically carries the same-named group too).
const ROLES: { label: string; role?: string; group?: string }[] = [
  { label: "Admin", role: "Admin", group: "Admins" },
  { label: "HR", role: "HR" },
  { label: "Attendance Manager", role: "Attendance Manager", group: "Attendance Managers" },
  { label: "Sales Agent", role: "Sales Agent" },
  { label: "Sales Manager", role: "Sales Manager" },
  { label: "Frontdesk", role: "Frontdesk" },
  { label: "Head Office Reception", role: "Head Office Reception" },
  { label: "Warehouse", role: "Warehouse", group: "Warehouse" },
  { label: "Executives", role: "Executives", group: "Executives" },
];

const RUN = Date.now().toString(36);

async function provision(r: { label: string; role?: string; group?: string }) {
  const roleRow = r.role ? await prisma.role.findFirst({ where: { name: r.role, isDeleted: null } as any, select: { id: true } }) : null;
  const groupRow = r.group ? await prisma.group.findFirst({ where: { name: r.group, isDeleted: null } as any, select: { id: true } }) : null;
  if (!roleRow && !groupRow) return { uid: null as string | null, found: false, roleRow, groupRow };
  const u = await prisma.user.create({ data: { username: `QA_PF_${RUN}_${r.label.replace(/\s+/g, "_")}@test.local`, password: "x" } as any });
  if (roleRow) await prisma.userRole.create({ data: { userId: u.id, roleId: roleRow.id, active: true } as any });
  if (groupRow) await prisma.userGroup.create({ data: { userId: u.id, groupId: groupRow.id, active: true } as any });
  return { uid: u.id, found: true, roleRow, groupRow };
}

async function cleanup(uid: string) {
  await prisma.userRole.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.userGroup.deleteMany({ where: { userId: uid } }).catch(() => {});
  await prisma.user.delete({ where: { id: uid } }).catch(() => {});
}

/** The module roots (first path segment of each granted feature) a role/group can touch, resolved
 *  the same way checkUserPermission resolves: role FP + group FP + the group's roles' FPs. Used to
 *  separate "in-module" 403 gaps (routes the role actually uses) from cross-module noise. */
async function grantedRoots(roleId?: string, groupId?: string): Promise<Set<string>> {
  const parentIds: string[] = [];
  if (roleId) parentIds.push(roleId);
  if (groupId) {
    parentIds.push(groupId);
    const grs = await prisma.groupRole.findMany({ where: { groupId, isDeleted: null } as any, select: { roleId: true } }).catch(() => [] as { roleId: string }[]);
    for (const gr of grs) parentIds.push(gr.roleId);
  }
  const fps = await prisma.featurePermission.findMany({ where: { parentId: { in: parentIds }, isDeleted: null } as any, select: { permissions: true } });
  const roots = new Set<string>();
  for (const fp of fps) {
    const allowed: string[] = (fp.permissions as any)?.allowedFeatures ?? [];
    for (const f of allowed) if (f) roots.add(String(f).split(".")[0]);
  }
  return roots;
}

async function main() {
  const featureRoutes = Object.entries(featureMap)
    .filter(([, v]) => (v.access || v.kind) === "feature" && v.feature && v.feature !== "-")
    .map(([route, v]) => ({ route, feature: v.feature }));
  const godRoutes = Object.entries(featureMap).filter(([, v]) => v.access === "god").map(([r]) => r);

  const report: string[] = [];
  report.push(`# RBAC_ENFORCE flip preflight — ${new Date().toISOString().slice(0, 10)}`);
  report.push("");
  report.push(`Routes in featureMap: **${Object.keys(featureMap).length}** (feature-gated: ${featureRoutes.length}, god-only: ${godRoutes.length}).`);
  report.push(`Each section lists, for a QA_ user copying that role's + same-named group's grants, the **feature routes that would start returning 403** when prod flips RBAC_ENFORCE log→on. Grant the listed features (or confirm the role never calls that route) before flipping.`);
  report.push("");

  for (const r of ROLES) {
    const p = await provision(r);
    if (!p.found || !p.uid) {
      console.log(`\n### ${r.label}: NOT FOUND in local DB (role="${r.role}" group="${r.group}") — cannot preflight`);
      report.push(`## ${r.label}`);
      report.push(`> No matching role/group in the local DB config — confirm the exact prod name, then re-run. (Skipped.)`);
      report.push("");
      continue;
    }
    const src = [p.roleRow ? `role "${r.role}"` : null, p.groupRow ? `group "${r.group}"` : null].filter(Boolean).join(" + ");
    const roots = await grantedRoots(p.roleRow?.id, p.groupRow?.id);
    const inModule: { route: string; feature: string }[] = [];
    let crossModule = 0;
    for (const fr of featureRoutes) {
      const ok = await accessModel.user.checkUserPermission(p.uid, fr.feature);
      if (ok) continue;
      // Does the role operate in this route's module at all? If not, it never calls the route.
      if (roots.has(fr.feature.split(".")[0])) inModule.push(fr);
      else crossModule++;
    }
    await cleanup(p.uid);

    console.log(`\n### ${r.label} (${src}): ${inModule.length} in-module 403 gaps (+${crossModule} cross-module, ignored)`);
    report.push(`## ${r.label}  —  copied from ${src}`);
    report.push(`Module roots this role operates in: ${[...roots].sort().map((x) => `\`${x}\``).join(", ") || "(none)"}.`);
    report.push(`**${inModule.length}** in-module feature routes would 403 (routes inside apps this role uses). ${crossModule} other feature routes would also 403 but belong to modules this role has no access to — ignore those.`);
    if (inModule.length === 0) {
      report.push(`> ✅ Nothing to grant — every route inside this role's own modules is already covered.`);
    } else {
      // Group by the missing feature so the admin can grant a few parents to clear many routes.
      const byFeature = new Map<string, string[]>();
      for (const b of inModule) { if (!byFeature.has(b.feature)) byFeature.set(b.feature, []); byFeature.get(b.feature)!.push(b.route); }
      const sorted = [...byFeature.entries()].sort((a, b) => b[1].length - a[1].length);
      report.push("");
      report.push(`| Grant this feature | clears # routes | example routes |`);
      report.push(`|---|---|---|`);
      for (const [feat, routes] of sorted) {
        const ex = routes.slice(0, 4).join("<br>") + (routes.length > 4 ? `<br>…+${routes.length - 4} more` : "");
        report.push(`| \`${feat}\` | ${routes.length} | ${ex} |`);
      }
    }
    report.push("");
  }

  report.push(`## God-only routes (would 403 for every role above)`);
  report.push(`These ${godRoutes.length} routes are intentionally god-only and are expected to 403 for normal roles — grant nothing unless a role genuinely needs them:`);
  report.push(godRoutes.map((r) => `- \`${r}\``).join("\n"));
  report.push("");
  report.push(`_Not listed (never hard-403 at the gate): token (${Object.values(featureMap).filter(v => v.access === "token").length}), self/own-data (${Object.values(featureMap).filter(v => v.access === "self").length}), open (${Object.values(featureMap).filter(v => v.access === "open").length}), dynamic/scope-resolved (${Object.values(featureMap).filter(v => v.access === "dynamic").length})._`);

  const out = path.join(__dirname, "..", "docs", "RBAC_ENFORCE_PREFLIGHT_2026-10-24.md");
  fs.writeFileSync(out, report.join("\n") + "\n");
  console.log(`\n[enforcePreflight] wrote ${out}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
