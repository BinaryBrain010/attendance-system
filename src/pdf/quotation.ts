import pdfMake from "pdfmake/build/pdfmake";
import { fonts } from "./config/pdf-fonts";

const pdfFonts = require("./config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// Company letterhead details (edit here).
const COMPANY = {
  name: "Okasha Smart",
  tagline: "Smart Home & Automation",
  address: "Lahore, Pakistan",
  phone: "0301 0444888",
};

const money = (n: number | null | undefined) => `PKR ${Number(n || 0).toLocaleString()}`;
const dateStr = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export class QuotationPDF {
  constructor() {
    (pdfMake as any).fonts = fonts;
  }

  /** Build a quotation PDF generator. Simple, clean, black/grey only. */
  generate(q: any): any {
    const items = q.items || [];
    const body = [
      [
        { text: "#", style: "th" }, { text: "Item", style: "th" }, { text: "Qty", style: "th", alignment: "center" },
        { text: "Unit Price", style: "th", alignment: "right" }, { text: "Discount", style: "th", alignment: "right" }, { text: "Line Total", style: "th", alignment: "right" },
      ],
      ...items.map((it: any, i: number) => [
        { text: String(i + 1), style: "td" },
        { text: it.description || it.productId || "-", style: "td" },
        { text: String(it.quantity ?? 1), style: "td", alignment: "center" },
        { text: money(it.unitPrice), style: "td", alignment: "right" },
        { text: money(it.lineDiscount), style: "td", alignment: "right" },
        { text: money(it.lineTotal), style: "td", alignment: "right" },
      ]),
    ];

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [48, 56, 48, 60],
      content: [
        // Letterhead
        {
          columns: [
            [
              { text: COMPANY.name, style: "brand" },
              { text: COMPANY.tagline, style: "sub" },
            ],
            [
              { text: COMPANY.address, style: "contact", alignment: "right" },
              { text: `Phone: ${COMPANY.phone}`, style: "contact", alignment: "right" },
            ],
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 6, x2: 499, y2: 6, lineWidth: 1, lineColor: "#333333" }] },

        { text: "QUOTATION", style: "doctitle", margin: [0, 14, 0, 2] },

        // Meta + customer
        {
          columns: [
            [
              { text: [{ text: "Quotation No: ", style: "lbl" }, { text: `${q.quotationNo}  (v${q.version})`, style: "val" }] },
              { text: [{ text: "Date: ", style: "lbl" }, { text: dateStr(q.createdAt || Date.now()), style: "val" }] },
              { text: [{ text: "Valid Until: ", style: "lbl" }, { text: dateStr(q.validUntil), style: "val" }] },
              { text: [{ text: "Status: ", style: "lbl" }, { text: q.status, style: "val" }] },
            ],
            [
              { text: "BILL TO", style: "lbl2", alignment: "right" },
              { text: q.customerName || "-", style: "val", alignment: "right" },
              { text: q.phone ? `Phone: ${q.phone}` : "", style: "contact", alignment: "right" },
              { text: `Price tier: ${q.tier}`, style: "contact", alignment: "right" },
            ],
          ],
          margin: [0, 6, 0, 14],
        },

        // Items
        {
          table: { headerRows: 1, widths: [18, "*", 34, 72, 64, 74], body },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
            vLineWidth: () => 0,
            hLineColor: () => "#999999",
            fillColor: (rowIndex: number) => (rowIndex === 0 ? "#eeeeee" : null),
            paddingTop: () => 5, paddingBottom: () => 5,
          },
        },

        // Totals
        {
          columns: [
            { text: "", width: "*" },
            {
              width: 230,
              table: {
                widths: ["*", "auto"],
                body: [
                  [{ text: "Subtotal", style: "tl" }, { text: money(q.subtotal), style: "tl", alignment: "right" }],
                  [{ text: "Discount", style: "tl" }, { text: money(q.discount), style: "tl", alignment: "right" }],
                  [{ text: "Total", style: "tlb" }, { text: money(q.total), style: "tlb", alignment: "right" }],
                ],
              },
              layout: { hLineWidth: (i: number) => (i === 2 ? 0.8 : 0), vLineWidth: () => 0, hLineColor: () => "#333333", paddingTop: () => 3, paddingBottom: () => 3 },
              margin: [0, 12, 0, 0],
            },
          ],
        },

        // Terms + signature
        { text: "Terms & Conditions", style: "lbl2", margin: [0, 28, 0, 3] },
        {
          ul: [
            "Prices are in PKR and valid until the date stated above.",
            "50% advance may be required to confirm the order.",
            "Delivery timelines are estimated and may vary by stock and location.",
            "Installation (if applicable) is quoted separately unless stated.",
          ],
          style: "terms",
        },
        {
          columns: [
            { text: "", width: "*" },
            {
              width: 200,
              stack: [
                { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.6, lineColor: "#333333" }], margin: [0, 40, 0, 4] },
                { text: "Authorized Signature", style: "sig", alignment: "center" },
              ],
            },
          ],
        },
      ],
      styles: {
        brand: { fontSize: 20, bold: true, color: "#111111" },
        sub: { fontSize: 9, color: "#666666", margin: [0, 1, 0, 0] },
        contact: { fontSize: 9, color: "#555555", margin: [0, 1, 0, 0] },
        doctitle: { fontSize: 15, bold: true, color: "#333333", characterSpacing: 2 },
        lbl: { fontSize: 9.5, color: "#666666" },
        lbl2: { fontSize: 9, bold: true, color: "#444444", margin: [0, 0, 0, 2] },
        val: { fontSize: 10.5, color: "#111111", bold: true },
        th: { fontSize: 9.5, bold: true, color: "#222222", margin: [0, 2, 0, 2] },
        td: { fontSize: 10, color: "#222222" },
        tl: { fontSize: 10, color: "#333333" },
        tlb: { fontSize: 11.5, bold: true, color: "#111111" },
        terms: { fontSize: 8.5, color: "#666666", lineHeight: 1.25 },
        sig: { fontSize: 9, color: "#555555" },
      },
      defaultStyle: { fontSize: 10, color: "#222222" },
    };
    return pdfMake.createPdf(docDefinition);
  }
}
