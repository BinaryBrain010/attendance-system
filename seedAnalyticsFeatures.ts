/**
 * Analytics features seed. UPSERT ONLY — creates/updates the analytics.* dashboard + custom-widget
 * AppFeature rows and nothing else: no deletes, no role or grant changes (grant via the permission
 * editor). Safe to rerun; prints exactly what it did.
 *
 *   npx ts-node seedAnalyticsFeatures.ts                # local
 *   npx ts-node seedAnalyticsFeatures.ts --allow-remote # prod (the server's DB host resolves to localhost)
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedAnalyticsFeatures] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["analytics.*", null, "Analytics"],
  ["analytics.read.*", "analytics.*", "Analytics Read"],
  ["analytics.dashboard.*", "analytics.*", "Dashboards (create, rename, share)"],
  ["analytics.customWidget.*", "analytics.*", "Custom Widget Builder"],
];

async function main() {
  console.log(`[seedAnalyticsFeatures] db-host: ${host}  (upsert only — no deletes, no role changes)\n`);
  let created = 0, updated = 0;
  for (const [name, parentFeatureId, label] of FEATURES) {
    const existing = await prisma.appFeature.findUnique({ where: { name }, select: { name: true } });
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
    if (existing) { updated++; console.log(`  updated  ${name}  (parent: ${parentFeatureId ?? "—"})`); }
    else { created++; console.log(`  created  ${name}  (parent: ${parentFeatureId ?? "—"})`); }
  }
  console.log(`\n[seedAnalyticsFeatures] done — ${created} created, ${updated} updated, ${FEATURES.length} total. Grant 'Analytics' leaves to roles via the permission editor.`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedAnalyticsFeatures] error", e); process.exit(1); });
