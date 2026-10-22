/**
 * getAll export-permission seed (LOCAL ONLY by default, UPSERT-ONLY): registers the export features
 * that gate the bulk get-all endpoints (Phase: getAll fix). Use this on prod instead of `npm run seed`
 * (which also creates default users and is NOT prod-safe). Nothing is deleted or overwritten beyond
 * these feature rows; safe to re-run. Also rewrites qa/_livefeatures.json so the generator sees them.
 *   npx ts-node seedExportFeatures.ts            (local)
 *   npx ts-node seedExportFeatures.ts --allow-remote   (prod)
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedExportFeatures] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["attendanceReq.export.*", "attendanceReq.*", "Export (bulk get-all)"],
  ["activityLog.export.*", "activityLog.*", "Export (bulk get-all)"],
  ["visitor.export.*", "visitor.*", "Export"], // already exists on most envs; upsert is a no-op there
];

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[seedExportFeatures] features upserted: ${FEATURES.length}`);
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(all.map((f) => f.name).sort(), null, 2));
  console.log(`[seedExportFeatures] qa/_livefeatures.json rewritten (${all.length} features)`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedExportFeatures] error", e); process.exit(1); });
