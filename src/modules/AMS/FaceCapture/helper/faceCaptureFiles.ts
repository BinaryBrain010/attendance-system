/**
 * Face capture files: where they live, how an uploaded image is checked and cleaned, and a small
 * ZIP writer for downloads. Files sit under uploads/face-captures/<employeeId>/<captureId>/ and are
 * never served by the static /uploads handler (server.ts blocks the folder); only the
 * authenticated /faceCapture routes read them.
 */
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { uploadPath } from "../../../../core/paths";

export const FACE_ROOT = uploadPath("face-captures");
export const BUCKETS = ["front", "left", "right", "up", "down", "close", "glasses", "light"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Upload limits for one capture. */
export const LIMITS = {
  maxFiles: 72,
  minFiles: 10,
  maxFileBytes: 1_500_000,
  maxTotalBytes: 40_000_000,
  maxSide: 640,
  thumbSide: 112,
};

export type StoredFile = {
  name: string; // e.g. front_03.jpg
  bucket: Bucket;
  bytes: number;
  width: number;
  height: number;
  sharpness: number; // variance of the Laplacian on a 200px grey copy; higher = sharper
  brightness: number; // mean grey 0..255
  yaw?: number | null;
  pitch?: number | null;
};

export function captureDir(employeeId: string, captureId: string): string {
  return path.join(FACE_ROOT, safeId(employeeId), safeId(captureId));
}

/** Ids come from the database, but never let one walk out of the face folder. */
export function safeId(id: string): string {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new Error("Bad id");
  return id;
}

export function safeFileName(name: string): string {
  if (!/^[a-z]+_\d{2,3}\.jpg$/.test(name)) throw new Error("Bad file name");
  return name;
}

/** Only real JPEG or PNG bytes are accepted, whatever the browser claims. */
export function sniffImage(buf: Buffer): "jpeg" | "png" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
}

/**
 * Decode, scale to at most 640px, and re-encode as a fresh JPEG. Re-encoding drops EXIF and any
 * other metadata (GPS, device serials) the original carried. Also returns a thumbnail and the
 * sharpness and brightness used to pick frames for registration.
 */
export async function cleanImage(buf: Buffer): Promise<{ jpeg: Buffer; thumb: Buffer; width: number; height: number; sharpness: number; brightness: number }> {
  const img = await loadImage(buf);
  const scale = Math.min(1, LIMITS.maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  const jpeg = canvas.toBuffer("image/jpeg", { quality: 0.88 });

  const ts = Math.min(1, LIMITS.thumbSide / Math.max(width, height));
  const thumbCanvas = createCanvas(Math.max(1, Math.round(width * ts)), Math.max(1, Math.round(height * ts)));
  thumbCanvas.getContext("2d").drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumb = thumbCanvas.toBuffer("image/jpeg", { quality: 0.75 });

  const { sharpness, brightness } = measure(canvas as any, width, height);
  return { jpeg, thumb, width, height, sharpness, brightness };
}

function measure(canvas: any, width: number, height: number): { sharpness: number; brightness: number } {
  const w = 200;
  const h = Math.max(1, Math.round((height / width) * w));
  const small = createCanvas(w, h);
  small.getContext("2d").drawImage(canvas, 0, 0, w, h);
  const px = small.getContext("2d").getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    grey[i] = g;
    sum += g;
  }
  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  return { sharpness: Math.round(n > 1 ? m2 / (n - 1) : 0), brightness: Math.round(sum / (w * h)) };
}

/** Total size of a folder tree on disk (0 when it does not exist). */
export function dirBytes(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += dirBytes(p);
    else { try { total += fs.statSync(p).size; } catch { /* gone */ } }
  }
  return total;
}

export function removeDir(dir: string): void {
  if (!dir.startsWith(FACE_ROOT)) throw new Error("Refusing to delete outside the face capture folder");
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- minimal ZIP (stored, no compression: JPEGs do not shrink) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Build a ZIP from in-memory entries. Fine for one capture (a few MB). */
export function buildZip(entries: { name: string; data: Buffer }[], when = new Date()): Buffer {
  const { time, date } = dosTime(when);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, e.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + e.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** {CODE}_{Name}_face_{yyyy-mm-dd}.zip, safe for any file system. */
export function zipName(code: string, name: string, when: Date): string {
  const clean = (s: string) => s.trim().replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
  const d = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  return `${clean(code) || "EMP"}_${clean(name) || "Employee"}_face_${d}.zip`;
}
