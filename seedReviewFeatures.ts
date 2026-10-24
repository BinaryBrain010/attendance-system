/**
 * Consolidated review-deploy feature seed (UPSERT-ONLY, remote-guarded). Registers every NEW AppFeature
 * introduced by the 2026-10 review so prod can grant them. Use THIS instead of `npm run seed` (which
 * also creates default users). Safe to re-run; grows as later phases add features.
 *   npx ts-node seedReviewFeatures.ts                 (local)
 *   npx ts-node seedReviewFeatures.ts --allow-remote  (prod)
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedReviewFeatures] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`); process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  // getAll export gating
  ["attendanceReq.export.*", "attendanceReq.*", "Export (bulk get-all)"],
  ["activityLog.export.*", "activityLog.*", "Export (bulk get-all)"],
  ["visitor.export.*", "visitor.*", "Export"],
  // CRM lead permissions (2c/2d)
  ["crm.lead.assign.*", "crm.lead.*", "Assign lead to an agent"],
  ["crm.lead.transfer.*", "crm.lead.*", "Transfer lead to another agent"],
  // Access control (3b)
  ["user.suspend.*", "user.*", "Suspend / Reactivate user"],
  // Frontdesk per-unit visibility (6c): holders see visitors from all units; others see only theirs.
  ["visitor.viewAll.unit.*", "visitor.*", "See visitors from all units (not just own unit)"],
  // HOTFIX 2026-10-23: AMS/Quick-Mark unit scoping bypass. Holders see every unit's employees +
  // attendance; everyone else is scoped to their units (no unit = only themselves).
  // The feature hierarchy endpoint keys buckets by a top-level "<module>.*" root (like "visitor.*"),
  // so ams needs its own root for the permission editor's "Quick Mark" bucket to populate. The root
  // MUST be upserted before the child below (parentFeatureId is a self-FK to AppFeature.name).
  ["ams.*", null, "Quick Mark (unit visibility)"],
  ["ams.viewAll.unit.*", "ams.*", "AMS: see all units (bypass Quick Mark unit scoping)"],
];

async function main() {
  for (const [name, parentFeatureId, label] of FEATURES) {
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
  }
  console.log(`[seedReviewFeatures] features upserted: ${FEATURES.length}`);
  const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
  fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(all.map((f) => f.name).sort(), null, 2));
  console.log(`[seedReviewFeatures] qa/_livefeatures.json rewritten (${all.length} features)`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[seedReviewFeatures] error", e); process.exit(1); });
