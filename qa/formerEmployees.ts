/**
 * Former-employee exclusion QA (QA_ data only, self-cleaning). Proves a resigned/fired employee is
 * absent from the Quick Mark reports, the employee pickers and the absent cron, and that the monthly
 * report's past-month exception (exit date inside the month → included with "Left on …") works.
 *
 *   npx ts-node qa/formerEmployees.ts   (results in qa/.former-last.txt)
 */
process.env.QA_KEEP_TEST_EMPLOYEES = "1"; // QA harness: let this suite see the QA_ fixtures it creates (safety-net bypass; never set in prod)

import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import AmsReportService from "../src/modules/AMS/Report/services/amsReport.service";
import AttendanceScheduleService from "../src/modules/AMS/Attendance/services/schedule.service";
import employeeModel from "../src/modules/AMS/Employee/models/employee.model";

const TAG = `QA_FORMER_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

const YEAR = 2026, MONTH = 3; // March 2026

async function main() {
  const ids = { emps: [] as string[], units: [] as string[], ues: [] as string[], att: [] as string[] };
  const svc = new AmsReportService();

  async function mkEmp(suffix: string, status: string, resignationDate: Date | null) {
    const e = await prisma.employee.create({ data: { name: "QAFormer", surname: suffix, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "Engineer", department: "QA-Former-Dept", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_${suffix}`, status: status as any, resignationDate } as any });
    ids.emps.push(e.id); return e;
  }
  async function att(employeeId: string, day: number, status: string) {
    const a = await prisma.attendance.create({ data: { employeeId, date: new Date(YEAR, MONTH - 1, day), status: status as any, checkIn: null, checkOut: null } as any });
    ids.att.push(a.id);
  }

  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      const unit = await prisma.unit.create({ data: { name: `${TAG}_U`, type: "OFFICE" } as any });
      ids.units.push(unit.id);

      const active = await mkEmp("ACTIVE", "ACTIVE", null);
      const resigned = await mkEmp("RESIGNED", "RESIGNED", new Date(YEAR, MONTH - 1, 10)); // left 10 Mar 2026
      const fired = await mkEmp("FIRE", "FIRE", null); // no exit date stored
      for (const e of [active.id, resigned.id, fired.id]) {
        const ue = await prisma.unitEmployee.create({ data: { unitId: unit.id, employeeId: e } as any }); ids.ues.push(ue.id);
      }
      // Give everyone a PRESENT row in March so a wrongly-included former would actually appear.
      for (const e of [active.id, resigned.id, fired.id]) await att(e, 5, "PRESENT");

      const codeOf = (rows: any[], id: string) => rows.some((r) => r.employeeId === id || r.id === id);

      // 1) Monthly report for a DIFFERENT month (Feb 2026): no former appears (resigned exited in March).
      const feb = await svc.monthlyRows(GOD_ID, { year: YEAR, month: 2, department: "QA-Former-Dept" } as any);
      check("Feb report: active present", codeOf(feb.rows, active.id));
      check("Feb report: resigned EXCLUDED (exit not in Feb)", !codeOf(feb.rows, resigned.id));
      check("Feb report: fired EXCLUDED", !codeOf(feb.rows, fired.id));

      // 2) Monthly report for the exit month (March): resigned included with "Left on 10 Mar 2026".
      const mar = await svc.monthlyRows(GOD_ID, { year: YEAR, month: MONTH, department: "QA-Former-Dept" } as any);
      const resignedRow = mar.rows.find((r) => r.employeeId === resigned.id);
      check("March report: active present", codeOf(mar.rows, active.id));
      check("March report: resigned INCLUDED (exit in month)", !!resignedRow);
      check("March report: resigned remark 'Left on …'", !!resignedRow && /^Left on 10 Mar 2026/.test(resignedRow.remark || ""), resignedRow?.remark || "");
      check("March report: fired EXCLUDED (no exit date)", !codeOf(mar.rows, fired.id));

      // 3) A non-monthly report (leave balance): no exception — formers excluded even in-month.
      const lb = await svc.leaveBalance(GOD_ID, { year: YEAR, department: "QA-Former-Dept" } as any);
      check("Leave balance: active present", lb.some((r: any) => r.code === `${TAG}_ACTIVE`));
      check("Leave balance: resigned EXCLUDED", !lb.some((r: any) => r.code === `${TAG}_RESIGNED`));
      check("Leave balance: fired EXCLUDED", !lb.some((r: any) => r.code === `${TAG}_FIRE`));

      // 4) Employee picker (dropdown source): formers absent, active present.
      const picker: any[] = await (employeeModel as any).employee.gpFindFilterMany();
      const inPicker = (id: string) => picker.some((p) => p.id === id);
      check("Picker: active present", inPicker(active.id));
      check("Picker: resigned EXCLUDED", !inPicker(resigned.id));
      check("Picker: fired EXCLUDED", !inPicker(fired.id));

      // 5) Employee list default = Active; 'all' shows formers; 'RESIGNED' shows only resigned.
      const listDefault: any = await (employeeModel as any).employee.gpPgFindManyWithSortAndFilter(1, 500, "createdAt", "desc", undefined, "QAFormer", undefined, undefined, undefined, GOD_ID);
      const listAll: any = await (employeeModel as any).employee.gpPgFindManyWithSortAndFilter(1, 500, "createdAt", "desc", "all", "QAFormer", undefined, undefined, undefined, GOD_ID);
      const listResigned: any = await (employeeModel as any).employee.gpPgFindManyWithSortAndFilter(1, 500, "createdAt", "desc", "RESIGNED", "QAFormer", undefined, undefined, undefined, GOD_ID);
      const dd = (listDefault.data || listDefault) as any[];
      const da = (listAll.data || listAll) as any[];
      const dr = (listResigned.data || listResigned) as any[];
      check("List default: active present, formers absent", dd.some((r) => r.id === active.id) && !dd.some((r) => r.id === resigned.id) && !dd.some((r) => r.id === fired.id));
      check("List 'all': formers present", da.some((r) => r.id === resigned.id) && da.some((r) => r.id === fired.id));
      check("List 'RESIGNED': only resigned", dr.some((r) => r.id === resigned.id) && !dr.some((r) => r.id === active.id) && !dr.some((r) => r.id === fired.id));

      // 6) Absent cron source: never returns a former employee (so they're never marked absent).
      const nonMarked = await new AttendanceScheduleService().getNonMarkedEmployees();
      check("Absent cron: resigned NOT in non-marked set", !nonMarked.includes(resigned.id));
      check("Absent cron: fired NOT in non-marked set", !nonMarked.includes(fired.id));
    });
  } finally {
    for (const id of ids.att) await prisma.attendance.delete({ where: { id } }).catch(() => {});
    for (const id of ids.ues) await prisma.unitEmployee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.units) await prisma.unit.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[formerEmployees] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.former-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
