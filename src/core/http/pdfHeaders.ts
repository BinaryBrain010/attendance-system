import { Request, Response } from "express";

/**
 * 9a: shared Content-Disposition for every PDF/print endpoint. Defaults to a download (attachment);
 * callers that pass `?disposition=inline` (or `?view=1`) get it rendered inline in a browser tab.
 * The filename is always set so a download lands with a proper name (e.g. GP-0123_2026-10-20.pdf).
 */
export function pdfContentDisposition(req: Request, filename: string): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(filename);
  return `${wantsInline(req) ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

/** Does the request ask for the PDF rendered inline (browser tab) rather than downloaded? */
export function wantsInline(req: Request): boolean {
  const q = (req?.query || {}) as Record<string, unknown>;
  return (
    q.disposition === "inline" || q.view === "1" || q.view === "true" || q.inline === "1" || q.inline === "true"
  );
}

/** Strip anything that isn't filename-safe so the plain `filename="..."` stays clean across browsers/OSes. */
export function sanitizeFilename(name: string): string {
  return (
    (name || "download")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._]+|_+$/g, "") || "download"
  );
}

/**
 * Send a generated PDF as a proper binary response. Sets application/pdf, a correctly-encoded
 * Content-Disposition (RFC 5987 `filename*` + an ASCII `filename` fallback), Content-Length, and —
 * crucially for the admin app on a different origin — exposes Content-Disposition so the browser hands
 * the real filename to JS (otherwise the client falls back to a bare, extension-less name). This is the
 * single place every PDF endpoint should use so a download never lands as an untyped/`.txt` file.
 */
export function sendPdf(req: Request, res: Response, buffer: Buffer, filename: string): void {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(filename);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${wantsInline(req) ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encoded}`
  );
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Cache-Control", "no-store");
  res.end(buffer);
}
