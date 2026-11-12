/**
 * Apply the HR policy to existing employees. DRY-RUN by default — writes nothing unless --apply.
 * Shows, per active employee: service length, policy band, computed entitlement for the year vs the
 * current POLICY allocation, and flags anyone past probation (3 months) without a confirmation.
 *
 *   npx ts-node applyHrPolicy.ts                      # dry run, current year, local DB
 *   npx ts-node applyHrPolicy.ts --year 2026          # dry run for a specific year
 *   npx ts-node applyHrPolicy.ts --apply              # WRITE the POLICY entitlements
 *   npx ts-node applyHrPolicy.ts --apply --allow-remote
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";
import HrPolicyService from "./src/modules/HR/Policy/services/hrPolicy.service";
import { getHrSettings } from "./src/modules/HR/Policy/helper/hrSettings";
import { completedServiceYears, applicableRule, bandLabel, probationDefaultEnd } from "./src/modules/HR/Policy/helper/policyCalc";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[applyHrPolicy] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}
const APPLY = process.argv.includes("--apply");
const yearArg = (() => { const i = process.argv.indexOf("--year"); return i >= 0 ? parseInt(process.argv[i + 1], 10) : new Date().getFullYear(); })();

async function main() {
  const svc = new HrPolicyService();
  const settings = await getHrSettings();
  const rules = await svc.activeRules(new Date(yearArg, 11, 31));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const emps = await prisma.employee.findMany({
    where: { isDeleted: null, status: { in: ["ACTIVE", "PROBATION", "REJOINED"] } },
    select: { id: true, code: true, name: true, surname: true, joiningDate: true, probationEndDate: true, probationClearedAt: true },
    orderBy: { joiningDate: "asc" },
  });

  console.log(`\n[applyHrPolicy] year=${yearArg}  mode=${APPLY ? "APPLY (writing)" : "DRY RUN"}  employees=${emps.length}  proRata=${settings.entitlementProRata}\n`);
  console.log("CODE        NAME                 SERVICE   BAND           ENTITLEMENT  CURRENT  Δ      PROBATION");
  console.log("-".repeat(104));

  let changed = 0, pastProbation = 0;
  for (const e of emps) {
    const years = completedServiceYears(e.joiningDate, new Date(yearArg, 0, 1));
    const band = bandLabel(applicableRule(rules, years, new Date(yearArg, 0, 1)));
    const ent = await svc.previewEntitlement(e.id, yearArg);
    const current = await prisma.leaveAllocation.findFirst({ where: { employeeId: e.id, isDeleted: null, source: "POLICY", policyYear: yearArg }, select: { assignedDays: true } });
    const cur = current?.assignedDays ?? 0;
    const delta = ent.annualLeaveDays - cur;
    if (delta !== 0 || !current) changed++;

    const probEnd = e.probationEndDate ?? probationDefaultEnd(e.joiningDate, settings.probationMonths);
    const past = !e.probationClearedAt && probEnd < today;
    if (past) pastProbation++;
    const probNote = e.probationClearedAt ? "confirmed" : (probEnd < today ? `PAST (${probEnd.toISOString().slice(0, 10)})` : `ends ${probEnd.toISOString().slice(0, 10)}`);

    const name = `${e.name} ${e.surname || ""}`.trim().slice(0, 20).padEnd(20);
    const svcLen = `${years}y`.padEnd(8);
    console.log(`${(e.code || "").padEnd(11)} ${name} ${svcLen} ${band.padEnd(14)} ${String(ent.annualLeaveDays).padStart(10)}  ${String(cur).padStart(7)}  ${(delta >= 0 ? "+" : "") + delta}`.padEnd(92) + `  ${probNote}`);

    if (APPLY) await svc.applyEntitlement(e.id, yearArg);
  }

  console.log("-".repeat(104));
  console.log(`\nSummary: ${changed} employee(s) would ${APPLY ? "have their" : "need their"} POLICY entitlement set/updated; ${pastProbation} past 3 months WITHOUT a confirmation.`);
  if (!APPLY) console.log("DRY RUN — nothing was written. Re-run with --apply to write the entitlements.");
  else console.log("APPLIED — POLICY leave allocations written/updated.");
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
