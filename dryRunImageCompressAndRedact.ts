/**
 * Prod cleanup DRY RUN (read-only by default):
 *   1. Compress existing oversized Employee photos (and backfill the small imageThumb added in 5g).
 *   2. Redact sensitive keys from old ActivityLog.metadata (password/token/secret/otp/cnic/etc.).
 *
 * Nothing is written unless --apply is passed, and writes to a non-local DB also require --allow-remote.
 *   npx ts-node dryRunImageCompressAndRedact.ts                         (local, dry run)
 *   npx ts-node dryRunImageCompressAndRedact.ts --apply                 (local, writes)
 *   npx ts-node dryRunImageCompressAndRedact.ts --apply --allow-remote  (prod, writes)
 * Tuning: --imageThreshold=<bytes> (default 120000), --redactBefore=YYYY-MM-DD (default: all rows).
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";
import { compressImageDataUrl, makeThumbnailDataUrl } from "./src/core/utils/imageCompression";

const APPLY = process.argv.includes("--apply");
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (APPLY && !["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[cleanup] REFUSING to write — DATABASE_URL host "${host}" is not local. Add --allow-remote for prod.`);
  process.exit(2);
}
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const IMAGE_THRESHOLD = parseInt(arg("imageThreshold") || "120000", 10); // ~120KB of base64
const REDACT_BEFORE = arg("redactBefore") ? new Date(arg("redactBefore") as string) : null;

const SENSITIVE_KEY = /pass(word)?|token|secret|otp|cnic|ssn|card|cvv|pin|auth|bearer/i;

function redactDeep(value: any): { changed: boolean; value: any } {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => { const r = redactDeep(v); changed = changed || r.changed; return r.value; });
    return { changed, value: out };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k) && v != null && v !== "[REDACTED]") { out[k] = "[REDACTED]"; changed = true; }
      else { const r = redactDeep(v); changed = changed || r.changed; out[k] = r.value; }
    }
    return { changed, value: out };
  }
  return { changed: false, value };
}

async function imagePass() {
  console.log(`\n[cleanup] IMAGE COMPRESSION — employees with image length > ${IMAGE_THRESHOLD} chars or missing imageThumb`);
  // Pull only id + sizes first (avoid loading every blob into memory at once).
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, COALESCE(length(image),0) AS imglen, (("imageThumb" IS NULL) OR "imageThumb" = '') AS nothumb
     FROM "Employee" WHERE "isDeleted" IS NULL AND image IS NOT NULL AND image <> ''`
  ) as Array<{ id: string; imglen: number; nothumb: boolean }>;
  const candidates = rows.filter((r) => r.imglen > IMAGE_THRESHOLD || r.nothumb);
  const totalBytes = candidates.reduce((s, r) => s + r.imglen, 0);
  console.log(`[cleanup] ${rows.length} employees with a photo; ${candidates.length} candidate(s) to compress/thumbnail (~${(totalBytes / 1048576).toFixed(1)} MB of base64).`);

  if (!APPLY) {
    console.log(`[cleanup] DRY RUN — would compress ${candidates.length} photo(s) and backfill thumbnails. Re-run with --apply to write.`);
    return;
  }
  let done = 0, saved = 0, failed = 0;
  for (const c of candidates) {
    try {
      const emp = await prisma.employee.findUnique({ where: { id: c.id }, select: { image: true } }) as any;
      if (!emp?.image) continue;
      const before = emp.image.length;
      const compressed = await compressImageDataUrl(emp.image);
      const thumb = await makeThumbnailDataUrl(emp.image);
      const nextImage = typeof compressed === "string" && compressed.length ? compressed : emp.image;
      await prisma.employee.update({ where: { id: c.id }, data: { image: nextImage, imageThumb: thumb } as any });
      saved += Math.max(0, before - nextImage.length);
      done++;
    } catch (e) { failed++; console.error(`[cleanup] image failed for ${c.id}:`, (e as any)?.message || e); }
  }
  console.log(`[cleanup] APPLIED — compressed/thumbnailed ${done} photo(s), ~${(saved / 1048576).toFixed(1)} MB saved, ${failed} failed.`);
}

async function redactPass() {
  const where: any = { metadata: { not: null } };
  if (REDACT_BEFORE) where.createdAt = { lt: REDACT_BEFORE };
  const total = await prisma.activityLog.count({ where });
  console.log(`\n[cleanup] ACTIVITYLOG REDACTION — scanning ${total} rows${REDACT_BEFORE ? ` before ${REDACT_BEFORE.toISOString().slice(0, 10)}` : ""} for sensitive metadata keys (${SENSITIVE_KEY}).`);

  const CHUNK = 1000;
  let scanned = 0, toRedact = 0, redacted = 0;
  for (let skip = 0; skip < total; skip += CHUNK) {
    const rows = await prisma.activityLog.findMany({ where, select: { id: true, metadata: true }, skip, take: CHUNK, orderBy: { createdAt: "asc" } });
    for (const r of rows) {
      scanned++;
      const { changed, value } = redactDeep(r.metadata);
      if (!changed) continue;
      toRedact++;
      if (APPLY) { await prisma.activityLog.update({ where: { id: r.id }, data: { metadata: value } }); redacted++; }
    }
  }
  if (!APPLY) console.log(`[cleanup] DRY RUN — ${toRedact}/${scanned} ActivityLog rows contain sensitive metadata and WOULD be redacted. Re-run with --apply to write.`);
  else console.log(`[cleanup] APPLIED — redacted ${redacted}/${scanned} ActivityLog rows.`);
}

async function main() {
  console.log(`[cleanup] host=${host} apply=${APPLY} imageThreshold=${IMAGE_THRESHOLD}`);
  await imagePass();
  await redactPass();
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[cleanup] error", e); process.exit(1); });
