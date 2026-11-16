/** Monthly Employee Report exports: styled Excel (frozen header + totals) and landscape PDF (logo + month). */
import * as ExcelJS from "exceljs";
import pdfMake from "pdfmake/build/pdfmake";
import { fonts } from "../../../../pdf/config/pdf-fonts";
import { getLogoDataURL } from "../../../../pdf/helper/logo.helper";
import { LOGO_PATH } from "../../../../core/paths";

const pdfFonts = require("../../../../pdf/config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthTitle = (year: number, month: number) => `${MONTHS[month - 1] || month} ${year}`;

type Col = { header: string; key: string; width: number; align?: "left" | "right" | "center" };

export const MONTHLY_COLUMNS: Col[] = [
  { header: "Code", key: "code", width: 12 },
  { header: "Name", key: "name", width: 22 },
  { header: "Department", key: "department", width: 16 },
  { header: "Designation", key: "designation", width: 16 },
  { header: "Unit", key: "unit", width: 14 },
  { header: "Joining", key: "joining", width: 12 },
  { header: "Service", key: "serviceLength", width: 9, align: "center" },
  { header: "Policy group", key: "policyGroup", width: 13 },
  { header: "Present", key: "presentDays", width: 8, align: "right" },
  { header: "Late", key: "lateDays", width: 7, align: "right" },
  { header: "Late min", key: "totalLateMinutes", width: 9, align: "right" },
  { header: "Half", key: "halfDays", width: 7, align: "right" },
  { header: "Absent", key: "absentDays", width: 8, align: "right" },
  { header: "On leave", key: "onLeaveDays", width: 8, align: "right" },
  { header: "Leave types (mo)", key: "leaveTypes", width: 18 },
  { header: "Leaves yr", key: "leavesTakenYear", width: 9, align: "right" },
  { header: "Entitlement", key: "leaveEntitlementYear", width: 11, align: "right" },
  { header: "Remaining", key: "remainingLeaveYear", width: 10, align: "right" },
  { header: "Medical", key: "medical", width: 8, align: "center" },
  { header: "Hol/offs", key: "holidaysWeeklyOffs", width: 9, align: "right" },
  { header: "Short/early", key: "shortEarlyLeaves", width: 10, align: "right" },
  { header: "Remark", key: "remark", width: 26 },
];

const TOTAL_KEYS = ["presentDays", "lateDays", "totalLateMinutes", "halfDays", "absentDays", "onLeaveDays", "leavesTakenYear", "leaveEntitlementYear", "remainingLeaveYear", "shortEarlyLeaves"];

/** Flatten a computed monthly row into display strings for export/table. */
export function toDisplayRow(r: any): Record<string, any> {
  const leaveTypes = Object.entries(r.leavesThisMonthByType || {}).map(([t, n]) => `${t}:${n}`).join(", ");
  return {
    ...r,
    joining: r.joiningDate ? new Date(r.joiningDate).toISOString().slice(0, 10) : "",
    leaveTypes: leaveTypes || "—",
    medical: r.medicalEligible ? "Yes" : "No",
  };
}

export async function buildMonthlyExcel(rows: any[], totals: any, meta: { year: number; month: number }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Monthly ${meta.year}-${String(meta.month).padStart(2, "0")}`);
  ws.columns = MONTHLY_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Title row above the header is awkward with keyed columns; keep the header on row 1 and freeze it.
  rows.map(toDisplayRow).forEach((d) => ws.addRow(d));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2C3E50" } };
  headerRow.height = 26;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: MONTHLY_COLUMNS.length } };

  // Totals row.
  const totalData: Record<string, any> = { code: "TOTAL", name: `${totals.employees} employees` };
  for (const k of TOTAL_KEYS) totalData[k] = totals[k];
  const totalRow = ws.addRow(totalData);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF2" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function logoOrEmpty(): any {
  try { return { image: getLogoDataURL(LOGO_PATH), width: 54 }; } catch { return { text: "" }; }
}

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "05 Mar 2019" — never wraps. */
function fmtDay(d: any): string {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${String(x.getDate()).padStart(2, "0")} ${MON3[x.getMonth()]} ${x.getFullYear()}`;
}
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * Monthly Employee Report — A4 LANDSCAPE, full-width 15-column table. The report groups rows by
 * department (bold subheading) so the Department column is dropped (implied), which keeps it to 15
 * readable columns under a grouped "Employee | This month | Leave balance" header. Numeric columns
 * have fixed widths; Name + Designation share the remaining width. Nothing wraps mid-word; codes,
 * dates and numbers never wrap. Header + summary strip appear once up top; the column header repeats
 * on every page; the footer carries "Page x of y" + the generated date. The Excel export keeps ALL
 * fields (see MONTHLY_COLUMNS) — only the PDF trims to what reads well on a page.
 */
export function buildMonthlyPdf(rows: any[], totals: any, meta: { year: number; month: number; generatedBy?: string; filterLabel?: string }): any {
  (pdfMake as any).fonts = fonts;
  const today = new Date().toISOString().slice(0, 10);
  const company = (rows[0]?.company || "").toString().trim() || "Power Highway";

  // Column widths: fixed for everything except Name + Designation ("*"), which share the slack so the
  // table spans the full printable width (A4 landscape 842 − 48 margins = 794pt).
  const widths = [42, "*", "*", 50, 54, 38, 30, 38, 30, 34, 54, 44, 32, 44, 88];
  //              Code Name Desig Unit  Join Serv Pres Late Half Abs  Leav Enti Takn Rem  Remarks
  const HEAD = ["Code", "Name", "Designation", "Unit", "Joined", "Service", "Present", "Late", "Half day", "Absent", "Leave", "Entitled", "Taken", "Remaining", "Remarks"];
  const ALIGN = ["left", "left", "left", "left", "left", "center", "center", "center", "center", "center", "center", "center", "center", "center", "left"];

  // Grouped header row (colSpans must be padded with empty cells).
  const groupRow: any[] = [];
  const grp = (text: string, span: number) => { groupRow.push({ text, colSpan: span, style: "thg", alignment: "center" }); for (let i = 1; i < span; i++) groupRow.push({}); };
  grp("Employee", 6); grp("This month", 5); grp("Leave balance", 3); groupRow.push({ text: "", style: "thg" });
  const headRow = HEAD.map((h, i) => ({ text: h, style: "th", alignment: ALIGN[i] }));

  const GREY0 = "#BFC5CE"; // zero / empty values in light grey
  const INK = "#333333";
  const z = (v: any) => Number(v) === 0;
  const numCell = (v: any, opts: { bold?: boolean } = {}) => ({ text: String(v ?? 0), alignment: "center", style: "td", noWrap: true, bold: !!opts.bold, color: opts.bold ? "#111827" : (z(v) ? GREY0 : INK) });

  const dataRow = (r: any): any[] => {
    const lateCell = r.totalLateMinutes > 0
      ? { stack: [{ text: String(r.lateDays), alignment: "center", color: z(r.lateDays) ? GREY0 : INK }, { text: `${r.totalLateMinutes}m`, style: "sub", alignment: "center" }] }
      : numCell(r.lateDays);
    const types = Object.entries(r.leavesThisMonthByType || {}).map(([t, n]) => `${titleCase(t)} ${n}`).join(", ");
    const leaveCell = { stack: [{ text: String(r.onLeaveDays), alignment: "center", color: z(r.onLeaveDays) ? GREY0 : INK }, ...(types ? [{ text: types, style: "sub", alignment: "center" }] : [])] };
    const ent = `${r.leaveEntitlementYear}${r.medicalEligible ? " +M" : ""}`;
    const remarkParts: string[] = [];
    if (r.remark && String(r.remark).trim()) remarkParts.push(String(r.remark).trim());
    if (r.shortEarlyLeaves > 0) remarkParts.push(`Early out: ${r.shortEarlyLeaves}`);
    const remark = remarkParts.join("  ·  ");
    return [
      { text: r.code || "", style: "td", noWrap: true },
      { text: r.name || "", style: "td" },
      { text: r.designation || "", style: "td" },
      { text: r.unit || "—", style: "td", noWrap: true },
      { text: fmtDay(r.joiningDate), style: "td", noWrap: true },
      { text: r.serviceLength || "", style: "td", alignment: "center", noWrap: true },
      numCell(r.presentDays),
      lateCell,
      numCell(r.halfDays),
      numCell(r.absentDays, { bold: r.absentDays > 0 }),
      leaveCell,
      { text: ent, style: "td", alignment: "center", noWrap: true, color: r.leaveEntitlementYear === 0 ? GREY0 : INK },
      numCell(r.leavesTakenYear),
      numCell(r.remainingLeaveYear, { bold: r.remainingLeaveYear <= 0 }),
      { text: remark || "—", style: remark ? "td" : "tdMuted" },
    ];
  };

  // Body: grouped header (2 rows) + department subheadings + data rows (rows already sorted dept,name).
  const body: any[] = [groupRow, headRow];
  const kinds: string[] = ["group", "head"]; // parallel to body, drives fill striping
  let lastDept: string | null = null;
  let parity = 0;
  for (const r of rows) {
    const dept = (r.department || "—").toString();
    if (dept !== lastDept) {
      lastDept = dept;
      parity = 0;
      body.push([{ text: dept, colSpan: 15, style: "dept" }, ...Array(14).fill({})]);
      kinds.push("dept");
    }
    body.push(dataRow(r));
    kinds.push((parity++ % 2 === 1) ? "zebra" : "data");
  }

  const headerBlock = {
    columns: [
      { width: 60, ...logoOrEmpty() },
      { width: "*", alignment: "right", stack: [
        { text: company, style: "brand" },
        { text: "Monthly Employee Report", style: "docType" },
        { text: `${monthTitle(meta.year, meta.month)}${meta.filterLabel ? "    ·    " + meta.filterLabel : ""}`, style: "period" },
        { text: `Generated ${today}${meta.generatedBy ? " by " + meta.generatedBy : ""}`, style: "gen" },
      ] },
    ],
  };

  const stat = (label: string, val: any) => ({ stack: [{ text: String(val ?? 0), style: "statVal", alignment: "center" }, { text: label, style: "statLbl", alignment: "center" }] });
  const summaryStrip = {
    margin: [0, 12, 0, 10] as any,
    table: { widths: Array(7).fill("*"), body: [[
      stat("Employees", totals.employees), stat("Working days", totals.workingDays), stat("Holidays / offs", totals.holidaysWeeklyOffs),
      stat("Present", totals.presentDays), stat("Late", totals.lateDays), stat("Absent", totals.absentDays), stat("Leave days", totals.onLeaveDays),
    ]] },
    layout: {
      hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0.8 : 0),
      vLineWidth: () => 0, hLineColor: () => "#D8DEE6", paddingTop: () => 6, paddingBottom: () => 6,
    },
  };

  const doc: any = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [24, 24, 24, 30],
    content: [
      headerBlock,
      summaryStrip,
      {
        table: { headerRows: 2, dontBreakRows: true, widths, body },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 ? 0 : i === 2 ? 0.9 : i === node.table.body.length ? 0.6 : 0.3),
          vLineWidth: () => 0.3,
          hLineColor: (i: number) => (i === 2 ? "#9AA3B2" : "#E6E9ED"),
          vLineColor: () => "#ECEEF1",
          fillColor: (ri: number) => {
            const k = kinds[ri];
            if (k === "group" || k === "head") return "#EEF1F4";
            if (k === "dept") return "#E2E6EB";
            if (k === "zebra") return "#F7F8FA";
            return null;
          },
          paddingTop: () => 1.3, paddingBottom: () => 1.3, paddingLeft: () => 3, paddingRight: () => 3,
        },
      },
    ],
    footer: (cur: number, total: number) => ({
      margin: [0, 6, 0, 0] as any,
      columns: [
        { text: `Generated ${today}`, style: "foot", margin: [24, 0, 0, 0] },
        { text: `Page ${cur} of ${total}`, style: "foot", alignment: "right", margin: [0, 0, 24, 0] },
      ],
    }),
    styles: {
      brand: { fontSize: 13, bold: true, color: "#1F2937" },
      docType: { fontSize: 10, bold: true, color: "#374151" },
      period: { fontSize: 8.5, color: "#6B7280" },
      gen: { fontSize: 7.5, color: "#9AA3B2" },
      statVal: { fontSize: 12.5, bold: true, color: "#1F2937" },
      statLbl: { fontSize: 7, color: "#6B7280", margin: [0, 1, 0, 0] },
      thg: { fontSize: 7, bold: true, color: "#374151" },
      th: { fontSize: 6.5, bold: true, color: "#374151" },
      td: { fontSize: 7, color: INK },
      tdMuted: { fontSize: 7, color: GREY0 },
      sub: { fontSize: 5, color: "#9AA3B2" },
      dept: { fontSize: 7.5, bold: true, color: "#1F2937" },
      foot: { fontSize: 7, color: "#9AA3B2" },
    },
    defaultStyle: { font: "Roboto", fontSize: 7 },
  };
  return pdfMake.createPdf(doc);
}

/**
 * One-page A4 portrait monthly attendance slip for a single employee: logo + company, an employee
 * block, the month's attendance summary, the year's leave block, a remarks box and HR/employee
 * signature lines. Clean and plain. All numbers come from the shared monthly calc (no math here).
 */
export function buildSlipPdf(row: any, meta: { year: number; month: number }): any {
  (pdfMake as any).fonts = fonts;
  const d = toDisplayRow(row);
  const company = (row.company || "").toString().trim() || "Power Highway";

  // Light two-column label/value grid (no vertical lines, hairline row separators).
  const field = (label: string, val: any) => [{ text: label, style: "k" }, { text: fmt(val) || "—", style: "v" }];
  const gridLayout = { hLineWidth: () => 0.4, vLineWidth: () => 0, hLineColor: () => "#E3E6EA", paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 0, paddingRight: () => 8 };

  const sectionHead = (text: string) => ({ text: text.toUpperCase(), style: "section", margin: [0, 14, 0, 6] });

  // Year-leave stat tiles (Entitlement / Taken / Remaining / Medical).
  const tile = (label: string, val: any) => ({ stack: [{ text: String(val), style: "statVal" }, { text: label, style: "statLabel" }], margin: [6, 7, 6, 7] });
  const tileLayout = {
    hLineWidth: () => 0.6, vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0.6 : 0.6),
    hLineColor: () => "#D8DEE6", vLineColor: () => "#D8DEE6",
    fillColor: () => "#F6F8FA",
  };

  const sig = (label: string) => ({
    width: "*",
    stack: [
      { text: " ", margin: [0, 22, 0, 0] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.7, lineColor: "#8A94A6" }] },
      { text: label, style: "sigLabel", margin: [0, 4, 0, 0] },
    ],
  });

  const doc: any = {
    pageSize: "A4", pageMargins: [44, 92, 44, 54],
    header: {
      margin: [44, 22, 44, 0],
      columns: [
        logoOrEmpty(),
        { stack: [{ text: company, style: "brand" }, { text: "Monthly Attendance Slip", style: "docType" }, { text: monthTitle(meta.year, meta.month), style: "period" }], alignment: "right" },
      ],
    },
    footer: (cur: number, total: number) => ({ columns: [
      { text: `Generated ${new Date().toISOString().slice(0, 10)}`, style: "foot", margin: [44, 0, 0, 0] },
      { text: `Page ${cur} of ${total}`, style: "foot", alignment: "right", margin: [0, 0, 44, 0] },
    ] }),
    content: [
      // Employee identity
      { text: row.name, style: "title" },
      { text: `${row.code}${row.designation ? "  ·  " + row.designation : ""}`, style: "sub", margin: [0, 1, 0, 0] },

      sectionHead("Employee"),
      { columns: [
        { width: "50%", table: { widths: ["42%", "58%"], body: [
          field("Code", row.code), field("Department", row.department), field("Unit", row.unit), field("Policy band", row.policyGroup),
        ] }, layout: gridLayout },
        { width: "50%", table: { widths: ["42%", "58%"], body: [
          field("Designation", row.designation), field("Joining date", d.joining), field("Service length", row.serviceLength), field("Status", row.status),
        ] }, layout: gridLayout },
      ], columnGap: 20 },

      sectionHead(`Attendance — ${monthTitle(meta.year, meta.month)}`),
      { columns: [
        { width: "50%", table: { widths: ["60%", "40%"], body: [
          field("Present days", row.presentDays), field("Late days", row.lateDays), field("Late minutes", row.totalLateMinutes), field("Half days", row.halfDays),
        ] }, layout: gridLayout },
        { width: "50%", table: { widths: ["60%", "40%"], body: [
          field("Absent days", row.absentDays), field("On leave (days)", row.onLeaveDays), field("Holidays / weekly offs", row.holidaysWeeklyOffs), field("Short / early leaves", row.shortEarlyLeaves),
        ] }, layout: gridLayout },
      ], columnGap: 20 },
      { table: { widths: ["21%", "79%"], body: [field("Leaves this month", d.leaveTypes)] }, layout: gridLayout, margin: [0, 2, 0, 0] },

      sectionHead(`Annual leave — ${meta.year}`),
      { table: { widths: ["25%", "25%", "25%", "25%"], body: [[
        tile("Entitlement", row.leaveEntitlementYear), tile("Taken", row.leavesTakenYear), tile("Remaining", row.remainingLeaveYear), tile("Medical eligible", d.medical),
      ]] }, layout: tileLayout },

      sectionHead("Remarks"),
      { table: { widths: ["*"], body: [[{ text: row.remark && String(row.remark).trim() ? String(row.remark) : "—", style: "remark", margin: [8, 8, 8, 18] }]] },
        layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => "#D8DEE6", vLineColor: () => "#D8DEE6" } },

      { columns: [sig("HR / Manager"), { width: 36, text: "" }, sig("Employee")], margin: [0, 30, 0, 0] },
    ],
    styles: {
      brand: { fontSize: 15, bold: true, color: "#2C3E50" },
      docType: { fontSize: 10, color: "#3A4658", bold: true },
      period: { fontSize: 9, color: "#6B7280" },
      title: { fontSize: 17, bold: true, color: "#1F2937" },
      sub: { fontSize: 9.5, color: "#6B7280" },
      section: { fontSize: 9, bold: true, color: "#2C3E50", characterSpacing: 0.6 },
      k: { fontSize: 9, color: "#5A6472" },
      v: { fontSize: 9, bold: true, color: "#1F2937" },
      statVal: { fontSize: 15, bold: true, color: "#2C3E50", alignment: "center" },
      statLabel: { fontSize: 7.5, color: "#6B7280", alignment: "center", margin: [0, 2, 0, 0] },
      remark: { fontSize: 9.5, color: "#1F2937" },
      sigLabel: { fontSize: 8.5, color: "#5A6472", bold: true },
      foot: { fontSize: 7, color: "#9AA3B2" },
    },
    defaultStyle: { font: "Roboto" },
  };
  return pdfMake.createPdf(doc);
}

function fmt(v: any): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
