import type { Response } from "express";
import ExcelJS from "exceljs";

/**
 * Shared server-side table export (CSV / Excel) for list screens. The caller fetches the rows that
 * match the CURRENT server filters + sort (capped — fetch EXPORT_CAP + 1 to detect the cap), maps them
 * to {key,header} columns, and calls sendTableExport. Response carries X-Export-Capped / X-Export-Count
 * so the client can warn when the 10k ceiling was hit. One place = every module's export looks the same.
 */
export const EXPORT_CAP = 10000;

export type ExportCol = { key: string; header: string };

function cell(v: any): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toCsv(rows: any[], columns: ExportCol[]): string {
  const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = columns.map((c) => esc(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(cell(r[c.key]))).join(",")).join("\r\n");
  return "﻿" + head + "\r\n" + body; // BOM so Excel opens UTF-8 correctly
}

async function toXlsx(rows: any[], columns: ExportCol[], sheetName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((sheetName || "Export").slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.min(40, Math.max(12, c.header.length + 4)) }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(columns.reduce((o, c) => { o[c.key] = cell(r[c.key]); return o; }, {} as Record<string, string>));
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

export async function sendTableExport(
  res: Response,
  opts: { rows: any[]; columns: ExportCol[]; format: "csv" | "excel"; filename: string; capped: boolean }
): Promise<void> {
  const { rows, columns, format, filename, capped } = opts;
  res.setHeader("X-Export-Capped", capped ? "true" : "false");
  res.setHeader("X-Export-Count", String(rows.length));
  res.setHeader("Access-Control-Expose-Headers", "X-Export-Capped, X-Export-Count, Content-Disposition");
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(toCsv(rows, columns));
    return;
  }
  const buf = await toXlsx(rows, columns, filename);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  res.send(buf);
}
