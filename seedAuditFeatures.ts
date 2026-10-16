/**
 * Audit module seed (LOCAL ONLY): registers the audit.* AppFeature tree (admin-only read of the
 * central Audit Log) and rewrites qa/_livefeatures.json so the featureMap generator sees it.
 *   npx ts-node seedAuditFeatures.ts
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedAuditFeatures] REFUSING — DATABASE_URL host "${host}" is not local.`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["audit.*", null, "Audit log"],
  ["audit.read.*", "audit.*", "View audit log"],
  ["audit.export.*", "audit.*", "Export audit log"],
];

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[seedAuditFeatures] features upserted: ${FEATURES.length}`);
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  const names = all.map((f) => f.name).sort();
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(names, null, 2));
  console.log(`[seedAuditFeatures] qa/_livefeatures.json rewritten (${names.length} features)`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedAuditFeatures] error", e); process.exit(1); });
