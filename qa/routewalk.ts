/**
 * Walks the ACTUAL registered Express routers (the same classes server.ts mounts) and emits every
 * route (method + full path) at runtime. Does not start the HTTP server. Writes qa/_routes.json.
 *   npx ts-node qa/routewalk.ts
 */
import fs from "fs";
import path from "path";
import RoutesHelper from "../src/helper/routes.helper";

import { authed, open } from "./routerList";

// Recover a mounted sub-router's path segment from its layer regexp.
function mountSegment(layer: any): string {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  const s = layer.regexp.toString();
  // matches /^\/leave-requests\/?(?=\/|$)/i -> "leave-requests"
  const m = s.match(/\\\/((?:[A-Za-z0-9_~-]|\\.)+)\\\/\?/);
  return m ? "/" + m[1].replace(/\\(.)/g, "$1") : "";
}

function walk(stack: any[], prefix: string, out: { method: string; path: string }[]) {
  for (const layer of stack || []) {
    if (layer.route) {
      const rp = layer.route.path;
      const paths = Array.isArray(rp) ? rp : [rp];
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]);
      for (const p of paths) for (const m of methods) {
        if (m === "_all") continue;
        out.push({ method: m.toUpperCase(), path: prefix + p });
      }
    } else if ((layer.name === "router" || layer.handle?.stack) && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountSegment(layer), out);
    }
  }
}

function collect(classes: any[], open: boolean): { method: string; path: string; mount: string; open: boolean }[] {
  const rows: any[] = [];
  for (const cls of classes) {
    const mount = RoutesHelper.generateRoutePath(cls);
    let router: any;
    try { router = new cls().getRouter(); } catch (e: any) { console.warn(`skip ${cls.name}: ${e?.message}`); continue; }
    const sub: { method: string; path: string }[] = [];
    walk(router.stack, "", sub);
    for (const r of sub) rows.push({ method: r.method, path: mount + r.path, mount, open });
  }
  return rows;
}

const routes = [...collect(authed, false), ...collect(open, true)];
// de-dup
const seen = new Set<string>();
const unique = routes.filter((r) => { const k = `${r.method} ${r.path}`; if (seen.has(k)) return false; seen.add(k); return true; });
unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
fs.writeFileSync(path.join(__dirname, "_routes.json"), JSON.stringify(unique, null, 2));
console.log(`[routewalk] ${unique.length} routes from ${authed.length + open.length} routers`);
console.log("sample:", unique.slice(0, 5).map((r) => `${r.method} ${r.path}`).join(" | "));
console.log("leave sub-routes:", unique.filter((r) => r.path.startsWith("/leave/")).slice(0, 4).map((r) => `${r.method} ${r.path}`).join(" | "));
process.exit(0);
