/**
 * Face capture QA (QA_ data only, self-cleaning). Covers the spec's list:
 *   link expiry / revoke / single use, upload replace, auth on downloads, register + holdout test
 *   (with generated sample images against a MOCK face service), the auto-delete job, storage math,
 *   and RBAC under RBAC_ENFORCE=on.
 *
 * A tiny in-process HTTP server stands in for the Project-40 face service (FACE_API_URL), so register
 * and test-match run deterministically without the real Python service. The DB+disk flow runs in-
 * process; the RBAC / download-auth checks hit the running backend over HTTP (needs RBAC_ENFORCE=on).
 *
 *   RBAC_ENFORCE=on (server)   npx ts-node qa/faceCapture.ts   (results in qa/.facecapture-last.txt)
 */
process.env.QA_KEEP_TEST_EMPLOYEES = "1";
process.env.FACE_API_KEY = "qa-key";
import http from "http";
import { AddressInfo } from "net";
import { createCanvas } from "canvas";

// ---- mock face service (started before anything calls it; FACE_API_URL set from its address) ----
const mock = { expectId: "", mode: "pass" as "pass" | "fail", enrolls: 0, restores: 0, matches: 0 };
const mockServer = http.createServer((req, res) => {
  const url = req.url || "";
  const reply = (code: number, body: any) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  // drain the body (we don't parse multipart; the test sets expectId/mode directly)
  req.on("data", () => {});
  req.on("end", () => {
    if (url.startsWith("/enroll/images")) { mock.enrolls++; return reply(200, { enrolled: 10, skipped: [] }); }
    if (/\/employees\/.+\/restore$/.test(url)) { mock.restores++; return reply(200, { ok: true }); }
    if (url.startsWith("/get-employee")) {
      mock.matches++;
      if (mock.mode === "pass") return reply(200, { status: "success", confidence: 0.96, distance: 0.3, expected_distance: 0.3, source: "gallery", employee: { employee_id: mock.expectId, code: "QA" } });
      return reply(200, { status: "success", confidence: 0.9, distance: 0.42, expected_distance: 0.85, source: "gallery", employee: { employee_id: `${mock.expectId}-OTHER`, code: "OTHER" } });
    }
    return reply(404, { detail: "no mock for " + url });
  });
});

import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import { http as httpCall, mintTokenFor } from "./lib";
import { purgeQaEmployees } from "./qaPurge";
import path from "path";
import { captureDir, FACE_ROOT } from "../src/modules/AMS/FaceCapture/helper/faceCaptureFiles";

const TAG = `QA_FACE_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

function sampleJpeg(bright = 130): Buffer {
  const c = createCanvas(320, 320);
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${bright},${bright},${bright})`;
  ctx.fillRect(0, 0, 320, 320);
  ctx.fillStyle = "#202020"; ctx.fillRect(40, 40, 120, 120); // some edges -> non-zero sharpness
  ctx.fillStyle = "#e0e0e0"; ctx.fillRect(180, 180, 90, 90);
  return c.toBuffer("image/jpeg", { quality: 0.9 });
}
function sampleSet() {
  const plan: [string, number][] = [["front", 4], ["left", 2], ["right", 2], ["up", 1], ["down", 1], ["close", 2], ["glasses", 1], ["light", 1]];
  const files: any[] = []; const frames: any[] = [];
  for (const [b, n] of plan) for (let i = 1; i <= n; i++) {
    const name = `${b}_${String(i).padStart(2, "0")}.jpg`;
    const buffer = sampleJpeg();
    files.push({ originalname: name, buffer, size: buffer.length });
    frames.push({ name, bucket: b, yaw: b === "left" ? -20 : b === "right" ? 20 : 0, pitch: b === "up" ? 15 : b === "down" ? -15 : 0 });
  }
  return { files, meta: JSON.stringify({ device: "QA phone", frames }) };
}

async function main() {
  await new Promise<void>((r) => mockServer.listen(0, "127.0.0.1", r));
  process.env.FACE_API_URL = `http://127.0.0.1:${(mockServer.address() as AddressInfo).port}`;
  const FaceCaptureService = (await import("../src/modules/AMS/FaceCapture/services/faceCapture.service")).default;
  const StorageService = (await import("../src/modules/Admin/Storage/services/storage.service")).default;
  const svc = new FaceCaptureService();
  const storage = new StorageService();

  const ids = { emps: [] as string[], users: [] as string[] };
  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      const emp = await prisma.employee.create({ data: { name: "QAFace", surname: "One", address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_E`, status: "ACTIVE" } as any });
      ids.emps.push(emp.id);
      mock.expectId = emp.id;
      // Manager user: all-units + the face features. Low-priv user: login only.
      const mgr = await prisma.user.create({ data: { username: `${TAG}.mgr@test.local`, password: "x" } as any });
      await prisma.featurePermission.create({ data: { parentType: "User", parentId: mgr.id, permissions: { allowedFeatures: ["login.admin.*", "ams.viewAll.unit.*", "faceCapture.*", "storage.read.*"] } as any, createdAt: new Date() } as any });
      const low = await prisma.user.create({ data: { username: `${TAG}.low@test.local`, password: "x" } as any });
      await prisma.featurePermission.create({ data: { parentType: "User", parentId: low.id, permissions: { allowedFeatures: ["login.admin.*"] } as any, createdAt: new Date() } as any });
      ids.users.push(mgr.id, low.id);

      // ---- links: create, revoke-previous, expiry ----
      const l1 = await svc.createLink(mgr.id, { employeeId: emp.id, hours: 24 });
      check("createLink returns a token + ~24h expiry", !!l1.token && Math.abs((+new Date(l1.expiresAt) - Date.now()) / 3600000 - 24) < 0.1, `h=${l1.hours}`);
      const info1 = await svc.publicInfo(l1.token);
      check("publicInfo: active link shows employee name/code", info1.state === "active" && info1.employee.code === `${TAG}_E`);
      const l2 = await svc.createLink(mgr.id, { employeeId: emp.id, hours: 1 });
      check("new link REVOKES the previous one", (await svc.publicInfo(l1.token)).state === "revoked");
      let badHours = false; try { await svc.createLink(mgr.id, { employeeId: emp.id, hours: 200 }); } catch { badHours = true; }
      check("validity > 7 days is rejected", badHours);

      // ---- public upload: replace + single use ----
      const set = sampleSet();
      const up = await svc.publicUpload(l2.token, set.files, set.meta, "QA-UA");
      check("publicUpload stores the set + marks the link used", up.imageCount === set.files.length && (await svc.publicInfo(l2.token)).state === "used", `n=${up.imageCount}`);
      let reused = false; try { await svc.publicUpload(l2.token, set.files, set.meta, "QA-UA"); } catch (e: any) { reused = e?.statusCode === 410; }
      check("the same link cannot be used twice (410)", reused);
      const firstCaptureId = up.captureId;
      const firstDir = captureDir(emp.id, firstCaptureId);
      check("photos are on disk after upload", fs.existsSync(firstDir));

      // second capture via a fresh link REPLACES the first (old files deleted, record kept)
      const l3 = await svc.createLink(mgr.id, { employeeId: emp.id, hours: 24 });
      const set2 = sampleSet();
      const up2 = await svc.publicUpload(l3.token, set2.files, set2.meta, "QA-UA");
      check("a new upload replaces the previous set (old photos removed from disk)", !fs.existsSync(firstDir) && fs.existsSync(captureDir(emp.id, up2.captureId)));
      const firstRow = await prisma.faceCapture.findUnique({ where: { id: firstCaptureId }, select: { replacedAt: true, deletedAt: true } });
      check("the replaced capture's record is kept (replacedAt set)", !!firstRow?.replacedAt && !!firstRow?.deletedAt);

      // ---- storage math: face bytes > 0 and match disk ----
      const st = await storage.employee(emp.id);
      check("storage: faceCaptures bytes > 0 after upload", st.faceCaptures > 0, `face=${st.faceCaptures} total=${st.total}`);

      // ---- register (pass) + holdout test ----
      mock.mode = "pass";
      const reg = await svc.register(mgr.id, { employeeId: emp.id });
      check("register PASSES with a clean set (status REGISTERED)", reg.passed && reg.status === "REGISTERED", reg.reason || "");
      check("register enrolled frames + ran a holdout test", reg.enrolled > 0 && reg.test.frames.length >= 2 && mock.enrolls >= 1 && mock.matches >= 2);
      const afterReg = await prisma.faceCapture.findUnique({ where: { id: up2.captureId }, select: { status: true, deleteAfter: true } });
      check("REGISTERED sets a 7-day deleteAfter", afterReg?.status === "REGISTERED" && !!afterReg?.deleteAfter);
      const tm = await svc.testMatch(mgr.id, { employeeId: emp.id });
      check("testMatch re-runs the holdout and passes", tm.passed);

      // ---- register (fail) -> NEEDS_REDO + restore ----
      const l4 = await svc.createLink(mgr.id, { employeeId: emp.id, hours: 24 });
      const set3 = sampleSet();
      await svc.publicUpload(l4.token, set3.files, set3.meta, "QA-UA");
      mock.mode = "fail";
      const beforeRestores = mock.restores;
      const reg2 = await svc.register(mgr.id, { employeeId: emp.id });
      check("register FAILS when the match is wrong -> NEEDS_REDO", !reg2.passed && reg2.status === "NEEDS_REDO" && !!reg2.reason);
      check("a failed register RESTORES the previous face data", mock.restores > beforeRestores);

      // ---- verify (only after a good register) ----
      mock.mode = "pass";
      const l5 = await svc.createLink(mgr.id, { employeeId: emp.id, hours: 24 });
      const set4 = sampleSet();
      await svc.publicUpload(l5.token, set4.files, set4.meta, "QA-UA");
      await svc.register(mgr.id, { employeeId: emp.id });
      const ver = await svc.markVerified(mgr.id, { employeeId: emp.id, note: "scanned OK" });
      check("markVerified -> VERIFIED", ver.status === "VERIFIED");

      // ---- auto-delete job: photos go, record stays ----
      const cur = await prisma.faceCapture.findFirst({ where: { employeeId: emp.id, replacedAt: null } });
      const curDir = captureDir(emp.id, cur!.id);
      await prisma.faceCapture.update({ where: { id: cur!.id }, data: { deleteAfter: new Date(Date.now() - 1000) } });
      const removed = await svc.autoDelete(new Date());
      check("autoDelete removes due photos (record kept)", removed >= 1 && !fs.existsSync(curDir) && !!(await prisma.faceCapture.findUnique({ where: { id: cur!.id }, select: { deletedAt: true } }))!.deletedAt);

      // ---- card status ----
      const cardAfter = await svc.status(mgr.id, emp.id);
      check("status(): VERIFIED, photos no longer available after auto-delete", cardAfter.status === "VERIFIED" && cardAfter.capture?.photosAvailable === false);
    });

    // ---- HTTP: RBAC under enforce + auth on downloads (needs the server on :3002, RBAC_ENFORCE=on) ----
    const mgrRow = await prisma.user.findFirst({ where: { username: `${TAG}.mgr@test.local` }, select: { id: true } });
    const lowRow = await prisma.user.findFirst({ where: { username: `${TAG}.low@test.local` }, select: { id: true } });
    const empId = ids.emps[0];
    if (mgrRow && lowRow) {
      const mgrTok = mintTokenFor(mgrRow.id, []); const lowTok = mintTokenFor(lowRow.id, []);
      const canary = await httpCall("POST", "/faceCapture/list", { token: lowTok, body: { page: 1, pageSize: 5 } });
      if (canary.status !== 403) { check("SERVER ENFORCING (low-priv -> /faceCapture/list 403)", false, `got ${canary.status} — is RBAC_ENFORCE=on + face routes built? Skipping HTTP checks.`); }
      else {
        check("RBAC: low-priv 403 on /faceCapture/list", true);
        check("RBAC: low-priv 403 on /faceCapture/link/create", (await httpCall("POST", "/faceCapture/link/create", { token: lowTok, body: { employeeId: empId } })).status === 403);
        check("auth on downloads: low-priv 403 on GET /faceCapture/zip", (await httpCall("GET", `/faceCapture/zip?captureId=x`, { token: lowTok })).status === 403);
        check("RBAC: manager 200 on /faceCapture/list", (await httpCall("POST", "/faceCapture/list", { token: mgrTok, body: { page: 1, pageSize: 5 } })).status === 200);
        // a fresh public link, read with no auth
        const l = await (new FaceCaptureService()).createLink(mgrRow.id, { employeeId: empId, hours: 1 });
        check("public: GET /faceCapturePublic/info/<token> works with NO auth", (await httpCall("GET", `/faceCapturePublic/info/${l.token}`, {})).status === 200);
        check("public: unknown token -> 404", (await httpCall("GET", `/faceCapturePublic/info/${"z".repeat(43)}`, {})).status === 404);
      }
    }
  } finally {
    await new Promise<void>((r) => mockServer.close(() => r()));
    // sweep QA face rows + disk + fixtures
    for (const id of ids.emps) {
      try { fs.rmSync(path.join(FACE_ROOT, id), { recursive: true, force: true }); } catch {} // whole employee face dir
      await prisma.faceCapture.deleteMany({ where: { employeeId: id } }).catch(() => {});
      await prisma.faceCaptureLink.deleteMany({ where: { employeeId: id } }).catch(() => {});
    }
    await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: { in: ids.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } }).catch(() => {});
    await purgeQaEmployees(prisma, "QA_FACE_").catch(() => {});
  }

  out(`\n[faceCapture] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.facecapture-last.txt", lines.join("\n") + "\n"); } catch {}
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch(async (e) => { out(`ERROR ${e?.stack || e?.message || e}`); try { fs.writeFileSync("qa/.facecapture-last.txt", lines.join("\n") + "\nERROR\n"); } catch {} await prisma.$disconnect(); process.exitCode = 1; });
