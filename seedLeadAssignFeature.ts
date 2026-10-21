/**
 * Phase 2c seed (LOCAL ONLY, UPSERT-ONLY): registers the crm.lead.assign AppFeature (choose which
 * agent a lead is assigned to). Nothing is deleted or overwritten beyond the one feature row; safe to
 * re-run. Also rewrites qa/_livefeatures.json so the featureMap generator sees it.
 *   npx ts-node seedLeadAssignFeature.ts
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedLeadAssignFeature] REFUSING — DATABASE_URL host "${host}" is not local.`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["crm.lead.assign.*", "crm.lead.*", "Assign lead to an agent"],
];

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[seedLeadAssignFeature] features upserted: ${FEATURES.length}`);
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(all.map((f) => f.name).sort(), null, 2));
  console.log(`[seedLeadAssignFeature] qa/_livefeatures.json rewritten (${all.length} features)`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedLeadAssignFeature] error", e); process.exit(1); });
