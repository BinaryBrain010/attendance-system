/**
 * Image compression for uploads (employee photos, attendance-request selfies). Keeps blobs small at
 * the SOURCE so lists/payloads and the DB never grow back to the multi-MB rows that caused the napi
 * string crash. Uses the already-installed `canvas` dependency (no new package). Every function is
 * fail-safe: on any error, or when `canvas` is unavailable, it returns the ORIGINAL input so a save is
 * never blocked by image processing.
 *
 *   - compressImageDataUrl: resize to <=800px longest edge, re-encode JPEG ~80%.
 *   - makeThumbnailDataUrl:  small ~128px JPEG thumbnail (for the Phase 5 photo endpoint).
 */

const MAX_DIM = 800;
const JPEG_QUALITY = 0.8;
const THUMB_DIM = 128;
const SKIP_UNDER_BYTES = 60 * 1024; // already small — don't bother re-encoding

// Lazy, cached canvas module so a missing native binary degrades gracefully instead of crashing boot.
let _canvas: any | null | undefined;
function getCanvas(): any | null {
  if (_canvas !== undefined) return _canvas;
  try { _canvas = require("canvas"); } catch { _canvas = null; }
  return _canvas;
}

function extractBase64(input: string): { base64: string; isSvg: boolean } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+)?;base64,/.exec(input);
  if (m) return { base64: input.slice(input.indexOf(",") + 1), isSvg: /svg/i.test(m[1] || "") };
  // bare base64 (no data-URL prefix)
  if (/^[A-Za-z0-9+/=\s]+$/.test(input)) return { base64: input, isSvg: false };
  return null; // a URL/path/other — leave untouched
}

/** Resize + re-encode a base64/data-URL image to a JPEG data URL. Returns input unchanged if it is not
 *  a processable raster image, is already small, yields no size gain, or on any failure. */
export async function compressImageDataUrl(input: unknown): Promise<any> {
  if (typeof input !== "string" || input.length < 100) return input;
  const parsed = extractBase64(input);
  if (!parsed || parsed.isSvg) return input;
  const canvas = getCanvas();
  if (!canvas) return input;
  try {
    const buf = Buffer.from(parsed.base64, "base64");
    if (buf.length <= SKIP_UNDER_BYTES) return input;
    const img = await canvas.loadImage(buf);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = canvas.createCanvas(w, h);
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const out: Buffer = c.toBuffer("image/jpeg", { quality: JPEG_QUALITY });
    if (out.length >= buf.length) return input; // no gain (e.g. tiny or already-JPEG): keep original
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return input;
  }
}

/** Small JPEG thumbnail data URL, or null if it can't be produced. */
export async function makeThumbnailDataUrl(input: unknown): Promise<string | null> {
  if (typeof input !== "string" || input.length < 100) return null;
  const parsed = extractBase64(input);
  if (!parsed || parsed.isSvg) return null;
  const canvas = getCanvas();
  if (!canvas) return null;
  try {
    const img = await canvas.loadImage(Buffer.from(parsed.base64, "base64"));
    const scale = Math.min(1, THUMB_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = canvas.createCanvas(w, h);
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return `data:image/jpeg;base64,${c.toBuffer("image/jpeg", { quality: 0.7 }).toString("base64")}`;
  } catch {
    return null;
  }
}
