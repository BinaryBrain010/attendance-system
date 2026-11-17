/**
 * rbacPreflight — simulate RBAC_ENFORCE=on from a PROD roleGrants export + featureMap.json, scoped to
 * the routes each role's users ACTUALLY hit. READ-ONLY: no DB connection, no env change, no writes.
 *
 * Grant source (required):
 *   --grants=<roleGrants.json>    the export from qa/exportRoleGrants.ts, run on prod. Per role it has
 *                                 allowedFeatures, groupNames, effectiveUserCount and userIds.
 * Call source (preferred, "last 14 days"):
 *   --denials=<rbac_denials.log>  the file requirePermission writes while prod runs RBAC_ENFORCE=log.
 *                                 Each line is JSON {ts,userId,route,reason,mode}. We keep the lines in
 *                                 the window and, by the userId, attribute each would-403 route to the
 *                                 roles that user belongs to — i.e. "the routes its users actually
 *                                 called that would 403 under enforce".
 *   (no --denials)                Fallback: NAV-derived — every feature route inside the modules a role
 *                                 operates in (its granted roots = the apps/tabs its nav shows) that it
 *                                 would 403 on. Broader, but needs no prod log.
 *   --days=14                     denial-log window (default 14).
 *   --out=<md path>               report path (default docs/RBAC_ENFORCE_PREFLIGHT_<date>.md).
 *
 *   npx ts-node qa/rbacPreflight.ts --grants=/tmp/prodGrants.json --denials=/tmp/rbac_denials.log
 */
import fs from "fs";
import path from "path";

type FM = Record<string, { access?: string; feature: string; kind?: string; note?: string }>;
const featureMap: FM = require("../src/middleware/rbac/featureMap.json");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const grantsPath = arg("grants");
const denialsPath = arg("denials");
const days = Number(arg("days")) || 14;
const outArg = arg("out");

if (!grantsPath) {
  console.error("rbacPreflight: --grants=<roleGrants.json> is required (run qa/exportRoleGrants.ts on prod first).");
  process.exit(2);
}

// ---- server-identical matching: exact grant OR an ancestor wildcard grants the descendant ----
function featureAncestors(f: string): string[] {
  if (!f || !f.endsWith(".*")) return [];
  const segs = f.slice(0, -2).split(".");
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}
const accessOf = (v: FM[string]) => v.access || v.kind || "";
function satisfies(granted: Set<string>, required: string): boolean {
  if (!required) return false;
  if (granted.has(required)) return true;
  for (const anc of featureAncestors(required)) if (granted.has(anc)) return true;
  return false;
}
const moduleRoot = (f: string) => (f || "").split(".")[0];

const featureRoutes = Object.entries(featureMap)
  .filter(([, v]) => accessOf(v) === "feature" && v.feature && v.feature !== "-")
  .map(([route, v]) => ({ route, feature: v.feature }));

// The grantable feature a denied route needs (feature/self/dynamic all ultimately need a feature grant).
function requiredFeatureForRoute(route: string): { feature: string; access: string } | null {
  const v = featureMap[route];
  if (!v) return null; // unmapped — not grantable by a feature
  const access = accessOf(v);
  if (access === "god" || access === "open" || access === "token") return null; // not a feature gap
  if (!v.feature || v.feature === "-") return null;
  return { feature: v.feature, access };
}

type Role = { name: string; granted: Set<string>; roots: Set<string>; effectiveUserCount: number; userIds: string[]; groupNames: string[] };

function loadRoles(): { roles: Role[]; header: string; userToRoles: Map<string, string[]> } {
  const data = JSON.parse(fs.readFileSync(grantsPath!, "utf8"));
  const roleByName = new Map<string, any>((data.roles || []).map((r: any) => [r.name, r]));
  const roles: Role[] = [];
  const userToRoles = new Map<string, string[]>();
  for (const r of data.roles || []) {
    const granted = new Set<string>();
    for (const f of r.allowedFeatures || []) granted.add(f);
    // A role's group grants are already unioned into the role's effective set at the server, but the
    // export keeps them on the group; fold in the features of every group that grants this role.
    for (const gName of r.groupNames || []) {
      const g = (data.groups || []).find((x: any) => x.name === gName);
      for (const f of g?.allowedFeatures || []) granted.add(f);
    }
    const roots = new Set<string>(); for (const f of granted) roots.add(moduleRoot(f));
    roles.push({ name: r.name, granted, roots, effectiveUserCount: r.effectiveUserCount ?? r.directMemberCount ?? 0, userIds: r.userIds || [], groupNames: r.groupNames || [] });
    for (const uid of r.userIds || []) {
      if (!userToRoles.has(uid)) userToRoles.set(uid, []);
      userToRoles.get(uid)!.push(r.name);
    }
  }
  const header = `Grants: **${path.basename(grantsPath!)}** (host \`${data.host}\`, exported ${data.exportedAt}; ${data.counts?.roles} roles / ${data.counts?.groups} groups).`;
  return { roles, header, userToRoles };
}

type Gap = { routes: Set<string>; hits: number; users: Set<string> };
function addGap(map: Map<string, Gap>, feature: string, route: string, userId?: string, hits = 1) {
  if (!map.has(feature)) map.set(feature, { routes: new Set(), hits: 0, users: new Set() });
  const g = map.get(feature)!;
  g.routes.add(route);
  g.hits += hits;
  if (userId) g.users.add(userId);
}

function main() {
  const { roles, header, userToRoles } = loadRoles();
  const today = new Date().toISOString().slice(0, 10);
  const report: string[] = [];
  report.push(`# RBAC_ENFORCE preflight — ${today}`);
  report.push("");
  report.push(header);
  report.push(`featureMap routes: **${Object.keys(featureMap).length}** (feature-gated: ${featureRoutes.length}).`);

  // Per-role gap maps: feature -> {routes, hits, users}
  const roleGaps = new Map<string, Map<string, Gap>>();
  for (const r of roles) roleGaps.set(r.name, new Map());
  let sourceLine = "";
  const expected = { god: new Set<string>(), unmapped: new Set<string>() }; // informational, not grantable

  if (denialsPath && fs.existsSync(denialsPath)) {
    const cutoff = Date.now() - days * 86400000;
    const lines = fs.readFileSync(denialsPath, "utf8").split(/\r?\n/).filter(Boolean);
    let parsed = 0, inWindow = 0, attributed = 0;
    const roleByName = new Map(roles.map((r) => [r.name, r]));
    for (const line of lines) {
      let o: any; try { o = JSON.parse(line); } catch { continue; }
      parsed++;
      const t = Date.parse(o.ts || "");
      if (!Number.isFinite(t) || t < cutoff) continue;
      inWindow++;
      const route: string = o.route; const userId: string = o.userId || "";
      if (!route) continue;
      const need = requiredFeatureForRoute(route);
      if (!need) { // god-only / unmapped — expected, record for the informational section
        const v = featureMap[route];
        if (!v) expected.unmapped.add(route); else if (accessOf(v) === "god") expected.god.add(route);
        continue;
      }
      const rolesOfUser = userToRoles.get(userId) || [];
      if (!rolesOfUser.length) continue; // a user not tied to any exported role (e.g. god/admin direct) — skip
      for (const rn of rolesOfUser) {
        const r = roleByName.get(rn)!;
        if (satisfies(r.granted, need.feature)) continue; // this role already has it (shouldn't be denied for it)
        addGap(roleGaps.get(rn)!, need.feature, route, userId);
        attributed++;
      }
    }
    sourceLine = `Source: **denial log** \`${path.basename(denialsPath)}\` — last ${days} days (${inWindow} of ${parsed} lines in window; ${attributed} attributed to a role's users). These are the routes the role's users **actually called** that would 403 under enforce.`;
  } else {
    if (denialsPath) report.push(`> (denial log \`${denialsPath}\` not found — using the nav-derived fallback.)`);
    for (const r of roles) {
      for (const fr of featureRoutes) {
        if (satisfies(r.granted, fr.feature)) continue;
        if (!r.roots.has(moduleRoot(fr.feature))) continue; // only modules this role operates in (its nav)
        addGap(roleGaps.get(r.name)!, fr.feature, fr.route);
      }
    }
    sourceLine = `Source: **nav-derived** (no denial log supplied) — every feature route inside the modules each role operates in (the apps/tabs its nav shows) that it would 403 on. Supply \`--denials=<rbac_denials.log>\` from prod's LOG-mode run for the actual last-${days}-days call set.`;
  }

  report.push(sourceLine);
  report.push("");
  report.push(`For each role: its users, the would-be-blocked routes, and the single feature to grant that clears each cluster. Grant the feature, or confirm the role never needs that route, before flipping RBAC_ENFORCE to on.`);
  report.push("");

  // Rank roles by the number of users affected, then gaps.
  for (const r of roles) {
    const gaps = roleGaps.get(r.name)!;
    if (r.effectiveUserCount === 0 && gaps.size === 0) continue; // skip empty, unused roles
    const totalRoutes = new Set<string>(); for (const g of gaps.values()) for (const rt of g.routes) totalRoutes.add(rt);
    report.push(`## ${r.name}  —  ${r.effectiveUserCount} user(s)${r.groupNames.length ? `, via groups: ${r.groupNames.map((g) => `\`${g}\``).join(", ")}` : ""}`);
    report.push(`Module roots: ${[...r.roots].sort().map((x) => `\`${x}\``).join(", ") || "(none)"}.`);
    if (gaps.size === 0) {
      report.push(`> ✅ No would-be-blocked routes${denialsPath ? " in the window" : ""} — safe to enforce for this role.`);
      report.push("");
      continue;
    }
    report.push(`**${totalRoutes.size}** route(s) would 403 — grant ${gaps.size} feature(s):`);
    report.push("");
    report.push(denialsPath ? `| Grant this feature | clears # routes | hits (14d) | users | example routes |` : `| Grant this feature | clears # routes | example routes |`);
    report.push(denialsPath ? `|---|---|---|---|---|` : `|---|---|---|`);
    const sorted = [...gaps.entries()].sort((a, b) => b[1].hits - a[1].hits || b[1].routes.size - a[1].routes.size);
    for (const [feat, g] of sorted) {
      const ex = [...g.routes].slice(0, 4).map((x) => `\`${x}\``).join("<br>") + (g.routes.size > 4 ? `<br>…+${g.routes.size - 4} more` : "");
      report.push(denialsPath
        ? `| \`${feat}\` | ${g.routes.size} | ${g.hits} | ${g.users.size} | ${ex} |`
        : `| \`${feat}\` | ${g.routes.size} | ${ex} |`);
    }
    report.push("");
  }

  if (denialsPath && (expected.god.size || expected.unmapped.size)) {
    report.push(`## Expected denials (not grantable — review, don't blanket-grant)`);
    if (expected.god.size) report.push(`- **god-only** routes hit in the window (${expected.god.size}): ${[...expected.god].slice(0, 10).map((x) => `\`${x}\``).join(", ")}${expected.god.size > 10 ? " …" : ""}`);
    if (expected.unmapped.size) report.push(`- **unmapped** routes hit (${expected.unmapped.size}) — these 403 as "unmapped route"; add them to the feature map if they're real: ${[...expected.unmapped].slice(0, 10).map((x) => `\`${x}\``).join(", ")}${expected.unmapped.size > 10 ? " …" : ""}`);
    report.push("");
  }

  const out = outArg || path.join(__dirname, "..", "docs", `RBAC_ENFORCE_PREFLIGHT_${today}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, report.join("\n") + "\n");
  console.log(`[rbacPreflight] ${sourceLine.replace(/\*\*/g, "")}`);
  console.log(`[rbacPreflight] wrote ${out}`);
}
main();
