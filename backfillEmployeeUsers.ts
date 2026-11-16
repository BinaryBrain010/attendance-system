/**
 * Backfill logins for active employees who don't have one yet (Part 3). DRY-RUN by default: prints the
 * employees + the usernames it WOULD create, and writes nothing. With --apply it creates the accounts
 * (firstname_lastname@phw, temp password, mustChangePassword, Employees group) and writes a CSV of
 * username + temp password to a file OUTSIDE the repo, chmod 600 — the passwords are NEVER printed to
 * the console/log. Existing users are only added to the Employees group; their roles are untouched.
 *
 *   npx ts-node backfillEmployeeUsers.ts                      # dry run (local)
 *   npx ts-node backfillEmployeeUsers.ts --apply              # write + CSV to ~/solarmax-employee-logins-<ts>.csv
 *   npx ts-node backfillEmployeeUsers.ts --apply --out <path> # choose the CSV path (still outside the repo)
 *   npx ts-node backfillEmployeeUsers.ts --apply --allow-remote
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";
import { generateUsername, createUserForEmployee } from "./src/modules/AMS/Employee/models/employee.model";
import { activeEmployeeWhere } from "./src/modules/AMS/Employee/helper/employeeStatus.helper";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[backfillEmployeeUsers] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}
const APPLY = process.argv.includes("--apply");
const OUT = (() => { const i = process.argv.indexOf("--out"); return i >= 0 ? process.argv[i + 1] : path.join(os.homedir(), `solarmax-employee-logins-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`); })();

function csvCell(v: string): string { return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }

async function main() {
  // Active employees whose id is NOT referenced by any non-deleted user.
  const emps = await prisma.employee.findMany({
    where: { ...activeEmployeeWhere(), name: { not: "" }, user: { is: null } } as any,
    select: { id: true, code: true, name: true, surname: true },
    orderBy: [{ code: "asc" }],
  });

  console.log(`\n[backfillEmployeeUsers] host=${host}  mode=${APPLY ? "APPLY (writing)" : "DRY RUN"}  active employees without a login: ${emps.length}\n`);
  if (!emps.length) { console.log("Nothing to backfill.\n"); return; }

  if (!APPLY) {
    console.log("CODE         NAME                      WOULD-CREATE USERNAME");
    console.log("-".repeat(78));
    for (const e of emps) {
      const uname = generateUsername(e.name, e.surname || "");
      console.log(`${(e.code || "").padEnd(12)} ${`${e.name} ${e.surname || ""}`.trim().slice(0, 24).padEnd(24)} ${uname}  (suffix added if taken)`);
    }
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to create ${emps.length} login(s); the temp passwords go to a chmod-600 CSV outside the repo, never the console.\n`);
    return;
  }

  // APPLY — create the logins and collect credentials for the CSV (never logged).
  const rows: string[] = ["code,name,username,temp_password,action"];
  let created = 0, linked = 0, failed = 0;
  await runAsSystem(async () => {
    for (const e of emps) {
      try {
        const r = await createUserForEmployee(e.id, e.name, e.surname || "");
        if (r.created) created++; else linked++;
        rows.push([e.code || "", `${e.name} ${e.surname || ""}`.trim(), r.username, r.tempPassword || "", r.created ? "CREATED" : "LINKED"].map(csvCell).join(","));
      } catch (err: any) {
        failed++;
        console.error(`  FAILED for ${e.code || e.id}: ${err?.message || err}`);
      }
    }
  });

  if (path.resolve(OUT).startsWith(path.resolve(process.cwd()))) {
    console.error(`\nREFUSING to write credentials inside the repo (${OUT}). Pass --out <path> outside the repo.`);
    process.exit(3);
  }
  fs.writeFileSync(OUT, rows.join("\n") + "\n", { mode: 0o600 });
  try { fs.chmodSync(OUT, 0o600); } catch { /* best effort on Windows */ }

  console.log(`\nCreated ${created}, linked ${linked}, failed ${failed}.`);
  console.log(`Credentials (username + temp password) written to: ${OUT}  (chmod 600) — passwords were NOT logged.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
