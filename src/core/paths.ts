/**
 * Single source of truth for on-disk paths, anchored to the PROJECT ROOT — never to the process
 * working directory. In prod the app was launched with cwd = the user's home, so every cwd-relative
 * path (PDF logos, uploads, logs, swagger globs) broke. This module resolves everything from
 * `__dirname` instead, which is stable regardless of where `node` was started from.
 *
 * The backend runs the compiled JS in place (no tsconfig outDir), so at runtime this file is
 * <root>/src/core/paths.js and `path.resolve(__dirname, "..", "..")` is always the project root.
 */
import path from "path";
import fs from "fs";

export const APP_ROOT = path.resolve(__dirname, "..", "..");
export const SRC_DIR = path.join(APP_ROOT, "src");
export const ASSETS_DIR = path.join(SRC_DIR, "assets");
export const UPLOADS_DIR = path.join(ASSETS_DIR, "uploads");
export const IMAGES_DIR = path.join(ASSETS_DIR, "images");
export const LOGS_DIR = path.join(APP_ROOT, "logs");

/** The Power Highway logo embedded in every generated PDF. */
export const LOGO_PATH = path.join(IMAGES_DIR, "Power-Highway-Logo.png");

/** Join segments onto a well-known root (all absolute, cwd-independent). */
export const fromRoot = (...segs: string[]) => path.join(APP_ROOT, ...segs);
export const assetPath = (...segs: string[]) => path.join(ASSETS_DIR, ...segs);
export const uploadPath = (...segs: string[]) => path.join(UPLOADS_DIR, ...segs);

/**
 * Startup check: create the upload/log folders if missing, log where the asset + upload folders
 * actually resolved, and FAIL LOUDLY (throw) if the PDF logo is not on disk — so a bad working
 * directory or an incomplete asset deployment is caught at boot, not at the first PDF or upload.
 */
export function verifyAssetPaths(log: (m: string) => void = console.log): void {
  for (const d of [ASSETS_DIR, UPLOADS_DIR, IMAGES_DIR, LOGS_DIR]) {
    try { fs.mkdirSync(d, { recursive: true }); } catch { /* best-effort */ }
  }
  log(`[paths] APP_ROOT = ${APP_ROOT}`);
  log(`[paths] assets   = ${ASSETS_DIR}`);
  log(`[paths] uploads  = ${UPLOADS_DIR}`);
  log(`[paths] logs     = ${LOGS_DIR}`);
  log(`[paths] logo     = ${LOGO_PATH}`);
  if (!fs.existsSync(LOGO_PATH)) {
    throw new Error(
      `[paths] PDF logo not found at ${LOGO_PATH}. The process was likely started from the wrong ` +
      `directory, or src/assets was not deployed. Refusing to start.`,
    );
  }
}
