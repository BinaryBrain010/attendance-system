import pdfMake from "pdfmake/build/pdfmake";
import { fonts } from "./config/pdf-fonts";

const pdfFonts = require("./config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

const money = (n: number | null | undefined) => `PKR ${Number(n || 0).toLocaleString()}`;

export class QuotationPDF {
  constructor() {
    (pdfMake as any).fonts = fonts;
  }

  /** Build a quotation PDF generator. `canSeeCost` keeps cost/margin off the customer-facing doc by default. */
  generate(q: any): any {
    const items = q.items || [];
    const body = [
      [{ text: "#", style: "th" }, { text: "Item", style: "th" }, { text: "Qty", style: "th" }, { text: "Unit Price", style: "th" }, { text: "Discount", style: "th" }, { text: "Line Total", style: "th" }],
      ...items.map((it: any, i: number) => [
        String(i + 1),
        it.description || it.productId || "-",
        String(it.quantity ?? 1),
        money(it.unitPrice),
        money(it.lineDiscount),
        money(it.lineTotal),
      ]),
    ];

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: "Okasha Smart", style: "brand" },
        { text: "Quotation", style: "title" },
        {
          columns: [
            [
              { text: `Quotation #: ${q.quotationNo}  (v${q.version})`, margin: [0, 2, 0, 0] },
              { text: `Status: ${q.status}` },
              { text: `Tier: ${q.tier}` },
              q.validUntil ? { text: `Valid until: ${new Date(q.validUntil).toISOString().slice(0, 10)}` } : {},
            ],
            [
              { text: `Customer: ${q.customerName}`, alignment: "right" },
              { text: q.phone ? `Phone: ${q.phone}` : "", alignment: "right" },
              { text: `Date: ${new Date(q.createdAt || Date.now()).toISOString().slice(0, 10)}`, alignment: "right" },
            ],
          ],
          margin: [0, 10, 0, 14],
        },
        { table: { headerRows: 1, widths: ["auto", "*", "auto", "auto", "auto", "auto"], body }, layout: "lightHorizontalLines" },
        {
          columns: [
            { text: "", width: "*" },
            {
              width: "auto",
              table: {
                body: [
                  [{ text: "Subtotal", style: "tl" }, { text: money(q.subtotal), alignment: "right" }],
                  [{ text: "Discount", style: "tl" }, { text: money(q.discount), alignment: "right" }],
                  [{ text: "Total", style: "tlb" }, { text: money(q.total), alignment: "right", bold: true }],
                ],
              },
              layout: "noBorders",
              margin: [0, 12, 0, 0],
            },
          ],
        },
        { text: "This quotation is system-generated.", style: "foot", margin: [0, 24, 0, 0] },
      ],
      styles: {
        brand: { fontSize: 16, bold: true, color: "#1d4ed8" },
        title: { fontSize: 20, bold: true, margin: [0, 6, 0, 0] },
        th: { bold: true, fillColor: "#f1f5f9", margin: [0, 2, 0, 2] },
        tl: { bold: false, margin: [0, 1, 12, 1] },
        tlb: { bold: true, margin: [0, 4, 12, 1] },
        foot: { fontSize: 9, color: "#64748b", italics: true },
      },
      defaultStyle: { fontSize: 10 },
    };
    return pdfMake.createPdf(docDefinition);
  }
}
