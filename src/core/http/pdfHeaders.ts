import { Request } from "express";

/**
 * 9a: shared Content-Disposition for every PDF/print endpoint. Defaults to a download (attachment);
 * callers that pass `?disposition=inline` (or `?view=1`) get it rendered inline in a browser tab.
 * The filename is always set so a download lands with a proper name (e.g. GP-0123_2026-10-20.pdf).
 */
export function pdfContentDisposition(req: Request, filename: string): string {
  const q = (req?.query || {}) as Record<string, unknown>;
  const inline =
    q.disposition === "inline" || q.view === "1" || q.view === "true" || q.inline === "1" || q.inline === "true";
  return `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`;
}
