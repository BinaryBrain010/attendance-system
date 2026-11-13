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

export function buildMonthlyPdf(rows: any[], totals: any, meta: { year: number; month: number }): any {
  (pdfMake as any).fonts = fonts;
  const cols = MONTHLY_COLUMNS;
  const header = cols.map((c) => ({ text: c.header, style: "th", alignment: c.align || "left" }));
  const body = [
    header,
    ...rows.map(toDisplayRow).map((d) => cols.map((c) => ({ text: fmt(d[c.key]), style: "td", alignment: c.align || "left" }))),
    cols.map((c, i) => {
      if (i === 0) return { text: "TOTAL", style: "tdBold" };
      if (c.key === "name") return { text: `${totals.employees} employees`, style: "tdBold" };
      if (TOTAL_KEYS.includes(c.key)) return { text: fmt(totals[c.key]), style: "tdBold", alignment: c.align || "left" };
      return { text: "", style: "tdBold" };
    }),
  ];
  const doc: any = {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [24, 70, 24, 36],
    header: {
      margin: [24, 16, 24, 0],
      columns: [
        logoOrEmpty(),
        { stack: [{ text: "Monthly Employee Report", style: "brand" }, { text: monthTitle(meta.year, meta.month), style: "period" }], alignment: "right" },
      ],
    },
    content: [
      { table: { headerRows: 1, widths: cols.map((c) => c.width), body }, layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3),
        vLineWidth: () => 0, hLineColor: () => "#AAAAAA",
        fillColor: (ri: number, node: any) => (ri === 0 ? "#2C3E50" : ri === node.table.body.length - 1 ? "#E8EDF2" : null),
        paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 3, paddingRight: () => 3,
      } },
    ],
    footer: (cur: number, total: number) => ({ text: `Page ${cur} of ${total}`, alignment: "center", fontSize: 7, color: "#888888", margin: [0, 6, 0, 0] }),
    styles: {
      brand: { fontSize: 13, bold: true, color: "#2C3E50" },
      period: { fontSize: 9, color: "#555555" },
      th: { fontSize: 6.5, bold: true, color: "#FFFFFF" },
      td: { fontSize: 6.5, color: "#222222" },
      tdBold: { fontSize: 6.5, bold: true, color: "#222222" },
    },
    defaultStyle: { fontSize: 7 },
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
