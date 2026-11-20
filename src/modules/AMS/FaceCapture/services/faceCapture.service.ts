/**
 * Face capture: links an employee opens on their phone, the photos they upload, and the steps that
 * turn those photos into the face data the attendance scanner matches against.
 *
 * Status of an employee (computed, never stored on the employee):
 *   NOT_STARTED -> LINK_SENT -> CAPTURED -> REGISTERED -> VERIFIED, or NEEDS_REDO.
 * A link newer than the latest capture means LINK_SENT; otherwise the latest capture's status.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { AppError } from "../../../../core/errors/app.error";
import { getAccessibleEmployeeIds, getAccessibleUnitIds, AMS_VIEW_ALL } from "../../Unit/helper/unitAccess.helper";
import { notify } from "../../../Work/shared/workHelpers";
import {
  BUCKETS, Bucket, LIMITS, StoredFile, buildZip, captureDir, cleanImage, removeDir, safeFileName, sniffImage, zipName,
} from "../helper/faceCaptureFiles";
import * as faceApi from "../helper/faceApi.client";

export const EMPLOYEE_ACTIVE = ["ACTIVE", "REJOINED", "PROBATION"];
export const STATUSES = ["NOT_STARTED", "LINK_SENT", "CAPTURED", "REGISTERED", "VERIFIED", "NEEDS_REDO"] as const;
const DELETE_AFTER_DAYS = 7;
const GALLERY_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.9);
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

type LinkState = "active" | "expired" | "used" | "revoked";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function linkState(l: { expiresAt: Date; revokedAt: Date | null; usedAt: Date | null }, now = new Date()): LinkState {
  if (l.usedAt) return "used";
  if (l.revokedAt) return "revoked";
  if (l.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

async function assertInScope(userId: string, employeeId: string) {
  if (!employeeId || typeof employeeId !== "string") throw new AppError(400, "employeeId is required.");
  const scope = await getAccessibleEmployeeIds(userId);
  if (scope !== null && !scope.includes(employeeId)) throw new AppError(403, "This employee is outside your units.");
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, isDeleted: null },
    select: { id: true, name: true, surname: true, code: true, status: true },
  });
  if (!emp) throw new AppError(404, "Employee not found.");
  return emp;
}

/** Display names for user ids: the linked employee's name, else the username. */
async function userNames(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!uniq.length) return {};
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, username: true, employee: { select: { name: true, surname: true } } } as any,
  });
  const out: Record<string, string> = {};
  for (const u of users as any[]) {
    const n = u.employee ? `${u.employee.name ?? ""} ${u.employee.surname ?? ""}`.trim() : "";
    out[u.id] = n || u.username;
  }
  return out;
}

function currentCapture(employeeId: string) {
  return prisma.faceCapture.findFirst({ where: { employeeId, replacedAt: null }, orderBy: { capturedAt: "desc" } });
}

function filesOf(capture: { files: any }): StoredFile[] {
  return Array.isArray(capture.files) ? (capture.files as StoredFile[]) : [];
}

function readFrame(employeeId: string, captureId: string, name: string): Buffer {
  return fs.readFileSync(path.join(captureDir(employeeId, captureId), safeFileName(name)));
}

// ------------------------------------------------------------------------------------------------
// Frame choice for Register: hold 3 frames back for the test, enrol the best 5 to 10 of the rest.
// ------------------------------------------------------------------------------------------------

const usable = (f: StoredFile) => f.brightness >= 40 && f.brightness <= 225;
const bySharp = (a: StoredFile, b: StoredFile) => b.sharpness - a.sharpness;

export function chooseFrames(files: StoredFile[]): { training: StoredFile[]; holdout: StoredFile[] } {
  const pool = files.filter(usable).sort(bySharp);
  const taken = new Set<string>();
  const take = (f?: StoredFile) => { if (f) taken.add(f.name); return f; };
  const best = (buckets: Bucket[], filter: (f: StoredFile) => boolean = () => true) =>
    pool.find((f) => !taken.has(f.name) && buckets.includes(f.bucket) && filter(f));

  // Holdout: one "different light" (or close) frame, one front frame, one slight angle.
  const holdout = [
    take(best(["light"]) || best(["close", "glasses"])),
    take(best(["front"])),
    take(best(["left", "right"]) || best(["front", "close"])),
  ].filter((f): f is StoredFile => !!f);

  // Training: front and slight angles, sharpest first.
  const slight = (f: StoredFile) => f.yaw == null || Math.abs(f.yaw) <= 35;
  const plan: [Bucket[], number][] = [[["front"], 4], [["left"], 1], [["right"], 1], [["close"], 2], [["up"], 1], [["down"], 1]];
  const training: StoredFile[] = [];
  for (const [buckets, n] of plan) {
    for (let i = 0; i < n; i++) { const f = take(best(buckets, slight)); if (f) training.push(f); }
  }
  while (training.length < 10) {
    const f = take(best(["front", "close", "left", "right", "glasses", "up", "down", "light"], slight));
    if (!f) break;
    training.push(f);
  }
  return { training, holdout };
}

type FrameResult = { name: string; bucket: string; face: boolean; matched: boolean; matchedCode: string | null; distance: number | null; expectedDistance: number | null; confidence: number | null; source: string | null };

/** Passes when at least 2 holdout frames show a face and every one of them matches this employee within the threshold. */
function judge(results: FrameResult[]): { passed: boolean; reason: string | null } {
  const faced = results.filter((r) => r.face);
  if (faced.length < 2) return { passed: false, reason: `Only ${faced.length} of ${results.length} test photos showed a face.` };
  const wrong = faced.filter((r) => !r.matched);
  if (wrong.length) {
    const w = wrong[0];
    const why = w.matchedCode ? `matched ${w.matchedCode} instead` : "was not recognised";
    return { passed: false, reason: `${wrong.length} of ${faced.length} test photos failed (${w.name} ${why}${w.expectedDistance != null ? `, distance ${w.expectedDistance}` : ""}).` };
  }
  return { passed: true, reason: null };
}

async function runTest(employeeId: string, captureId: string, holdout: StoredFile[]): Promise<{ passed: boolean; reason: string | null; threshold: number; frames: FrameResult[]; at: string }> {
  const frames: FrameResult[] = [];
  for (const f of holdout) {
    const r = await faceApi.match(readFrame(employeeId, captureId, f.name), employeeId);
    const face = r.status === "success" || r.expectedDistance != null || r.distance != null;
    const matched = r.status === "success" && r.employeeId === employeeId && r.source === "gallery" && (r.distance ?? 9) <= GALLERY_THRESHOLD;
    frames.push({ name: f.name, bucket: f.bucket, face, matched, matchedCode: r.status === "success" && r.employeeId !== employeeId ? r.code : null, distance: r.distance, expectedDistance: r.expectedDistance, confidence: r.confidence, source: r.source });
  }
  const verdict = judge(frames);
  return { ...verdict, threshold: GALLERY_THRESHOLD, frames, at: new Date().toISOString() };
}

class FaceCaptureService {
  // ---------------------------------------------------------------- links

  async createLink(userId: string, body: { employeeId?: string; hours?: number }) {
    const emp = await assertInScope(userId, body.employeeId as string);
    const hours = Number(body.hours ?? 24);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new AppError(400, "Validity must be between 1 hour and 7 days.");
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + Math.round(hours * 3600) * 1000);
    const link = await prisma.$transaction(async (tx: any) => {
      await tx.faceCaptureLink.updateMany({ where: { employeeId: emp.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.faceCaptureLink.create({ data: { employeeId: emp.id, tokenHash: hashToken(token), expiresAt, createdById: userId } });
    });
    // The token is returned once; only its hash is stored.
    return { linkId: link.id, token, expiresAt, hours, employee: { id: emp.id, name: emp.name, surname: emp.surname, code: emp.code } };
  }

  // ---------------------------------------------------------------- public (token) side

  private async linkByToken(token: string) {
    if (!TOKEN_RE.test(token || "")) throw new AppError(404, "This link is not valid.");
    const link = await prisma.faceCaptureLink.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!link) throw new AppError(404, "This link is not valid.");
    return link;
  }

  private stateError(state: LinkState): AppError {
    if (state === "used") return new AppError(410, "These photos were already sent. Ask for a new link if you need to send them again.");
    if (state === "revoked") return new AppError(410, "This link was replaced by a newer one. Use the latest link you received.");
    return new AppError(410, "This link has expired. Ask for a new link.");
  }

  async publicInfo(token: string) {
    const link = await this.linkByToken(token);
    const state = linkState(link);
    const emp = await prisma.employee.findFirst({ where: { id: link.employeeId, isDeleted: null }, select: { name: true, surname: true, code: true } });
    if (!emp) throw new AppError(404, "This link is not valid.");
    return { state, expiresAt: link.expiresAt, employee: { name: `${emp.name} ${emp.surname ?? ""}`.trim(), code: emp.code } };
  }

  async publicUpload(token: string, files: Express.Multer.File[], metaRaw: unknown, userAgent: string) {
    const link = await this.linkByToken(token);
    const state = linkState(link);
    if (state !== "active") throw this.stateError(state);

    const list = Array.isArray(files) ? files : [];
    if (list.length < LIMITS.minFiles) throw new AppError(400, `Send at least ${LIMITS.minFiles} photos.`);
    if (list.length > LIMITS.maxFiles) throw new AppError(400, `Send at most ${LIMITS.maxFiles} photos.`);
    const total = list.reduce((n, f) => n + f.size, 0);
    if (total > LIMITS.maxTotalBytes) throw new AppError(413, "The photos are too large in total.");

    let meta: any = {};
    try { meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : (metaRaw || {}); } catch { throw new AppError(400, "Bad capture details."); }
    const frameMeta: Record<string, { bucket?: string; yaw?: number; pitch?: number }> = {};
    for (const fm of Array.isArray(meta.frames) ? meta.frames : []) if (fm && typeof fm.name === "string") frameMeta[fm.name] = fm;

    // Check and clean every image before the link is spent, so a bad upload can be retried.
    const counters: Record<string, number> = {};
    const prepared: { stored: StoredFile; jpeg: Buffer; thumb: Buffer }[] = [];
    for (const f of list) {
      if (f.size > LIMITS.maxFileBytes) throw new AppError(413, `${f.originalname} is too large.`);
      if (!sniffImage(f.buffer)) throw new AppError(415, `${f.originalname} is not a JPEG or PNG image.`);
      const m = frameMeta[f.originalname] || {};
      const bucketGuess = (m.bucket || f.originalname.split(/[_./]/)[0] || "").toLowerCase();
      if (!(BUCKETS as readonly string[]).includes(bucketGuess)) throw new AppError(400, `Unknown photo group for ${f.originalname}.`);
      const bucket = bucketGuess as Bucket;
      let cleaned;
      try { cleaned = await cleanImage(f.buffer); } catch { throw new AppError(415, `${f.originalname} could not be read as an image.`); }
      counters[bucket] = (counters[bucket] || 0) + 1;
      const name = `${bucket}_${String(counters[bucket]).padStart(2, "0")}.jpg`;
      const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
      prepared.push({
        jpeg: cleaned.jpeg,
        thumb: cleaned.thumb,
        stored: { name, bucket, bytes: cleaned.jpeg.length, width: cleaned.width, height: cleaned.height, sharpness: cleaned.sharpness, brightness: cleaned.brightness, yaw: num(m.yaw), pitch: num(m.pitch) },
      });
    }
    if ((counters.front || 0) < 3) throw new AppError(400, "At least 3 straight-on (front) photos are needed.");

    const captureId = crypto.randomUUID();
    const dir = captureDir(link.employeeId, captureId);
    fs.mkdirSync(path.join(dir, "thumbs"), { recursive: true });
    try {
      for (const p of prepared) {
        fs.writeFileSync(path.join(dir, p.stored.name), p.jpeg);
        fs.writeFileSync(path.join(dir, "thumbs", p.stored.name), p.thumb);
      }
      // Spend the link: only one upload can win, even if two arrive together.
      const claimed = await prisma.faceCaptureLink.updateMany({
        where: { id: link.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        const fresh = await prisma.faceCaptureLink.findUnique({ where: { id: link.id } });
        throw this.stateError(fresh ? linkState(fresh) : "expired");
      }
    } catch (e) {
      removeDir(dir);
      throw e;
    }

    // Replace the previous set: its photos go, its record stays.
    const previous = await prisma.faceCapture.findMany({ where: { employeeId: link.employeeId, replacedAt: null }, select: { id: true, deletedAt: true } });
    for (const p of previous) {
      try { removeDir(captureDir(link.employeeId, p.id)); } catch { /* already gone */ }
    }
    if (previous.length) {
      await prisma.faceCapture.updateMany({ where: { id: { in: previous.map((p) => p.id) } }, data: { replacedAt: new Date(), deletedAt: new Date() } });
    }

    const stored = prepared.map((p) => p.stored);
    const bytes = stored.reduce((n, f) => n + f.bytes, 0);
    const capture = await prisma.faceCapture.create({
      data: {
        id: captureId,
        employeeId: link.employeeId,
        linkId: link.id,
        imageCount: stored.length,
        bytes,
        status: "CAPTURED",
        capturedAt: new Date(),
        device: String(meta.device || userAgent || "").slice(0, 300) || null,
        files: stored as any,
      },
    });

    const emp = await prisma.employee.findFirst({ where: { id: link.employeeId }, select: { name: true, surname: true, code: true } });
    const who = emp ? `${emp.name} ${emp.surname ?? ""}`.trim() : "An employee";
    await notify([link.createdById], "FACE_CAPTURE", `Face photos received: ${who}${emp?.code ? ` (${emp.code})` : ""}`, `${stored.length} photos. Open the employee to register them.`, "Employee", link.employeeId);

    return { captureId: capture.id, imageCount: stored.length, bytes };
  }

  // ---------------------------------------------------------------- card

  async status(userId: string, employeeId: string) {
    const emp = await assertInScope(userId, employeeId);
    const [link, capture, history] = await Promise.all([
      prisma.faceCaptureLink.findFirst({ where: { employeeId }, orderBy: { createdAt: "desc" } }),
      currentCapture(employeeId),
      prisma.faceCapture.findMany({ where: { employeeId }, orderBy: { capturedAt: "desc" }, take: 6, select: { id: true, status: true, capturedAt: true, imageCount: true, bytes: true, replacedAt: true, deletedAt: true } }),
    ]);
    const names = await userNames([link?.createdById, capture?.registeredById, capture?.verifiedById, capture?.redoById, capture?.deletedById]);
    const linkNewer = link && (!capture || link.createdAt > capture.capturedAt) && !link.revokedAt;
    const status = linkNewer ? "LINK_SENT" : capture ? capture.status : "NOT_STARTED";
    const photosAvailable = !!capture && !capture.deletedAt;
    const files = capture && photosAvailable ? filesOf(capture) : [];
    const counts: Record<string, number> = {};
    for (const f of capture ? filesOf(capture) : []) counts[f.bucket] = (counts[f.bucket] || 0) + 1;
    return {
      employee: emp,
      status,
      link: link
        ? { id: link.id, state: linkState(link), createdAt: link.createdAt, expiresAt: link.expiresAt, usedAt: link.usedAt, revokedAt: link.revokedAt, createdBy: names[link.createdById || ""] || null }
        : null,
      capture: capture
        ? {
            id: capture.id,
            status: capture.status,
            capturedAt: capture.capturedAt,
            imageCount: capture.imageCount,
            bytes: capture.bytes,
            device: capture.device,
            photosAvailable,
            deletedAt: capture.deletedAt,
            deletedBy: names[capture.deletedById || ""] || null,
            deleteAfter: capture.deleteAfter,
            counts,
            files: files.map((f) => ({ name: f.name, bucket: f.bucket, sharpness: f.sharpness, brightness: f.brightness })),
            registeredAt: capture.registeredAt,
            registeredBy: names[capture.registeredById || ""] || null,
            verifiedAt: capture.verifiedAt,
            verifiedBy: names[capture.verifiedById || ""] || null,
            redoAt: capture.redoAt,
            redoBy: names[capture.redoById || ""] || null,
            redoReason: capture.redoReason,
            registerResult: capture.registerResult,
            testResult: capture.testResult,
            note: capture.note,
          }
        : null,
      history: history.map((h) => ({ ...h, photosAvailable: !h.deletedAt })),
    };
  }

  private async captureForFiles(userId: string, captureId: string) {
    if (typeof captureId !== "string" || !captureId) throw new AppError(400, "captureId is required.");
    const capture = await prisma.faceCapture.findUnique({ where: { id: captureId } });
    if (!capture) throw new AppError(404, "Capture not found.");
    await assertInScope(userId, capture.employeeId);
    if (capture.deletedAt) throw new AppError(410, "These photos were deleted.");
    return capture;
  }

  async image(userId: string, captureId: string, name: string, thumb: boolean): Promise<Buffer> {
    const capture = await this.captureForFiles(userId, captureId);
    if (!filesOf(capture).some((f) => f.name === name)) throw new AppError(404, "Photo not found.");
    const dir = captureDir(capture.employeeId, capture.id);
    try {
      return fs.readFileSync(thumb ? path.join(dir, "thumbs", safeFileName(name)) : path.join(dir, safeFileName(name)));
    } catch {
      throw new AppError(404, "Photo not found on disk.");
    }
  }

  async zip(userId: string, captureId: string): Promise<{ name: string; data: Buffer }> {
    const capture = await this.captureForFiles(userId, captureId);
    const emp = await prisma.employee.findFirst({ where: { id: capture.employeeId }, select: { name: true, surname: true, code: true } });
    const files = filesOf(capture);
    const counts: Record<string, number> = {};
    const entries: { name: string; data: Buffer }[] = [];
    for (const f of files) {
      counts[f.bucket] = (counts[f.bucket] || 0) + 1;
      entries.push({ name: `${f.bucket}/${f.name}`, data: readFrame(capture.employeeId, capture.id, f.name) });
    }
    const fullName = `${emp?.name ?? ""} ${emp?.surname ?? ""}`.trim();
    const manifest = {
      code: emp?.code ?? null,
      name: fullName,
      capturedAt: capture.capturedAt,
      device: capture.device,
      counts,
      total: files.length,
      frames: files.map((f) => ({ file: `${f.bucket}/${f.name}`, bucket: f.bucket, yaw: f.yaw ?? null, pitch: f.pitch ?? null, width: f.width, height: f.height })),
    };
    entries.push({ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2)) });
    return { name: zipName(emp?.code ?? "", fullName, capture.capturedAt), data: buildZip(entries, capture.capturedAt) };
  }

  // ---------------------------------------------------------------- register / test / verify

  private async photosFor(userId: string, employeeId: string) {
    const emp = await assertInScope(userId, employeeId);
    const capture = await currentCapture(employeeId);
    if (!capture) throw new AppError(409, "No photos have been captured for this employee yet.");
    if (capture.deletedAt) throw new AppError(409, "The photos were deleted. Send a new link to capture again.");
    return { emp, capture };
  }

  async register(userId: string, body: { employeeId?: string }) {
    const { emp, capture } = await this.photosFor(userId, body.employeeId as string);
    const { training, holdout } = chooseFrames(filesOf(capture));
    if (training.length < 5) throw new AppError(422, `Only ${training.length} clear photos to register (5 needed). Send a new link and capture again.`);
    if (holdout.length < 2) throw new AppError(422, "Not enough photos left over to test the registration.");

    const frames = training.map((f) => ({ name: f.name, data: readFrame(emp.id, capture.id, f.name) }));
    const enrolled = await faceApi.enrol({ id: emp.id, name: emp.name, surname: emp.surname, code: emp.code }, frames);
    let test;
    try {
      test = await runTest(emp.id, capture.id, holdout);
    } catch (e) {
      await faceApi.restore(emp.id).catch(() => undefined);
      throw e;
    }
    const now = new Date();
    const registerResult = { training: training.map((f) => f.name), holdout: holdout.map((f) => f.name), enrolled: enrolled.enrolled, skipped: enrolled.skipped, test };
    if (test.passed) {
      await prisma.faceCapture.update({
        where: { id: capture.id },
        data: { status: "REGISTERED", registeredById: userId, registeredAt: now, registerResult: registerResult as any, testResult: test as any, redoReason: null, deleteAfter: new Date(now.getTime() + DELETE_AFTER_DAYS * 86400000) },
      });
    } else {
      // Put back whatever the scanner used before, so a bad set never replaces a good one.
      await faceApi.restore(emp.id).catch(() => undefined);
      await prisma.faceCapture.update({
        where: { id: capture.id },
        data: { status: "NEEDS_REDO", redoById: userId, redoAt: now, redoReason: `Test match failed: ${test.reason}`, registerResult: registerResult as any, testResult: test as any },
      });
    }
    return { passed: test.passed, status: test.passed ? "REGISTERED" : "NEEDS_REDO", reason: test.reason, enrolled: enrolled.enrolled, training: registerResult.training, holdout: registerResult.holdout, test };
  }

  async testMatch(userId: string, body: { employeeId?: string }) {
    const { emp, capture } = await this.photosFor(userId, body.employeeId as string);
    const files = filesOf(capture);
    const saved = (capture.registerResult as any)?.holdout as string[] | undefined;
    const holdout = saved?.length ? files.filter((f) => saved.includes(f.name)) : chooseFrames(files).holdout;
    if (!holdout.length) throw new AppError(422, "No photos to test with.");
    const test = await runTest(emp.id, capture.id, holdout);
    await prisma.faceCapture.update({ where: { id: capture.id }, data: { testResult: test as any } });
    return test;
  }

  async markVerified(userId: string, body: { employeeId?: string; note?: string }) {
    await assertInScope(userId, body.employeeId as string);
    const capture = await currentCapture(body.employeeId as string);
    if (!capture || !["REGISTERED", "VERIFIED"].includes(capture.status)) throw new AppError(409, "Register the face first; only a registered face can be marked verified.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;
    return prisma.faceCapture.update({ where: { id: capture.id }, data: { status: "VERIFIED", verifiedById: userId, verifiedAt: new Date(), ...(note !== undefined ? { note: note || null } : {}) }, select: { id: true, status: true, verifiedAt: true } });
  }

  async markRedo(userId: string, body: { employeeId?: string; reason?: string; note?: string }) {
    await assertInScope(userId, body.employeeId as string);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!reason) throw new AppError(400, "Say why it needs to be redone.");
    const capture = await currentCapture(body.employeeId as string);
    if (!capture) throw new AppError(409, "Nothing has been captured yet; send a link instead.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;
    return prisma.faceCapture.update({ where: { id: capture.id }, data: { status: "NEEDS_REDO", redoById: userId, redoAt: new Date(), redoReason: reason, ...(note !== undefined ? { note: note || null } : {}) }, select: { id: true, status: true, redoAt: true } });
  }

  async setNote(userId: string, body: { employeeId?: string; note?: string }) {
    await assertInScope(userId, body.employeeId as string);
    const capture = await currentCapture(body.employeeId as string);
    if (!capture) throw new AppError(409, "Nothing has been captured yet.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    return prisma.faceCapture.update({ where: { id: capture.id }, data: { note: note || null }, select: { id: true, note: true } });
  }

  async deletePhotos(userId: string | null, body: { employeeId?: string }) {
    if (userId) await assertInScope(userId, body.employeeId as string);
    const capture = await currentCapture(body.employeeId as string);
    if (!capture) throw new AppError(404, "Nothing has been captured yet.");
    if (capture.deletedAt) return { id: capture.id, deletedAt: capture.deletedAt, alreadyDeleted: true };
    removeDir(captureDir(capture.employeeId, capture.id));
    const done = await prisma.faceCapture.update({ where: { id: capture.id }, data: { deletedAt: new Date(), deletedById: userId } });
    return { id: done.id, deletedAt: done.deletedAt, alreadyDeleted: false };
  }

  /** Daily job: photos go 7 days after registration; the record and its counts stay. */
  async autoDelete(now = new Date()): Promise<number> {
    const due = await prisma.faceCapture.findMany({ where: { deletedAt: null, deleteAfter: { lte: now } }, select: { id: true, employeeId: true } });
    for (const c of due) {
      try { removeDir(captureDir(c.employeeId, c.id)); } catch { /* keep going */ }
      await prisma.faceCapture.update({ where: { id: c.id }, data: { deletedAt: now } });
    }
    return due.length;
  }

  // ---------------------------------------------------------------- tracking list

  private async listQuery(userId: string, f: { status?: string; unitId?: string; search?: string }) {
    const scope = await getAccessibleEmployeeIds(userId);
    const conds: Prisma.Sql[] = [Prisma.sql`e."isDeleted" IS NULL`, Prisma.sql`e.status::text IN (${Prisma.join(EMPLOYEE_ACTIVE)})`];
    if (scope !== null) conds.push(scope.length ? Prisma.sql`e.id IN (${Prisma.join(scope)})` : Prisma.sql`FALSE`);
    if (f.unitId) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "UnitEmployee" ue WHERE ue."employeeId" = e.id AND ue."unitId" = ${f.unitId} AND ue."isDeleted" IS NULL)`);
    const q = (f.search || "").trim();
    if (q) {
      const like = `%${q}%`;
      conds.push(Prisma.sql`(e.code ILIKE ${like} OR (e.name || ' ' || COALESCE(e.surname, '')) ILIKE ${like})`);
    }
    return Prisma.sql`
      WITH emp AS (SELECT e.id, e.code, e.name, e.surname FROM "Employee" e WHERE ${Prisma.join(conds, " AND ")}),
      lc AS (SELECT DISTINCT ON ("employeeId") * FROM "FaceCapture" WHERE "replacedAt" IS NULL AND "employeeId" IN (SELECT id FROM emp) ORDER BY "employeeId", "capturedAt" DESC),
      ll AS (SELECT DISTINCT ON ("employeeId") * FROM "FaceCaptureLink" WHERE "employeeId" IN (SELECT id FROM emp) ORDER BY "employeeId", "createdAt" DESC),
      x AS (
        SELECT emp.*, ll."createdAt" AS "linkSentAt", ll."expiresAt" AS "linkExpiresAt", ll."usedAt" AS "linkUsedAt", ll."revokedAt" AS "linkRevokedAt",
               lc.id AS "captureId", lc."capturedAt", lc."imageCount", lc.bytes, lc."registeredById", lc."registeredAt", lc."verifiedById", lc."verifiedAt",
               lc."redoReason", lc."deletedAt" AS "photosDeletedAt",
               CASE WHEN ll.id IS NOT NULL AND ll."revokedAt" IS NULL AND (lc.id IS NULL OR ll."createdAt" > lc."capturedAt") THEN 'LINK_SENT'
                    WHEN lc.id IS NOT NULL THEN lc.status
                    ELSE 'NOT_STARTED' END AS status
        FROM emp LEFT JOIN ll ON ll."employeeId" = emp.id LEFT JOIN lc ON lc."employeeId" = emp.id
      )`;
  }

  async list(userId: string, body: { status?: string; unitId?: string; search?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }) {
    const base = await this.listQuery(userId, body);
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 25));
    const status = body.status && (STATUSES as readonly string[]).includes(body.status) ? body.status : null;
    const SORTS: Record<string, string> = { code: `x.code`, name: `x.name`, status: `x.status`, linkSentAt: `x."linkSentAt"`, capturedAt: `x."capturedAt"`, registeredAt: `x."registeredAt"`, verifiedAt: `x."verifiedAt"` };
    const sortCol = SORTS[body.sortBy || ""] || `x.code`;
    const dir = body.sortOrder === "desc" ? "DESC" : "ASC";
    const where = status ? Prisma.sql`WHERE x.status = ${status}` : Prisma.empty;

    const [rows, counts] = await Promise.all([
      prisma.$queryRaw<any[]>(Prisma.sql`${base} SELECT * FROM x ${where} ORDER BY ${Prisma.raw(sortCol)} ${Prisma.raw(dir)} NULLS LAST, x.code ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
      prisma.$queryRaw<{ status: string; n: number }[]>(Prisma.sql`${base} SELECT x.status, COUNT(*)::int AS n FROM x GROUP BY x.status`),
    ]);
    const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const c of counts) byStatus[c.status] = c.n;
    const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const total = status ? byStatus[status] : all;

    const ids = rows.map((r) => r.id);
    const units = ids.length
      ? await prisma.$queryRaw<{ employeeId: string; units: string }[]>(Prisma.sql`SELECT ue."employeeId", string_agg(DISTINCT u.name, ', ') AS units FROM "UnitEmployee" ue JOIN "Unit" u ON u.id = ue."unitId" WHERE ue."isDeleted" IS NULL AND u."isDeleted" IS NULL AND ue."employeeId" IN (${Prisma.join(ids)}) GROUP BY ue."employeeId"`)
      : [];
    const unitMap = Object.fromEntries(units.map((u) => [u.employeeId, u.units]));
    const names = await userNames(rows.flatMap((r) => [r.registeredById, r.verifiedById]));

    const accessibleUnits = await getAccessibleUnitIds(userId, AMS_VIEW_ALL);
    const unitOptions = await prisma.unit.findMany({ where: { isDeleted: null, ...(accessibleUnits !== null ? { id: { in: accessibleUnits } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } });

    return {
      data: rows.map((r) => ({
        employeeId: r.id,
        code: r.code,
        name: `${r.name} ${r.surname ?? ""}`.trim(),
        units: unitMap[r.id] || null,
        status: r.status,
        linkSentAt: r.linkSentAt,
        linkState: r.linkSentAt ? linkState({ expiresAt: r.linkExpiresAt, usedAt: r.linkUsedAt, revokedAt: r.linkRevokedAt }) : null,
        capturedAt: r.capturedAt,
        imageCount: r.imageCount,
        photosAvailable: !!r.captureId && !r.photosDeletedAt,
        registeredAt: r.registeredAt,
        registeredBy: names[r.registeredById] || null,
        verifiedAt: r.verifiedAt,
        verifiedBy: names[r.verifiedById] || null,
        redoReason: r.redoReason,
      })),
      totalSize: total,
      page,
      pageSize,
      counts: { all, ...byStatus },
      units: unitOptions,
    };
  }

  /** All matching rows (for export), capped like every other export. */
  async exportRows(userId: string, body: { status?: string; unitId?: string; search?: string }, cap: number) {
    const first = await this.list(userId, { ...body, page: 1, pageSize: 100 });
    const rows = [...first.data];
    const total = first.totalSize;
    for (let p = 2; rows.length < Math.min(total, cap); p++) {
      const next = await this.list(userId, { ...body, page: p, pageSize: 100 });
      if (!next.data.length) break;
      rows.push(...next.data);
    }
    return { rows: rows.slice(0, cap), capped: total > cap };
  }
}

export default FaceCaptureService;
