/**
 * Verifies the per-unit attendance timing override (HEAD OFFICE).
 * Setup/teardown via prisma (local); status computed through the real markAttendance API path.
 *   npx ts-node qa/verify_unit_timing.ts
 */
import { api, mintGodToken } from "./lib";
import prisma from "../src/core/models/base.model";

const HEAD_OFFICE = "a63bd7ef-50fc-48ec-bb7a-554f5bd35e09";
const GOD = mintGodToken();

// 10:00 Pakistan (UTC+5) = 05:00 UTC
const shiftStartUtc = "2020-01-01T05:00:00.000Z";
const shiftEndUtc = "2020-01-01T13:00:00.000Z";
// checkIn ISO for a given date at 10:00 Pakistan + offset minutes
const checkIn = (date: string, offsetMin: number) => {
  const d = new Date(`${date}T05:00:00.000Z`);
  d.setUTCMinutes(d.getUTCMinutes() + offsetMin);
  return d.toISOString();
};

async function mkEmployee(code: string) {
  const e = await prisma.employee.create({
    data: {
      name: "QAUT", surname: code, address: "QA", dob: new Date("1990-01-01"),
      joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300-0000000",
      designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX" as any, code,
    },
  });
  const sh = await prisma.shift.create({ data: { name: `QAUT_Shift_${code}`, startTime: new Date(shiftStartUtc), endTime: new Date(shiftEndUtc), description: "QA" } as any });
  await prisma.shiftAssignment.create({ data: { employeeId: e.id, shiftId: sh.id, startDate: new Date("2099-01-01") } as any });
  return { empId: e.id, shiftId: sh.id };
}

async function mark(empId: string, date: string, offsetMin: number): Promise<string> {
  const r = await api("POST", "/attendance/markAttendance", GOD, { employeeId: empId, date, status: "PRESENT", checkIn: checkIn(date, offsetMin) });
  return r.data?.data?.status ?? r.data?.status ?? `ERR ${r.status}`;
}

async function main() {
  const ts = Date.now();
  const ho = await mkEmployee(`QAUT-HO-${ts}`);
  const ctrl = await mkEmployee(`QAUT-CTRL-${ts}`);
  await prisma.unitEmployee.create({ data: { unitId: HEAD_OFFICE, employeeId: ho.empId } as any });
  const empIds = [ho.empId, ctrl.empId];

  const results: string[] = [];
  try {
    // PHASE A: distinctive override (grace 15) to prove the per-unit path is used (global grace = 5)
    await prisma.unit.update({ where: { id: HEAD_OFFICE }, data: { lateGraceMinutes: 15, halfDayLateMinutes: 90 } as any });
    const aHO = await mark(ho.empId, "2099-06-01", 10);   // 10:10, HO grace 15 -> PRESENT
    const aCTRL = await mark(ctrl.empId, "2099-06-01", 10); // 10:10, global grace 5 -> LATE
    results.push(`A) check-in 10:10  HEAD OFFICE(grace15)=${aHO} [expect PRESENT]   control(global grace5)=${aCTRL} [expect LATE]  -> ${aHO === "PRESENT" && aCTRL === "LATE" ? "PASS (per-unit override applied)" : "FAIL"}`);

    // PHASE B: final requested values (grace 5, half-day 90) for HEAD OFFICE
    await prisma.unit.update({ where: { id: HEAD_OFFICE }, data: { lateGraceMinutes: 5, halfDayLateMinutes: 90 } as any });
    const b1 = await mark(ho.empId, "2099-06-02", 3);   // 10:03 -> PRESENT
    const b2 = await mark(ho.empId, "2099-06-03", 10);  // 10:10 -> LATE
    const b3 = await mark(ho.empId, "2099-06-04", 120); // 12:00 (>11:30) -> HALF_DAY
    results.push(`B) HEAD OFFICE final grace=5 halfDay=90:  10:03=${b1} [PRESENT]  10:10=${b2} [LATE]  12:00=${b3} [HALF_DAY]  -> ${b1 === "PRESENT" && b2 === "LATE" && b3 === "HALF_DAY" ? "PASS" : "FAIL"}`);
  } finally {
    // teardown temp employees and their rows; LEAVE the HEAD OFFICE override at 5/90 (as requested)
    await prisma.attendance.deleteMany({ where: { employeeId: { in: empIds } } });
    await prisma.shiftAssignment.deleteMany({ where: { employeeId: { in: empIds } } });
    await prisma.unitEmployee.deleteMany({ where: { employeeId: { in: empIds } } });
    await prisma.shift.deleteMany({ where: { id: { in: [ho.shiftId, ctrl.shiftId] } } });
    await prisma.employee.deleteMany({ where: { id: { in: empIds } } });
  }

  const ho2 = await prisma.unit.findUnique({ where: { id: HEAD_OFFICE }, select: { name: true, lateGraceMinutes: true, halfDayLateMinutes: true } });
  console.log("\n=== Per-unit timing verification ===");
  results.forEach((r) => console.log(r));
  console.log(`\nHEAD OFFICE now: name="${ho2?.name}" lateGraceMinutes=${ho2?.lateGraceMinutes} halfDayLateMinutes=${ho2?.halfDayLateMinutes}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
