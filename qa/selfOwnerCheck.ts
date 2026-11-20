/**
 * Guard for the `access: "self"` gate. A self route is only safe if requirePermission can derive the
 * owner — from a SELF_OWNER rule, or because the handler keys on body.employeeId / body.userId (the
 * gate's own-employee / own-user paths), or because it reads no target id at all (operates on
 * req.userId). This check FAILS (non-zero exit) for any self route that has NONE of those AND reads a
 * foreign id target (body.id / {id} = req.body) the gate ignores — which would fall through to the
 * "no target -> own" allowance and let any logged-in user through (the /employee/getById pattern).
 *
 *   npx ts-node qa/selfOwnerCheck.ts        (run in CI / before flipping RBAC_ENFORCE)
 *
 * It walks the SAME routers the featuremap is generated from (qa/routerList.ts), reads the controller
 * sources, and uses the REAL SELF_OWNER map exported by requirePermission (single source of truth).
 */
import fs from "fs";
import path from "path";
import RoutesHelper from "../src/helper/routes.helper";
import { authed, open } from "./routerList";
import { SELF_OWNER } from "../src/middleware/rbac/requirePermission";

const featureMap: Record<string, { access?: string; kind?: string; feature: string }> = require("../src/middleware/rbac/featureMap.json");

// ---- walk the Express routers, capturing each route's handler method names ----
function mountSegment(layer: any): string {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  const m = layer.regexp.toString().match(/\\\/((?:[A-Za-z0-9_~-]|\\.)+)\\\/\?/);
  return m ? "/" + m[1].replace(/\\(.)/g, "$1") : "";
}
const handlerName = (h: any): string | null => {
  const n: string = (h && h.name) || "";
  const base = n.replace(/^bound /, "").trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(base) ? base : null;
};
function walk(stack: any[], prefix: string, out: Map<string, Set<string>>) {
  for (const layer of stack || []) {
    if (layer.route) {
      const rp = layer.route.path;
      const paths = Array.isArray(rp) ? rp : [rp];
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m] && m !== "_all");
      const names = new Set<string>();
      for (const h of layer.route.stack || []) { const nm = handlerName(h.handle); if (nm) names.add(nm); }
      for (const p of paths) for (const m of methods) {
        const key = `${m.toUpperCase()} ${prefix + p}`;
        if (!out.has(key)) out.set(key, new Set());
        for (const nm of names) out.get(key)!.add(nm);
      }
    } else if ((layer.name === "router" || layer.handle?.stack) && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountSegment(layer), out);
    }
  }
}

const routeHandlers = new Map<string, Set<string>>();
for (const cls of [...authed, ...open]) {
  let router: any;
  try { router = new cls().getRouter(); } catch (e: any) { console.warn(`skip ${cls.name}: ${e?.message}`); continue; }
  const mount = RoutesHelper.generateRoutePath(cls);
  const sub = new Map<string, Set<string>>();
  walk(router.stack, "", sub);
  for (const [k, names] of sub) {
    const [method, p] = k.split(" ");
    const full = `${method} ${mount + p}`;
    if (!routeHandlers.has(full)) routeHandlers.set(full, new Set());
    for (const nm of names) routeHandlers.get(full)!.add(nm);
  }
}

// ---- controller sources + per-method body extraction ----
function readControllers(dir: string, acc: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) readControllers(fp, acc);
    else if (/\.cont?r?oller\.ts$/.test(e.name)) acc.push(fs.readFileSync(fp, "utf8")); // *.controller.ts + the *.contoller.ts typo
  }
}
const srcParts: string[] = [];
readControllers(path.join(__dirname, "..", "src"), srcParts);
const allSrc = srcParts.join("\n\n");

function methodBodies(src: string, name: string): string[] {
  const bodies: string[] = [];
  const re = new RegExp(`(?:async\\s+)?${name}\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 1;              // inside the "("
    while (i < src.length && depth > 0) { const c = src[i++]; if (c === "(") depth++; else if (c === ")") depth--; }
    while (i < src.length && src[i] !== "{" && src[i] !== ";") i++;
    if (src[i] !== "{") continue;
    let bdepth = 1; i++; const start = i;
    while (i < src.length && bdepth > 0) { const c = src[i++]; if (c === "{") bdepth++; else if (c === "}") bdepth--; }
    bodies.push(src.slice(start, i));
  }
  return bodies;
}
// Classify a handler by how the self gate could derive ownership from it. The gate recognises
// body.employeeId (own employee) and body.userId (own user); a route that reads NO target id operates
// on req.userId (own record). The DANGER is a route that reads some OTHER id target (body.id / {id} =
// req.body / query.id) the gate ignores — it then falls through to "no target -> own" and lets any
// logged-in user through (exactly the /employee/getById + /getLinkedUser pattern).
const READS_EMP = /employeeId/;
const READS_USER = /\buserId\b/;
const READS_FOREIGN_ID = /(?:req\.)?(?:body|query)\.id\b|\{[^}]*\bid\b[^}]*\}\s*=\s*(?:req\.)?(?:body|query)\b/;
function handlerOwnership(name: string): "employee" | "user" | "foreignId" | "ownOnly" {
  const body = methodBodies(allSrc, name).join("\n");
  if (READS_EMP.test(body)) return "employee";
  if (READS_USER.test(body)) return "user";
  if (READS_FOREIGN_ID.test(body)) return "foreignId";
  return "ownOnly"; // no target id -> operates on req.userId
}

// ---- the check ----
const selfRoutes = Object.entries(featureMap).filter(([, v]) => (v.access || v.kind) === "self").map(([k]) => k);
const violations: { route: string; handlers: string[] }[] = [];
for (const route of selfRoutes) {
  if (SELF_OWNER[route] || SELF_OWNER[route.toLowerCase()]) continue;         // owner derived by a rule
  const handlers = [...(routeHandlers.get(route) || new Set<string>())];
  const kinds = handlers.map(handlerOwnership);
  // Safe if ANY handler keys on employeeId/userId, OR none reads a foreign id target (pure own record).
  const safe = kinds.some((k) => k === "employee" || k === "user") || !kinds.includes("foreignId");
  if (!safe) violations.push({ route, handlers });
}

console.log(`[selfOwnerCheck] ${selfRoutes.length} self routes; SELF_OWNER rules: ${Object.keys(SELF_OWNER).length}`);
if (violations.length) {
  console.error(`\n✗ ${violations.length} self route(s) with NO ownership mechanism — not in SELF_OWNER, the handler reads neither body.employeeId nor body.userId, and it DOES read a foreign id target the gate ignores (-> "no target -> own" lets any logged-in user through):`);
  for (const v of violations) console.error(`  - ${v.route}   handlers: [${v.handlers.join(", ") || "none captured"}]`);
  console.error(`\nFix: add a SELF_OWNER rule in requirePermission.ts (e.g. { idKey: "id" }), or make the handler read body.employeeId.`);
  process.exit(1);
}
console.log("✓ every self route derives ownership (SELF_OWNER rule, body.employeeId / body.userId, or no target).");
process.exit(0);
