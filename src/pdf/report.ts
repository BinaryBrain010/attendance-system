import pdfMake from "pdfmake/build/pdfmake";
import { fonts } from "./config/pdf-fonts";

const pdfFonts = require("./config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

const COMPANY = { name: "Okasha Smart", phone: "0301 0444888" };

export class ReportPDF {
  constructor() { (pdfMake as any).fonts = fonts; }

  /** Generic black/grey report table. columns: [{header,key,align?}]. */
  generate(title: string, columns: { header: string; key: string; align?: string }[], rows: any[], subtitle?: string): any {
    const header = columns.map((c) => ({ text: c.header, style: "th", alignment: c.align || "left" }));
    const body = [header, ...rows.map((r) => columns.map((c) => ({ text: fmt(r[c.key]), style: "td", alignment: c.align || "left" })))];
    const doc: any = {
      pageSize: "A4", pageOrientation: columns.length > 6 ? "landscape" : "portrait", pageMargins: [40, 50, 40, 46],
      content: [
        { columns: [{ text: COMPANY.name, style: "brand" }, { text: `Phone: ${COMPANY.phone}`, style: "contact", alignment: "right" }] },
        { canvas: [{ type: "line", x1: 0, y1: 5, x2: columns.length > 6 ? 760 : 515, y2: 5, lineWidth: 1, lineColor: "#333333" }] },
        { text: title, style: "title", margin: [0, 12, 0, subtitle ? 1 : 10] },
        subtitle ? { text: subtitle, style: "sub", margin: [0, 0, 0, 10] } : {},
        {
          table: { headerRows: 1, widths: columns.map(() => "*"), body },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
            vLineWidth: () => 0, hLineColor: () => "#999999",
            fillColor: (ri: number) => (ri === 0 ? "#eeeeee" : null), paddingTop: () => 4, paddingBottom: () => 4,
          },
        },
        { text: `Generated ${new Date().toISOString().slice(0, 10)}`, style: "foot", margin: [0, 16, 0, 0] },
      ],
      styles: {
        brand: { fontSize: 15, bold: true, color: "#111111" }, contact: { fontSize: 9, color: "#555555" },
        title: { fontSize: 15, bold: true, color: "#333333" }, sub: { fontSize: 9.5, color: "#666666" },
        th: { bold: true, fontSize: 9, color: "#222222" }, td: { fontSize: 9, color: "#222222" },
        foot: { fontSize: 8, color: "#999999", italics: true },
      },
      defaultStyle: { fontSize: 9, color: "#222222" },
    };
    return pdfMake.createPdf(doc);
  }
}

function fmt(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
