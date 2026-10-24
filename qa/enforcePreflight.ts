/**
 * RBAC_ENFORCE flip preflight — lists, per real role, the in-module routes that would start
 * returning 403 when prod flips RBAC_ENFORCE log->on, so the missing permissions can be granted
 * first. Never changes the env or any user/role.
 *
 * Two grant sources:
 *   npx ts-node qa/enforcePreflight.ts
 *       Local DB: provisions a throwaway QA_ user per role (role + same-named group links),
 *       self-cleaning, and asks the server's own checkUserPermission().
 *   npx ts-node qa/enforcePreflight.ts --grants=qa/_roleGrants.json
 *       Offline: reads a roleGrants export (from qa/exportRoleGrants.ts, run on PROD) and evaluates
 *       grants with the same hierarchy rule the server uses (exact grant OR an ancestor wildcard).
 *       No DB connection, no provisioning. Use this with prod's real grants.
 */
import fs from "fs";
import path from "path";

type FM = Record<string, { access: string; feature: string; kind: string }>;
const featureMap: FM = require("../src/middleware/rbac/featureMap.json");

// Named real roles the client listed -> exact Role/Group names (both are used when present, since a
// real user of that role typically carries the same-named group too).
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

const grantsArg = process.argv.find((a) => a.startsWith("--grants="));
const outArg = process.argv.find((a) => a.startsWith("--out="));

// ---- server-identical matching: exact grant OR an ancestor wildcard grants the descendant ----
function featureAncestors(f: string): string[] {
  if (!f || !f.endsWith(".*")) return [];
  const segs = f.slice(0, -2).split(".");
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}
function satisfies(granted: Set<string>, required: string): boolean {
  if (granted.has(required)) return true;
  for (const anc of featureAncestors(required)) if (granted.has(anc)) return true;
  return false;
}

const featureRoutes = Object.entries(featureMap)
  .filter(([, v]) => (v.access || v.kind) === "feature" && v.feature && v.feature !== "-")
  .map(([route, v]) => ({ route, feature: v.feature }));
const godRoutes = Object.entries(featureMap).filter(([, v]) => v.access === "god").map(([r]) => r);
const countAccess = (a: string) => Object.values(featureMap).filter((v) => v.access === a).length;

type RoleResult = {
  label: string; src: string; found: boolean;
  roots: string[]; inModule: { route: string; feature: string }[]; crossModule: number; extra?: string;
};

/** Shared per-role evaluation: given the role's effective granted feature set + which module roots it
 *  operates in, split the would-403 feature routes into in-module (actionable) vs cross-module (noise). */
function evaluate(label: string, src: string, granted: Set<string>): RoleResult {
  const roots = new Set<string>();
  for (const f of granted) roots.add(f.split(".")[0]);
  const inModule: { route: string; feature: string }[] = [];
  let crossModule = 0;
  for (const fr of featureRoutes) {
    if (satisfies(granted, fr.feature)) continue;
    if (roots.has(fr.feature.split(".")[0])) inModule.push(fr);
    else crossModule++;
  }
  return { label, src, found: true, roots: [...roots].sort(), inModule, crossModule };
}

async function fromGrantsFile(file: string): Promise<{ results: RoleResult[]; header: string }> {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const roleByName = new Map<string, any>((data.roles || []).map((r: any) => [r.name, r]));
  const groupByName = new Map<string, any>((data.groups || []).map((g: any) => [g.name, g]));
  const results: RoleResult[] = [];
  for (const r of ROLES) {
    const roleRow = r.role ? roleByName.get(r.role) : undefined;
    const groupRow = r.group ? groupByName.get(r.group) : undefined;
    if (!roleRow && !groupRow) {
      results.push({ label: r.label, src: `role "${r.role}" / group "${r.group}"`, found: false, roots: [], inModule: [], crossModule: 0 });
      continue;
    }
    const granted = new Set<string>();
    const add = (feats?: string[]) => { for (const f of feats || []) granted.add(f); };
    add(roleRow?.allowedFeatures);
    add(groupRow?.allowedFeatures);
    // A group grants its linked roles' features too (mirrors checkUserPermission's group-role walk).
    for (const rn of (groupRow?.roleNames || [])) add(roleByName.get(rn)?.allowedFeatures);
    const src = [roleRow ? `role "${r.role}"` : null, groupRow ? `group "${r.group}"` : null].filter(Boolean).join(" + ");
    const res = evaluate(r.label, src, granted);
    const members = [roleRow ? `role ${roleRow.memberCount}` : null, groupRow ? `group ${groupRow.memberCount}` : null].filter(Boolean).join(", ");
    res.extra = members ? `members: ${members}` : undefined;
    results.push(res);
  }
  const header = `Source: **prod grants file** \`${path.basename(file)}\` (host \`${data.host}\`, exported ${data.exportedAt}; ${data.counts?.roles} roles / ${data.counts?.groups} groups).`;
  return { results, header };
}

async function fromLocalDb(): Promise<{ results: RoleResult[]; header: string }> {
  // Lazy imports so the --grants path never touches the DB.
  const prisma = (await import("../src/core/models/base.model")).default;
  const accessModel = (await import("../src/modules/rbac/Access/models/access.model")).default;
  const RUN = Date.now().toString(36);
  const results: RoleResult[] = [];

  async function grantedRootsAndSet(roleId?: string, groupId?: string): Promise<Set<string>> {
    const parentIds: string[] = [];
    if (roleId) parentIds.push(roleId);
    if (groupId) {
      parentIds.push(groupId);
      const grs = await prisma.groupRole.findMany({ where: { groupId, isDeleted: null } as any, select: { roleId: true } }).catch(() => [] as { roleId: string }[]);
      for (const gr of grs) parentIds.push(gr.roleId);
    }
    const fps = await prisma.featurePermission.findMany({ where: { parentId: { in: parentIds }, isDeleted: null } as any, select: { permissions: true } });
    const granted = new Set<string>();
    for (const fp of fps) { const a: string[] = (fp.permissions as any)?.allowedFeatures ?? []; for (const f of a) if (f) granted.add(String(f)); }
    return granted;
  }

  for (const r of ROLES) {
    const roleRow = r.role ? await prisma.role.findFirst({ where: { name: r.role, isDeleted: null } as any, select: { id: true } }) : null;
    const groupRow = r.group ? await prisma.group.findFirst({ where: { name: r.group, isDeleted: null } as any, select: { id: true } }) : null;
    if (!roleRow && !groupRow) {
      results.push({ label: r.label, src: `role "${r.role}" / group "${r.group}"`, found: false, roots: [], inModule: [], crossModule: 0 });
      continue;
    }
    // Provision a throwaway QA_ user so checkUserPermission resolves exactly as for a real user.
    const u = await prisma.user.create({ data: { username: `QA_PF_${RUN}_${r.label.replace(/\s+/g, "_")}@test.local`, password: "x" } as any });
    if (roleRow) await prisma.userRole.create({ data: { userId: u.id, roleId: roleRow.id, active: true } as any });
    if (groupRow) await prisma.userGroup.create({ data: { userId: u.id, groupId: groupRow.id, active: true } as any });
    const granted = await grantedRootsAndSet(roleRow?.id, groupRow?.id);
    const src = [roleRow ? `role "${r.role}"` : null, groupRow ? `group "${r.group}"` : null].filter(Boolean).join(" + ");
    // Use the server's checkUserPermission for the actual block decision (identical to satisfies, but
    // authoritative), then classify by the granted roots.
    const roots = new Set<string>(); for (const f of granted) roots.add(f.split(".")[0]);
    const inModule: { route: string; feature: string }[] = []; let crossModule = 0;
    for (const fr of featureRoutes) {
      const ok = await accessModel.user.checkUserPermission(u.id, fr.feature);
      if (ok) continue;
      if (roots.has(fr.feature.split(".")[0])) inModule.push(fr); else crossModule++;
    }
    await prisma.userRole.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.userGroup.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    results.push({ label: r.label, src, found: true, roots: [...roots].sort(), inModule, crossModule });
  }
  await prisma.$disconnect();
  return { results, header: "Source: **local DB** role/group grants (may differ from prod — run with --grants=<prod export> for the real picture)." };
}

async function main() {
  const { results, header } = grantsArg ? await fromGrantsFile(grantsArg.slice("--grants=".length)) : await fromLocalDb();

  const report: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  report.push(`# RBAC_ENFORCE flip preflight — ${today}`);
  report.push("");
  report.push(header);
  report.push(`Routes in featureMap: **${Object.keys(featureMap).length}** (feature-gated: ${featureRoutes.length}, god-only: ${godRoutes.length}).`);
  report.push(`Each section lists the **in-module** feature routes that would start returning 403 when prod flips RBAC_ENFORCE log→on — routes inside apps the role actually uses. Cross-module 403s (modules the role has no access to, so never calls) are counted but excluded. Grant the listed features, or confirm the role never calls that route, before flipping.`);
  report.push("");

  for (const res of results) {
    if (!res.found) {
      console.log(`\n### ${res.label}: NOT FOUND (${res.src}) — skipped`);
      report.push(`## ${res.label}`);
      report.push(`> No matching role/group in the grant source (${res.src}) — confirm the exact name and re-run. (Skipped.)`);
      report.push("");
      continue;
    }
    console.log(`\n### ${res.label} (${res.src}): ${res.inModule.length} in-module 403 gaps (+${res.crossModule} cross-module, ignored)`);
    report.push(`## ${res.label}  —  ${res.src}${res.extra ? ` (${res.extra})` : ""}`);
    report.push(`Module roots this role operates in: ${res.roots.map((x) => `\`${x}\``).join(", ") || "(none)"}.`);
    report.push(`**${res.inModule.length}** in-module feature routes would 403. ${res.crossModule} other feature routes would also 403 but belong to modules this role has no access to — ignore those.`);
    if (res.inModule.length === 0) {
      report.push(`> ✅ Nothing to grant — every route inside this role's own modules is already covered.`);
    } else {
      const byFeature = new Map<string, string[]>();
      for (const b of res.inModule) { if (!byFeature.has(b.feature)) byFeature.set(b.feature, []); byFeature.get(b.feature)!.push(b.route); }
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
  report.push(`_Not listed (never hard-403 at the gate): token (${countAccess("token")}), self/own-data (${countAccess("self")}), open (${countAccess("open")}), dynamic/scope-resolved (${countAccess("dynamic")})._`);

  const out = outArg
    ? outArg.slice("--out=".length)
    : path.join(__dirname, "..", "docs", `RBAC_ENFORCE_PREFLIGHT${grantsArg ? "_PROD" : ""}_${today}.md`);
  fs.writeFileSync(out, report.join("\n") + "\n");
  console.log(`\n[enforcePreflight] wrote ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
