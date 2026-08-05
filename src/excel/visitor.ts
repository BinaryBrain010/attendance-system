import * as ExcelJS from "exceljs";

/**
 * Normalized row shape produced by the parsers and consumed by the bulk-create model helper.
 */
export interface ParsedVisitorRow {
  name: string;
  phone?: string | null;
  cnic?: string | null;
  vehicleNo?: string | null;
  company?: string | null;
  purpose?: string | null;
  referredToText?: string | null;
  visitDate: Date;
  timeIn?: Date | null;
  timeOut?: Date | null;
  outcome?: string;
  purchased?: boolean;
  purchaseAmount?: number | null;
  notes?: string | null;
}

const VALID_OUTCOMES = new Set([
  "ENQUIRY",
  "PURCHASED",
  "REPLACED",
  "RECEIVED",
  "NO_ACTION",
  "OTHER",
]);

const MONTHS: { [k: string]: number } = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Tolerant parser for sheet-name style dates such as
 * "12th Feb 2025", "1st March 2025", "2nd Sep2025", "1sth Dec 2025".
 * Returns null if it cannot be parsed.
 */
export function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  let s = raw.toString().trim().toLowerCase();
  // insert a space between a month name glued to the year, e.g. "sep2025" -> "sep 2025"
  s = s.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  // strip ordinal suffixes attached to the day number (1st, 2nd, 3rd, 4th, and the "1sth" typo)
  s = s.replace(/\b(\d{1,2})(st|nd|rd|th|sth)\b/g, "$1");
  const tokens = s.split(/[\s,]+/).filter(Boolean);
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  for (const tok of tokens) {
    if (/^\d{4}$/.test(tok)) {
      year = parseInt(tok, 10);
    } else if (/^\d{1,2}$/.test(tok)) {
      const n = parseInt(tok, 10);
      if (n >= 1 && n <= 31 && day === undefined) day = n;
    } else if (MONTHS[tok] !== undefined) {
      month = MONTHS[tok];
    }
  }
  if (day !== undefined && month !== undefined && year !== undefined) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  // last resort: try a numeric d/m/y form like "13/2/2025"
  const numeric = raw.toString().trim().match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (numeric) {
    const dd = parseInt(numeric[1], 10);
    const mm = parseInt(numeric[2], 10) - 1;
    let yy = parseInt(numeric[3], 10);
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm, dd);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Parse a "2:45pm" / "10:30 am" style time and attach it to the given base date.
 * Returns null if unparseable.
 */
export function parseTimeOnDate(raw: any, base: Date): Date | null {
  if (raw === null || raw === undefined || base == null) return null;
  // If Excel already gave us a Date, reuse its clock time on the base date.
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const d = new Date(base);
    d.setHours(raw.getHours(), raw.getMinutes(), raw.getSeconds(), 0);
    return d;
  }
  const s = raw.toString().trim().toLowerCase();
  const m = s.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];
  if (ampm === "pm" && hh < 12) hh += 12;
  if (ampm === "am" && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v: any = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v.text) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    if (v.richText) return v.richText.map((r: any) => r.text).join("").trim();
    return "";
  }
  return String(v).trim();
}

export class VisitorExcelUtility {
  /** Column order used for both export and the clean import template. */
  private readonly headers = [
    "Date",
    "Name",
    "Number",
    "CNIC",
    "Vehicle No",
    "Company",
    "Purpose of Visit",
    "Referred To",
    "Time In",
    "Time Out",
    "Outcome",
    "Purchased",
    "Purchase Amount",
    "Notes",
  ];

  private fmtDate(d: any): string {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  }

  private fmtTime(d: any): string {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${m}${ampm}`;
  }

  /** Build an export workbook from visitor rows. */
  async create(
    visitors: any[]
  ): Promise<{ wbout: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Visitors");

    const headerRow = worksheet.addRow(this.headers);
    headerRow.font = { bold: true };

    for (const v of visitors) {
      const host =
        v.referredToEmployee
          ? `${v.referredToEmployee.name || ""} ${v.referredToEmployee.surname || ""}`.trim() +
            (v.referredToEmployee.code ? ` (${v.referredToEmployee.code})` : "")
          : v.referredToText || "";

      worksheet.addRow([
        this.fmtDate(v.visitDate),
        v.name || "",
        v.phone || "",
        v.cnic || "",
        v.vehicleNo || "",
        v.company || "",
        v.purpose || "",
        host,
        this.fmtTime(v.timeIn),
        this.fmtTime(v.timeOut),
        v.outcome || "",
        v.purchased ? "Yes" : "No",
        v.purchaseAmount ?? "",
        v.notes || "",
      ]);
    }

    worksheet.columns.forEach((column) => {
      column.width = 18;
    });

    const wbout = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return { wbout, fileName: `visitors-${this.fmtDate(new Date())}.xlsx` };
  }

  /** Empty template (headers + one example row) for the ongoing import flow. */
  async buildTemplate(): Promise<{ wbout: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Visitors");
    const headerRow = worksheet.addRow(this.headers);
    headerRow.font = { bold: true };
    worksheet.addRow([
      "2025-08-05",
      "John Doe",
      "0300-1234567",
      "",
      "",
      "Solar Max (Solar)",
      "Product enquiry",
      "Ayesha Ali",
      "2:45pm",
      "3:10pm",
      "ENQUIRY",
      "No",
      "",
      "Walk-in",
    ]);
    worksheet.columns.forEach((column) => {
      column.width = 18;
    });
    const wbout = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return { wbout, fileName: "visitors-template.xlsx" };
  }

  /**
   * Parse the clean single-sheet template (headers matching `this.headers`).
   * Header detection is column-name based so column order is not strictly required.
   */
  async parseTemplate(file: Buffer): Promise<ParsedVisitorRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file as any);
    const ws = workbook.worksheets[0];
    if (!ws) return [];

    // Map header label -> column index from the first non-empty row
    const headerRow = ws.getRow(1);
    const colIndex: { [label: string]: number } = {};
    headerRow.eachCell((cell, col) => {
      colIndex[cellText(cell).toLowerCase()] = col;
    });

    const get = (row: ExcelJS.Row, label: string): ExcelJS.Cell | undefined => {
      const idx = colIndex[label.toLowerCase()];
      return idx ? row.getCell(idx) : undefined;
    };

    const rows: ParsedVisitorRow[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const name = cellText(get(row, "Name"));
      if (!name) return; // skip empty rows

      const dateText = cellText(get(row, "Date"));
      const visitDate = parseSheetDate(dateText) || new Date();

      const outcomeRaw = cellText(get(row, "Outcome")).toUpperCase().replace(/\s+/g, "_");
      const outcome = VALID_OUTCOMES.has(outcomeRaw) ? outcomeRaw : "ENQUIRY";
      const purchasedText = cellText(get(row, "Purchased")).toLowerCase();
      const purchased = ["yes", "true", "1", "y"].includes(purchasedText) || outcome === "PURCHASED";
      const amountText = cellText(get(row, "Purchase Amount")).replace(/[^0-9.]/g, "");
      const purchaseAmount = amountText ? parseFloat(amountText) : null;

      rows.push({
        name,
        phone: cellText(get(row, "Number")) || null,
        cnic: cellText(get(row, "CNIC")) || null,
        vehicleNo: cellText(get(row, "Vehicle No")) || null,
        company: cellText(get(row, "Company")) || null,
        purpose: cellText(get(row, "Purpose of Visit")) || null,
        referredToText: cellText(get(row, "Referred To")) || null,
        visitDate,
        timeIn: parseTimeOnDate(get(row, "Time In")?.value, visitDate),
        timeOut: parseTimeOnDate(get(row, "Time Out")?.value, visitDate),
        outcome,
        purchased,
        purchaseAmount,
        notes: cellText(get(row, "Notes")) || null,
      });
    });

    return rows;
  }

  /**
   * Parse the historical "Reception Visitors List 2025" workbook: one sheet per day,
   * columns Sr No. / Name / Number / Purpose of Visit / Reffered to / Time of Visit,
   * with the visit date taken from the sheet name (or a "Date:" header cell).
   * Skips any summary sheet whose date cannot be derived.
   */
  async parseReceptionWorkbook(
    file: Buffer
  ): Promise<{ rows: ParsedVisitorRow[]; skippedSheets: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file as any);

    const rows: ParsedVisitorRow[] = [];
    const skippedSheets: string[] = [];

    workbook.eachSheet((ws) => {
      // Skip aggregate/summary sheets whose name is a date RANGE (e.g. "12th Feb to 31st Dec 2025").
      // Those duplicate the per-day sheets and carry an ambiguous date.
      if (/\sto\s/i.test(ws.name)) {
        skippedSheets.push(ws.name);
        return;
      }

      // Derive the date from the sheet name first
      let sheetDate = parseSheetDate(ws.name);

      // Find the header row (the one containing "Name") and column positions
      let headerRowNumber = -1;
      const cols: { [key: string]: number } = {};
      const maxScan = Math.min(ws.rowCount, 15);
      for (let r = 1; r <= maxScan; r++) {
        const row = ws.getRow(r);
        let foundName = false;
        row.eachCell((cell, c) => {
          const t = cellText(cell).toLowerCase();
          if (!t) return;
          if (t === "name") {
            foundName = true;
            cols.name = c;
          } else if (t.startsWith("number") || t === "no." || t === "contact") {
            cols.phone = c;
          } else if (t.startsWith("purpose")) {
            cols.purpose = c;
          } else if (t.startsWith("reffered") || t.startsWith("referred")) {
            cols.referredTo = c;
          } else if (t.startsWith("time")) {
            cols.time = c;
          } else if (t.startsWith("date")) {
            // A "Date:" cell may carry the date as the adjacent value
            const adjacent = cellText(row.getCell(c + 1));
            const parsed = parseSheetDate(adjacent);
            if (!sheetDate && parsed) sheetDate = parsed;
          }
        });
        if (foundName) {
          headerRowNumber = r;
          break;
        }
      }

      if (headerRowNumber === -1 || !cols.name || !sheetDate) {
        skippedSheets.push(ws.name);
        return;
      }

      const baseDate = sheetDate;
      for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const name = cellText(row.getCell(cols.name));
        if (!name) continue;
        // Ignore rows that are obviously totals/labels
        if (/^(total|sr no\.?|name)$/i.test(name)) continue;

        const timeCell = cols.time ? row.getCell(cols.time) : undefined;
        rows.push({
          name,
          phone: cols.phone ? cellText(row.getCell(cols.phone)) || null : null,
          purpose: cols.purpose ? cellText(row.getCell(cols.purpose)) || null : null,
          referredToText: cols.referredTo ? cellText(row.getCell(cols.referredTo)) || null : null,
          visitDate: baseDate,
          timeIn: timeCell ? parseTimeOnDate(timeCell.value, baseDate) : null,
          outcome: "ENQUIRY",
          purchased: false,
        });
      }
    });

    return { rows, skippedSheets };
  }
}
