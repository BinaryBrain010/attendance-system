/**
 * HR Policy + Quick Mark Reports seed. UPSERT ONLY — creates/updates the ams.report.* and hr.policy.*
 * AppFeature rows and the three default HR policy bands. No deletes, no role/grant changes (grant the
 * features via the permission editor). Safe to rerun.
 *
 *   npx ts-node seedHrAndReports.ts                # local
 *   npx ts-node seedHrAndReports.ts --allow-remote # prod (the server's DB host resolves to localhost)
 */
import fs from "fs";
import path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[seedHrAndReports] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}

type F = [name: string, parent: string | null, label: string];
const FEATURES: F[] = [
  ["ams.*", null, "AMS"],
  ["ams.report.*", "ams.*", "Reports"],
  ["ams.report.read.*", "ams.report.*", "View reports"],
  ["ams.report.export.*", "ams.report.*", "Export reports"],
  ["hr.*", null, "HR"],
  ["hr.policy.*", "hr.*", "HR Policy"],
  ["hr.policy.manage.*", "hr.policy.*", "Manage HR policy"],
];

// Default policy bands (matches the spec; HR can edit these in the UI afterwards).
const BASE_EFFECTIVE = new Date("2020-01-01T00:00:00.000Z");
const RULES: { id: string; minYears: number; maxYears: number | null; annualLeaveDays: number; medicalEligible: boolean; notes: string }[] = [
  { id: "hr-rule-under-1y", minYears: 0, maxYears: 1, annualLeaveDays: 0, medicalEligible: false, notes: "Under 1 year: no annual leave, no medical" },
  { id: "hr-rule-1-3y", minYears: 1, maxYears: 3, annualLeaveDays: 0, medicalEligible: false, notes: "1 to 3 years: no annual leave, no medical" },
  { id: "hr-rule-3y-plus", minYears: 3, maxYears: null, annualLeaveDays: 32, medicalEligible: true, notes: "3+ years: 32 leave days/year, medical eligible" },
];

async function main() {
  console.log(`[seedHrAndReports] db-host: ${host}  (upsert only)\n`);
  let created = 0, updated = 0;
  for (const [name, parentFeatureId, label] of FEATURES) {
    const existing = await prisma.appFeature.findUnique({ where: { name }, select: { name: true } });
    await prisma.appFeature.upsert({
      where: { name },
      update: { parentFeatureId: parentFeatureId ?? null, label, isDeleted: null },
      create: { name, parentFeatureId: parentFeatureId ?? null, label, createdAt: new Date() },
    });
    if (existing) { updated++; console.log(`  feature updated  ${name}`); }
    else { created++; console.log(`  feature created  ${name}`); }
  }

  for (const r of RULES) {
    const existing = await prisma.hrPolicyRule.findUnique({ where: { id: r.id } }).catch(() => null);
    await prisma.hrPolicyRule.upsert({
      where: { id: r.id },
      update: { minYears: r.minYears, maxYears: r.maxYears, annualLeaveDays: r.annualLeaveDays, medicalEligible: r.medicalEligible, notes: r.notes, isActive: true, isDeleted: null },
      create: { id: r.id, minYears: r.minYears, maxYears: r.maxYears, annualLeaveDays: r.annualLeaveDays, medicalEligible: r.medicalEligible, notes: r.notes, effectiveFrom: BASE_EFFECTIVE, isActive: true },
    });
    console.log(`  policy ${existing ? "updated" : "created"}  ${r.notes}`);
  }

  // Keep the featuremap generator's view of features current.
  try {
    const all = await prisma.appFeature.findMany({ where: { isDeleted: null }, select: { name: true } });
    fs.writeFileSync(path.join(__dirname, "qa", "_livefeatures.json"), JSON.stringify(all.map((f) => f.name).sort(), null, 2));
    console.log("\n  refreshed qa/_livefeatures.json");
  } catch (e: any) { console.warn("  (could not refresh _livefeatures.json)", e?.message || e); }

  console.log(`\n[seedHrAndReports] done — features: ${created} created, ${updated} updated; ${RULES.length} policy bands upserted.`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
