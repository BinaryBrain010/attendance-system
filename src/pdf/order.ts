import pdfMake from "pdfmake/build/pdfmake";
import { fonts } from "./config/pdf-fonts";

const pdfFonts = require("./config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

const COMPANY = { name: "Okasha Smart", tagline: "Smart Home & Automation", address: "Lahore, Pakistan", phone: "0301 0444888" };
const money = (n: number | null | undefined) => `PKR ${Number(n || 0).toLocaleString()}`;
const dateStr = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

function letterhead() {
  return [
    { columns: [[{ text: COMPANY.name, style: "brand" }, { text: COMPANY.tagline, style: "sub" }],
      [{ text: COMPANY.address, style: "contact", alignment: "right" }, { text: `Phone: ${COMPANY.phone}`, style: "contact", alignment: "right" }]] },
    { canvas: [{ type: "line", x1: 0, y1: 6, x2: 499, y2: 6, lineWidth: 1, lineColor: "#333333" }] },
  ];
}

const STYLES = {
  brand: { fontSize: 20, bold: true, color: "#111111" }, sub: { fontSize: 9, color: "#666666", margin: [0, 1, 0, 0] },
  contact: { fontSize: 9, color: "#555555", margin: [0, 1, 0, 0] }, doctitle: { fontSize: 15, bold: true, color: "#333333", characterSpacing: 2 },
  lbl: { fontSize: 9.5, color: "#666666" }, lbl2: { fontSize: 9, bold: true, color: "#444444", margin: [0, 0, 0, 2] },
  val: { fontSize: 10.5, color: "#111111", bold: true }, th: { fontSize: 9.5, bold: true, color: "#222222", margin: [0, 2, 0, 2] },
  td: { fontSize: 10, color: "#222222" }, tl: { fontSize: 10, color: "#333333" }, tlb: { fontSize: 11.5, bold: true, color: "#111111" },
  sig: { fontSize: 9, color: "#555555" }, note: { fontSize: 8.5, color: "#666666", lineHeight: 1.25 },
};

export class OrderPDF {
  constructor() { (pdfMake as any).fonts = fonts; }

  /** Tax invoice: items with prices + totals + payment. */
  invoice(o: any): any {
    const items = o.items || [];
    const body = [
      [{ text: "#", style: "th" }, { text: "Item", style: "th" }, { text: "Qty", style: "th", alignment: "center" },
        { text: "Unit Price", style: "th", alignment: "right" }, { text: "Discount", style: "th", alignment: "right" }, { text: "Line Total", style: "th", alignment: "right" }],
      ...items.map((it: any, i: number) => [
        { text: String(i + 1), style: "td" }, { text: it.description || it.productId || "-", style: "td" },
        { text: String(it.quantity ?? 1), style: "td", alignment: "center" }, { text: money(it.unitPrice), style: "td", alignment: "right" },
        { text: money(it.lineDiscount), style: "td", alignment: "right" }, { text: money(it.lineTotal), style: "td", alignment: "right" }]),
    ];
    const paid = o.amountReceived || 0;
    const balance = (o.total || 0) - paid;
    const doc: any = {
      pageSize: "A4", pageMargins: [48, 56, 48, 60],
      content: [
        ...letterhead(),
        { text: "INVOICE", style: "doctitle", margin: [0, 14, 0, 2] },
        { columns: [
          [{ text: [{ text: "Order No: ", style: "lbl" }, { text: o.orderNo || "-", style: "val" }] },
            { text: [{ text: "Date: ", style: "lbl" }, { text: dateStr(o.createdAt || Date.now()), style: "val" }] },
            o.externalOrderNo ? { text: [{ text: "Shopify #: ", style: "lbl" }, { text: o.externalOrderNo, style: "val" }] } : {},
            { text: [{ text: "Status: ", style: "lbl" }, { text: o.status, style: "val" }] }],
          [{ text: "BILL TO", style: "lbl2", alignment: "right" }, { text: o.customerName || "-", style: "val", alignment: "right" },
            { text: o.phone ? `Phone: ${o.phone}` : "", style: "contact", alignment: "right" },
            { text: [o.address, o.area, o.city].filter(Boolean).join(", ") || "", style: "contact", alignment: "right" }]],
          margin: [0, 6, 0, 14] },
        { table: { headerRows: 1, widths: [18, "*", 34, 72, 64, 74], body },
          layout: { hLineWidth: (i: number, n: any) => (i === 0 || i === 1 || i === n.table.body.length ? 0.8 : 0.4), vLineWidth: () => 0, hLineColor: () => "#999999", fillColor: (r: number) => (r === 0 ? "#eeeeee" : null), paddingTop: () => 5, paddingBottom: () => 5 } },
        { columns: [{ text: "", width: "*" }, { width: 230, table: { widths: ["*", "auto"], body: [
          [{ text: "Subtotal", style: "tl" }, { text: money(o.subtotal), style: "tl", alignment: "right" }],
          [{ text: "Discount", style: "tl" }, { text: money(o.discount), style: "tl", alignment: "right" }],
          [{ text: "Total", style: "tlb" }, { text: money(o.total), style: "tlb", alignment: "right" }],
          [{ text: `Received (${o.paymentType || "-"})`, style: "tl" }, { text: money(paid), style: "tl", alignment: "right" }],
          [{ text: "Balance", style: "tlb" }, { text: money(balance), style: "tlb", alignment: "right" }],
        ] }, layout: { hLineWidth: (i: number) => (i === 2 || i === 5 ? 0.8 : 0), vLineWidth: () => 0, hLineColor: () => "#333333", paddingTop: () => 3, paddingBottom: () => 3 }, margin: [0, 12, 0, 0] }] },
        { text: "Thank you for your order.", style: "note", margin: [0, 26, 0, 0] },
      ],
      styles: STYLES, defaultStyle: { fontSize: 10, color: "#222222" },
    };
    return pdfMake.createPdf(doc);
  }

  /** Delivery slip: address + courier + items (no prices) + received-by signature. */
  deliverySlip(o: any): any {
    const items = o.items || [];
    const body = [
      [{ text: "#", style: "th" }, { text: "Item", style: "th" }, { text: "Qty", style: "th", alignment: "center" }],
      ...items.map((it: any, i: number) => [{ text: String(i + 1), style: "td" }, { text: it.description || it.productId || "-", style: "td" }, { text: String(it.quantity ?? 1), style: "td", alignment: "center" }]),
    ];
    const doc: any = {
      pageSize: "A4", pageMargins: [48, 56, 48, 60],
      content: [
        ...letterhead(),
        { text: "DELIVERY SLIP", style: "doctitle", margin: [0, 14, 0, 2] },
        { columns: [
          [{ text: [{ text: "Order No: ", style: "lbl" }, { text: o.orderNo || "-", style: "val" }] },
            { text: [{ text: "Date: ", style: "lbl" }, { text: dateStr(o.dispatchedAt || o.createdAt || Date.now()), style: "val" }] },
            { text: [{ text: "Courier: ", style: "lbl" }, { text: o.courier || "-", style: "val" }] },
            { text: [{ text: "CN / Tracking: ", style: "lbl" }, { text: o.trackingNo || "-", style: "val" }] },
            { text: [{ text: "Payment: ", style: "lbl" }, { text: `${o.paymentType || "-"}  Balance ${money((o.total || 0) - (o.amountReceived || 0))}`, style: "val" }] }],
          [{ text: "DELIVER TO", style: "lbl2", alignment: "right" }, { text: o.customerName || "-", style: "val", alignment: "right" },
            { text: o.phone ? `Phone: ${o.phone}` : "", style: "contact", alignment: "right" },
            { text: [o.address, o.area, o.city].filter(Boolean).join(", ") || "", style: "contact", alignment: "right" }]],
          margin: [0, 6, 0, 14] },
        { table: { headerRows: 1, widths: [18, "*", 48], body },
          layout: { hLineWidth: (i: number, n: any) => (i === 0 || i === 1 || i === n.table.body.length ? 0.8 : 0.4), vLineWidth: () => 0, hLineColor: () => "#999999", fillColor: (r: number) => (r === 0 ? "#eeeeee" : null), paddingTop: () => 6, paddingBottom: () => 6 } },
        { columns: [
          { width: "*", stack: [{ canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.6, lineColor: "#333333" }], margin: [0, 48, 0, 4] }, { text: "Received by (name & signature)", style: "sig" }] },
          { width: 40, text: "" },
          { width: "*", stack: [{ canvas: [{ type: "line", x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.6, lineColor: "#333333" }], margin: [0, 48, 0, 4] }, { text: "Date", style: "sig" }] },
        ] },
      ],
      styles: STYLES, defaultStyle: { fontSize: 10, color: "#222222" },
    };
    return pdfMake.createPdf(doc);
  }
}
