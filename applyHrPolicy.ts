/**
 * Apply the HR policy to existing employees. DRY-RUN by default — writes nothing unless --apply.
 *
 * Shows, per active employee: service length, policy band, the policy entitlement for the year vs the
 * employee's CURRENT allocation for that year (side by side), and whether a POLICY allocation would be
 * created (only when none exists — existing allocations are NEVER reduced or deleted; a case where the
 * policy is BELOW the current allocation is left untouched and FLAGGED for HR).
 *
 * Also lists legacy staff (joined before the probation policy start, more than the probation window
 * ago, never confirmed). With --apply they are stamped CONFIRM ("System, legacy", no notification) so
 * the daily probation job never alerts for them, and the probation policy start date is set to today
 * if it isn't already (so only genuine new hires are tracked going forward).
 *
 *   npx ts-node applyHrPolicy.ts                      # dry run, current year, local DB
 *   npx ts-node applyHrPolicy.ts --year 2026          # dry run for a specific year
 *   npx ts-node applyHrPolicy.ts --apply              # WRITE: create missing POLICY allocations + confirm legacy
 *   npx ts-node applyHrPolicy.ts --apply --allow-remote
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";
import HrPolicyService from "./src/modules/HR/Policy/services/hrPolicy.service";
import { getHrSettings, updateHrSettings } from "./src/modules/HR/Policy/helper/hrSettings";
import { completedServiceYears, applicableRule, bandLabel } from "./src/modules/HR/Policy/helper/policyCalc";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[applyHrPolicy] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}
const APPLY = process.argv.includes("--apply");
const yearArg = (() => { const i = process.argv.indexOf("--year"); return i >= 0 ? parseInt(process.argv[i + 1], 10) : new Date().getFullYear(); })();

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

async function main() {
  const svc = new HrPolicyService();
  const settings = await getHrSettings();
  const rules = await svc.activeRules(new Date(yearArg, 11, 31));
  const today = startOfDay(new Date());
  // Boundary for "legacy": the configured policy start, else today (so joined-before-today = legacy).
  const boundary = settings.probationPolicyStartDate ? startOfDay(new Date(settings.probationPolicyStartDate)) : today;

  const emps = await prisma.employee.findMany({
    where: { isDeleted: null, status: { notIn: ["FIRE", "RESIGNED"] } },
    select: { id: true, code: true, name: true, surname: true, joiningDate: true },
    orderBy: { joiningDate: "asc" },
  });

  console.log(`\n[applyHrPolicy] year=${yearArg}  mode=${APPLY ? "APPLY (writing)" : "DRY RUN"}  employees=${emps.length}  proRata=${settings.entitlementProRata}  policyStart=${settings.probationPolicyStartDate ?? "(unset -> today)"}\n`);
  console.log("CODE        NAME                 SERVICE  BAND           POLICY  CURRENT  ACTION");
  console.log("-".repeat(92));

  let toCreate = 0, flagged = 0;
  for (const e of emps) {
    const years = completedServiceYears(e.joiningDate, new Date(yearArg, 0, 1));
    const band = bandLabel(applicableRule(rules, years, new Date(yearArg, 0, 1)));
    const ent = await svc.previewEntitlement(e.id, yearArg);
    const existing = await svc.allocationsForYear(e.id, yearArg);
    const current = existing.reduce((s, a) => s + (a.assignedDays || 0), 0);
    const willCreate = existing.length === 0;
    const policyBelow = existing.length > 0 && ent.annualLeaveDays < current;
    if (willCreate) toCreate++;
    if (policyBelow) flagged++;
    const action = willCreate ? "create POLICY" : (policyBelow ? `KEEP current — policy ${ent.annualLeaveDays} < current ${current} (HR decide)` : "keep (has allocation)");
    const name = `${e.name} ${e.surname || ""}`.trim().slice(0, 20).padEnd(20);
    console.log(`${(e.code || "").padEnd(11)} ${name} ${(years + "y").padEnd(7)} ${band.padEnd(14)} ${String(ent.annualLeaveDays).padStart(6)}  ${String(current).padStart(7)}  ${action}`);
    if (APPLY) await svc.applyEntitlement(e.id, yearArg); // create-only; never reduces/deletes
  }

  // Legacy confirmation (one-time).
  const legacy = await svc.legacyToConfirm(boundary);
  console.log("\n" + "-".repeat(92));
  console.log(`\nLegacy staff to mark CONFIRMED (joined before ${boundary.toISOString().slice(0, 10)}, >${settings.probationMonths} months, never confirmed): ${legacy.length}`);
  for (const e of legacy.slice(0, 20)) console.log(`  ${(e.code || "").padEnd(11)} ${`${e.name} ${e.surname || ""}`.trim()}  (joined ${new Date(e.joiningDate).toISOString().slice(0, 10)})`);
  if (legacy.length > 20) console.log(`  … and ${legacy.length - 20} more`);

  if (APPLY) {
    for (const e of legacy) await svc.confirmLegacy(e.id);
    if (!settings.probationPolicyStartDate) {
      await updateHrSettings({ probationPolicyStartDate: today.toISOString() });
      console.log(`\n  set probationPolicyStartDate = ${today.toISOString().slice(0, 10)} (new hires on/after this are tracked).`);
    }
  }

  console.log(`\nSummary: ${toCreate} POLICY allocation(s) ${APPLY ? "created" : "to create"}; ${flagged} flagged (policy < current, left untouched); ${legacy.length} legacy staff ${APPLY ? "confirmed" : "to confirm"}.`);
  console.log(APPLY ? "APPLIED — no existing allocation was reduced or deleted." : "DRY RUN — nothing was written. Re-run with --apply.");
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
