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

/** One-page monthly slip for a single employee. */
export function buildSlipPdf(row: any, meta: { year: number; month: number }): any {
  (pdfMake as any).fonts = fonts;
  const d = toDisplayRow(row);
  const line = (label: string, val: any) => [{ text: label, style: "k" }, { text: fmt(val), style: "v" }];
  const doc: any = {
    pageSize: "A4", pageMargins: [40, 90, 40, 40],
    header: {
      margin: [40, 24, 40, 0],
      columns: [logoOrEmpty(), { stack: [{ text: "Monthly Attendance Slip", style: "brand" }, { text: monthTitle(meta.year, meta.month), style: "period" }], alignment: "right" }],
    },
    content: [
      { text: `${row.name} (${row.code})`, style: "title", margin: [0, 0, 0, 2] },
      { text: `${row.designation || ""}${row.department ? " · " + row.department : ""}${row.unit ? " · " + row.unit : ""}`, style: "sub", margin: [0, 0, 0, 12] },
      { table: { widths: ["40%", "60%"], body: [
        line("Joining date", d.joining), line("Service length", row.serviceLength), line("Policy group", row.policyGroup),
        line("Present days", row.presentDays), line("Late days", row.lateDays), line("Total late minutes", row.totalLateMinutes),
        line("Half days", row.halfDays), line("Absent days", row.absentDays), line("On leave (days)", row.onLeaveDays),
        line("Leaves this month", d.leaveTypes), line("Leaves taken this year", row.leavesTakenYear),
        line("Leave entitlement (year)", row.leaveEntitlementYear), line("Remaining leave (year)", row.remainingLeaveYear),
        line("Medical eligible", d.medical), line("Holidays / weekly offs", row.holidaysWeeklyOffs), line("Short / early leaves", row.shortEarlyLeaves),
        line("Remark", row.remark || "—"),
      ] }, layout: { hLineWidth: () => 0.4, vLineWidth: () => 0, hLineColor: () => "#DDDDDD", paddingTop: () => 5, paddingBottom: () => 5 } },
    ],
    styles: {
      brand: { fontSize: 14, bold: true, color: "#2C3E50" }, period: { fontSize: 9, color: "#555555" },
      title: { fontSize: 15, bold: true }, sub: { fontSize: 9, color: "#666666" },
      k: { fontSize: 9, bold: true, color: "#444444" }, v: { fontSize: 9, color: "#111111" },
    },
  };
  return pdfMake.createPdf(doc);
}

function fmt(v: any): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
