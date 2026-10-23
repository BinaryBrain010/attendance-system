/**
 * A3 — per-unit holidays affect attendance only for that unit (LOCAL ONLY, QA_ data, self-cleaning).
 *   - A unit-specific holiday marks HOLIDAYS attendance ONLY for that unit's employees.
 *   - A company holiday (empty unitIds) marks everyone.
 * Run: npx ts-node qa/holidayUnit.ts
 */
import prisma from "../src/core/models/base.model";
import { runAsSystem } from "../src/core/context/requestContext";
import HolidayService from "../src/modules/AMS/Holiday/services/holiday.service";

const S = Date.now();
const svc = new HolidayService();
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  FAIL", m); } };
const made: any = { units: [], emps: [], ues: [], holidays: [] };

async function attStatus(empId: string, date: Date) {
  const s = new Date(date); s.setHours(0, 0, 0, 0);
  const e = new Date(date); e.setHours(23, 59, 59, 999);
  const row = await prisma.attendance.findFirst({ where: { employeeId: empId, date: { gte: s, lte: e }, isDeleted: null }, select: { status: true } });
  return row?.status ?? null;
}

async function mkUnit(name: string) {
  const u = await prisma.unit.create({ data: { name: `QA_HU_${name}_${S}`, type: "OFFICE" as any } });
  made.units.push(u.id); return u.id;
}
async function mkEmp(code: string, unitId: string) {
  const emp: any = await prisma.employee.create({ data: { name: "QA", surname: code, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0", designation: "QA", department: "QA", martialStatus: "SINGLE", company: "SOLARMAX" as any, code: `QA_HU_${code}_${S}`, status: "ACTIVE" as any } });
  made.emps.push(emp.id);
  const ue = await prisma.unitEmployee.create({ data: { unitId, employeeId: emp.id } });
  made.ues.push(ue.id);
  return emp.id;
}

async function main() {
  const unitA = await mkUnit("A"), unitB = await mkUnit("B");
  const empA = await mkEmp("A", unitA), empB = await mkEmp("B", unitB);
  const d1 = new Date("2027-03-16T00:00:00.000Z"); // unit-specific holiday date
  const d2 = new Date("2027-03-17T00:00:00.000Z"); // company holiday date

  // 1) unit-specific holiday for unit A
  const h1: any = await svc.createHoliday({ date: d1 as any, reason: `QA_HU unitA ${S}`, isActive: true, unitIds: [unitA] } as any);
  made.holidays.push((Array.isArray(h1) ? h1[0] : h1).id);
  ok((await attStatus(empA, d1)) === "HOLIDAYS", "unit holiday -> empA (in unit) marked HOLIDAYS");
  ok((await attStatus(empB, d1)) === null, "unit holiday -> empB (other unit) NOT marked");

  // 2) company holiday (no units)
  const h2: any = await svc.createHoliday({ date: d2 as any, reason: `QA_HU company ${S}`, isActive: true, unitIds: [] } as any);
  made.holidays.push((Array.isArray(h2) ? h2[0] : h2).id);
  ok((await attStatus(empA, d2)) === "HOLIDAYS", "company holiday -> empA marked HOLIDAYS");
  ok((await attStatus(empB, d2)) === "HOLIDAYS", "company holiday -> empB marked HOLIDAYS");

  // cleanup
  for (const d of [d1, d2]) {
    const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(23, 59, 59, 999);
    await prisma.attendance.deleteMany({ where: { employeeId: { in: made.emps }, date: { gte: s, lte: e } } }).catch(() => {});
  }
  await prisma.holiday.deleteMany({ where: { id: { in: made.holidays } } }).catch(() => {});
  await prisma.unitEmployee.deleteMany({ where: { id: { in: made.ues } } }).catch(() => {});
  await prisma.employee.deleteMany({ where: { id: { in: made.emps } } }).catch(() => {});
  await prisma.unit.deleteMany({ where: { id: { in: made.units } } }).catch(() => {});
  await prisma.$disconnect();
  console.log(`\n[holidayUnit] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  if (fail) process.exit(1);
}
runAsSystem(() => main()).catch((e) => { console.error(e); process.exit(1); });
