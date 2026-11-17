/**
 * Apply agreed RBAC gap-grants to roles — the "seed" step of the enforce runbook. Reads a small JSON
 * mapping role name -> feature(s) to grant and MERGES them into that role's FeaturePermission
 * (additive, deduped, idempotent — re-running is a no-op). DRY-RUN by default: it prints exactly what
 * it would add and changes nothing until you pass --apply.
 *
 *   # grants file, e.g. grants.json:
 *   { "Employee": ["crm.lead.read.own.*"], "Frontdesk": ["visitor.read.*"] }
 *
 *   npx ts-node qa/applyRbacGrants.ts --grants=grants.json                 (dry run, local)
 *   npx ts-node qa/applyRbacGrants.ts --grants=grants.json --apply         (write, local)
 *   npx ts-node qa/applyRbacGrants.ts --grants=grants.json --apply --allow-remote   (write, PROD)
 *
 * Only ADDS features; never removes a grant and never touches users/groups. Safe to review first.
 */
import fs from "fs";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(host);
const APPLY = process.argv.includes("--apply");
const grantsArg = process.argv.find((a) => a.startsWith("--grants="));

if (!grantsArg) { console.error("applyRbacGrants: --grants=<file.json> required ({ roleName: [feature, …] })."); process.exit(2); }
if (APPLY && !isLocal && !process.argv.includes("--allow-remote")) {
  console.error(`applyRbacGrants: REFUSING to --apply on non-local DB host "${host}". Re-run with --allow-remote once you have reviewed the dry run.`);
  process.exit(2);
}

async function main() {
  const grants: Record<string, string[]> = JSON.parse(fs.readFileSync(grantsArg!.slice("--grants=".length), "utf8"));
  console.log(`[applyRbacGrants] host=${host} mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  for (const [roleName, feats] of Object.entries(grants)) {
    const want = [...new Set(feats.filter(Boolean))];
    const role = await prisma.role.findFirst({ where: { name: roleName, isDeleted: null } as any, select: { id: true } });
    if (!role) { console.log(`  ! role "${roleName}" NOT FOUND — skipped`); continue; }

    // Canonical FeaturePermission row for the role (first non-deleted), else we create one.
    const fp = await prisma.featurePermission.findFirst({ where: { parentType: "Role", parentId: role.id, isDeleted: null } as any, select: { id: true, permissions: true } });
    const current: string[] = Array.isArray((fp?.permissions as any)?.allowedFeatures) ? (fp!.permissions as any).allowedFeatures : [];
    const have = new Set(current);
    const toAdd = want.filter((f) => !have.has(f));
    if (toAdd.length === 0) { console.log(`  = ${roleName}: already has ${want.join(", ")} (no change)`); continue; }

    const merged = [...new Set([...current, ...toAdd])].sort();
    console.log(`  ${APPLY ? "+" : "·"} ${roleName}: add ${toAdd.join(", ")}  (${current.length} -> ${merged.length} features)`);
    if (APPLY) {
      if (fp) {
        await prisma.featurePermission.update({ where: { id: fp.id }, data: { permissions: { allowedFeatures: merged } as any } });
      } else {
        await prisma.featurePermission.create({ data: { parentType: "Role", parentId: role.id, permissions: { allowedFeatures: merged } as any, createdAt: new Date() } as any });
      }
    }
  }

  if (!APPLY) console.log("[applyRbacGrants] dry run only — re-run with --apply to write.");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
