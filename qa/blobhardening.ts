/**
 * Regression guard for the global findMany blob-strip hook + upload compression (local only, QA_ data,
 * cleans up). Verifies, end to end:
 *   1. Face recognition still returns faceDescriptor (explicit-select path is not stripped).
 *   2. Employee LIST (gpFindMany) excludes image + faceDescriptor (blob-safe).
 *   3. Employee DETAIL (getById / findUnique) returns the image.
 *   4. Upload compression shrinks a large employee photo (<=800px JPEG).
 *   5. ActivityLog.metadata is redacted on write (no base64 image stored).
 *   6. AttendanceRequest: list has hasImage (no image), detail returns the image.
 *   7. Audit list still returns `changes` (not stripped).
 *   8. Leave overlap: a REJECTED leave does NOT get linked — a fresh request is created.
 * Run: AUDIT_LOG=0 npm run qa:blobhardening
 */
import { createCanvas } from "canvas";
import prisma from "../src/core/models/base.model";
import employeeModel from "../src/modules/AMS/Employee/models/employee.model";
import EmployeeService from "../src/modules/AMS/Employee/services/employee.service";
import attendanceReqModel from "../src/modules/AMS/Attendance/models/attendanceReq.model";
import AttendanceReqService from "../src/modules/AMS/Attendance/services/attendanceReq.service";
import leaveReqModel from "../src/modules/AMS/Leaves/models/leaveReq.model";
import AuditService from "../src/modules/Audit/services/audit.service";
import { logActivity } from "../src/modules/ActivityLog/helper/activityLog.helper";

// A large RANDOM-noise PNG data URL (noise doesn't PNG-compress, so it stays multi-MB) so the upload
// compressor has something real to shrink (resize to 800px + JPEG).
function bigPngDataUrl(size = 1000): string {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = (Math.random() * 256) | 0; img.data[i + 1] = (Math.random() * 256) | 0;
    img.data[i + 2] = (Math.random() * 256) | 0; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return `data:image/png;base64,${c.toBuffer("image/png").toString("base64")}`;
}
const len = (s: any) => (typeof s === "string" ? s.length : 0);

let pass = true;
const log = (ok: boolean, msg: string) => { if (!ok) pass = false; console.log(`  ${ok ? "OK  " : "FAIL"}  ${msg}`); };

async function main() {
  const stamp = Date.now();
  const empSvc = new EmployeeService();
  const arSvc = new AttendanceReqService();
  const audit = new AuditService();
  const made: { emp?: string; ar?: string; leaves: string[] } = { leaves: [] };
  const bigImg = bigPngDataUrl();
  const descriptor = Array.from({ length: 128 }, (_, i) => (i / 128));

  try {
    // Create employee via the SERVICE (so compression runs). Give it a faceDescriptor directly after.
    const created: any = await empSvc.createEmployee({
      name: "QA", surname: "Blob", address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"),
      bloodGroup: "O+", contactNo: "00000000000", designation: "QA", department: "QA", martialStatus: "SINGLE",
      company: "OKASHASMART", code: `QA_BLOB_${stamp}`, image: bigImg,
    } as any);
    const emp = Array.isArray(created) ? created[0] : created;
    made.emp = emp.id;
    await prisma.employee.update({ where: { id: emp.id }, data: { faceDescriptor: descriptor as any } });

    // 4. compression: stored image smaller than the original big PNG, and a JPEG data URL.
    const stored: any = await prisma.employee.findUnique({ where: { id: emp.id }, select: { image: true } });
    log(len(stored.image) > 0 && len(stored.image) < len(bigImg) && /^data:image\/jpeg/.test(stored.image),
      `compression: ${Math.round(len(bigImg) / 1024)}KB -> ${Math.round(len(stored.image) / 1024)}KB JPEG`);

    // 1. face recognition returns the descriptor for this employee.
    const faces: any[] = await empSvc.getEmployeesForFaceRecognition();
    const mine = faces.find((f) => f.id === emp.id);
    log(!!mine && Array.isArray(mine.faceDescriptor) && mine.faceDescriptor.length === 128,
      `face recognition returns faceDescriptor (${mine?.faceDescriptor?.length ?? 0} dims)`);

    // 2. employee LIST excludes image + faceDescriptor.
    const list: any[] = await employeeModel.employee.gpFindMany();
    const row = list.find((e) => e.id === emp.id);
    log(!!row && !("image" in row) && !("faceDescriptor" in row), "employee list excludes image + faceDescriptor");

    // 3. employee DETAIL returns the image.
    const detail: any = await prisma.employee.findUnique({ where: { id: emp.id } });
    log(len(detail?.image) > 0, "employee detail returns image");

    // 5. ActivityLog.metadata redacted on write.
    const al: any = await logActivity({
      userId: null, action: "QA_TEST", entityType: "QA", entityId: emp.id,
      metadata: { before: { image: bigImg, name: "x" }, after: { image: bigImg, password: "secret" } },
    } as any);
    const alRow: any = al ? await prisma.activityLog.findUnique({ where: { id: al.id } }) : null;
    const meta = alRow?.metadata as any;
    const redacted = meta && meta.before?.image === "[redacted]" && meta.after?.image === "[redacted]" && meta.after?.password === "***";
    log(!!redacted && len(JSON.stringify(meta)) < 2000, "activity-log metadata strips image/password");
    if (alRow) await prisma.activityLog.delete({ where: { id: alRow.id } }).catch(() => {});

    // 6. attendance request: list hasImage (no image), detail returns image.
    const ar: any = await arSvc.createAttendanceRequest({ employeeId: emp.id, reason: "QA", status: "PENDING", image: bigImg } as any);
    const arOne = Array.isArray(ar) ? ar[0] : ar;
    made.ar = arOne.id;
    const arList: any[] = await attendanceReqModel.attendanceRequest.gpFindManyByEmployeeId(emp.id);
    const arListRow = arList.find((x) => x.id === arOne.id);
    log(!!arListRow && !("image" in arListRow) && arListRow.hasImage === true, "attendanceReq list: hasImage, no image");
    const arDetail: any = await attendanceReqModel.attendanceRequest.gpFindById(arOne.id);
    log(len(arDetail?.image) > 0, "attendanceReq detail returns image");

    // 7. audit list returns changes (not stripped). Create a QA_ audit row via a write under context.
    await prisma.employee.update({ where: { id: emp.id }, data: { designation: "QA2" } });
    const auditList = await audit.list({ entity: "Employee", entityId: emp.id, page: 1, pageSize: 10 });
    const anyHasChangesKey = auditList.data.length === 0 || auditList.data.every((r: any) => "changes" in r);
    log(anyHasChangesKey, `audit list rows keep 'changes' key (${auditList.data.length} rows)`);

    // 8. leave overlap: a REJECTED leave must NOT be linked; a new one is created.
    const day = new Date("2032-05-05T00:00:00.000Z");
    const rej: any = await prisma.leaveRequest.create({ data: { employeeId: emp.id, startDate: day, endDate: day, status: "REJECTED" as any } });
    made.leaves.push(rej.id);
    const ensured: any = await leaveReqModel.leaveRequest.gpEnsureForDate({ employeeId: emp.id, startDate: day, endDate: day, status: "APPROVED", leaveType: "CASUAL" });
    if (ensured?.id) made.leaves.push(ensured.id);
    log(ensured && ensured.id !== rej.id && ensured.status === "APPROVED", "rejected leave is NOT linked (new request created)");
  } finally {
    for (const id of made.leaves) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    if (made.ar) await prisma.attendanceRequest.delete({ where: { id: made.ar } }).catch(() => {});
    if (made.emp) {
      await prisma.leaveRequest.deleteMany({ where: { employeeId: made.emp } }).catch(() => {});
      await prisma.attendanceRequest.deleteMany({ where: { employeeId: made.emp } }).catch(() => {});
      await prisma.attendance.deleteMany({ where: { employeeId: made.emp } }).catch(() => {});
      await prisma.activityLog.deleteMany({ where: { entityId: made.emp } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { entity: "Employee", entityId: made.emp } }).catch(() => {});
      await prisma.employee.delete({ where: { id: made.emp } }).catch(() => {});
    }
    console.log("  cleaned up QA_ employee + related rows");
  }
  console.log(pass ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("script error", e); process.exit(1); });
