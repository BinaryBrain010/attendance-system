/**
 * Returns + Reattempt CSV importer. DRY-RUN by default: parses, clusters reasons, normalizes
 * couriers, matches each row to an existing SalesOrder by external order no (Order Num) or CN
 * (tracking), and otherwise plans a HISTORICAL order to create; returns a full report. Only persists
 * (in one transaction) when dryRun=false.
 */
import prisma from "../../../../core/models/base.model";

export interface SourceFile { name: string; csv: string; }

function parseCSV(t: string): string[][] {
  const rows: string[][] = []; let i = 0, f = "", row: string[] = [], q = false;
  t = t.replace(/^﻿/, "");
  while (i < t.length) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
    i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const clean = (s: string) => (s || "").trim().replace(/\s+/g, " ");
const digits = (s: string) => (s || "").replace(/\D/g, "");
const money = (s: string) => { const n = parseFloat(String(s || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

// ---- reason clustering (free-text Detail -> canonical bucket) ----
// Order matters — more specific patterns first.
const REASON_CLUSTERS: { key: string; re: RegExp }[] = [
  { key: "No pickup / rider issue", re: /pick ?up|pick the call|not pick|rider (did not|misbehav|no call|did ?n)|did ?n.?t (pick|call)/i },
  { key: "Number off / unreachable", re: /number\s*(off|on divert|not responding|busy|divert)|wrong number|not responding|no response|unreach|switched off/i },
  { key: "Didn't order / unaware", re: /don.?t know about order|didn.?t order|did not order|unaware|mistaken|dual order/i },
  { key: "Bought from branch / outlet", re: /\bbranch\b|\boutlet\b|phase\s*\d/i },
  { key: "Already received / cancelled", re: /already (received|have|bought|purchas|deliver|cancel)|duplicate|double order/i },
  { key: "Not interested / changed mind", re: /not interested|no longer|don.?t want|changed mind|cancel/i },
  { key: "Price / COD refused", re: /expensive|too high|price|\bcod\b|cash|refus|payment/i },
  { key: "Late delivery", re: /late deliver|delay/i },
  { key: "Busy / unavailable / travel", re: /busy|not available|out of (city|station|country)|travel|abroad|allow open/i },
  { key: "Wrong / damaged / defective", re: /wrong item|damaged|defective|not working|faulty|broken|different (item|product)|missing/i },
  { key: "Address / delivery issue", re: /address|location|incomplete|undeliver|not found|shift/i },
];
function clusterReason(detail: string): string {
  const s = clean(detail);
  if (!s) return "Unspecified";
  for (const c of REASON_CLUSTERS) if (c.re.test(s)) return c.key;
  return "Other";
}

// ---- courier normalization ----
function normCourier(vendor: string): string {
  const s = clean(vendor).toLowerCase();
  if (!s) return "Unknown";
  if (/post\s*ex/.test(s)) return "PostEx";
  if (/\btcs\b/.test(s)) return "TCS";
  if (/leopard/.test(s)) return "Leopards";
  if (/m\s*&?\s*p|\bmnp\b/.test(s)) return "M&P";
  if (/trax/.test(s)) return "Trax";
  if (/call\s*courier|callcourier/.test(s)) return "CallCourier";
  if (/\bself\b/.test(s)) return "Self";
  if (/outlet|pickup/.test(s)) return "Outlet pickup";
  return clean(vendor);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = clean(s).replace(/[^\x20-\x7E]/g, "");
  const d = new Date(t);
  if (!isNaN(+d)) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (m) { const mo = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }[m[2].slice(0, 3).toLowerCase()]; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; if (mo != null) return new Date(Date.UTC(y, mo, +m[1])); }
  return null;
}

interface ReturnRow {
  cn: string | null; customerName: string; itemName: string | null; qty: number; phone: string | null;
  statusRaw: string; detail: string | null; reasonCluster: string; courierRaw: string | null; courier: string;
  orderNum: string | null; city: string | null; address: string | null; returnDate: Date | null; orderDate: Date | null;
  match: "order#" | "cn" | "create" | "skip"; reason?: string;
}
interface ReattemptRow { name: string; phone: string | null; cn: string | null; orderNum: string | null; date: Date | null; match: "order#" | "cn" | "create" | "skip"; }

class ReturnImportService {
  async run(returnsFile: SourceFile | null, reattemptFile: SourceFile | null, dryRun = true) {
    // existing order lookup maps
    const orders = await prisma.salesOrder.findMany({ where: { isDeleted: null }, select: { id: true, externalOrderNo: true, trackingNo: true } });
    const byExt: Record<string, string> = {}, byCn: Record<string, string> = {};
    for (const o of orders) { if (o.externalOrderNo) byExt[o.externalOrderNo] = o.id; if (o.trackingNo) byCn[digits(o.trackingNo)] = o.id; }

    // ---------- Returns ----------
    const returns: ReturnRow[] = [];
    const reasonDist: Record<string, number> = {}, courierDist: Record<string, number> = {}, cityDist: Record<string, number> = {};
    const reasonSamples: Record<string, Set<string>> = {};
    let rSkipped = 0;
    if (returnsFile) {
      const rows = parseCSV(returnsFile.csv);
      const hi = rows.findIndex((r) => r.join(",").toLowerCase().includes("customer name"));
      const header = (rows[hi] || []).map((h) => h.trim());
      const col = (re: RegExp) => header.findIndex((h) => re.test(h));
      const c = { cn: col(/cn/i), name: col(/customer name/i), date: col(/^date/i), item: col(/item name/i), phone: col(/mobile|phone/i), qty: col(/no\.? of items/i), status: col(/status/i), detail: col(/detail/i), vendor: col(/vendor/i), order: col(/order num/i), city: col(/city/i), addr: col(/address/i), odate: col(/order date/i) };
      for (let r = hi + 1; r < rows.length; r++) {
        const row = rows[r]; if (!row || row.every((x) => !clean(x))) continue;
        const name = clean(row[c.name]); if (!name) { rSkipped++; continue; }
        const orderNum = clean(row[c.order]) || null;
        const cn = (c.cn >= 0 ? digits(row[c.cn]) : "") || null;
        const detail = clean(row[c.detail]) || null;
        const reasonCluster = clusterReason(detail || "");
        const courierRaw = clean(row[c.vendor]) || null;
        const courier = normCourier(courierRaw || "");
        const city = clean(row[c.city]) || null;
        const match: ReturnRow["match"] = (orderNum && byExt[orderNum]) ? "order#" : (cn && byCn[cn]) ? "cn" : "create";
        reasonDist[reasonCluster] = (reasonDist[reasonCluster] || 0) + 1;
        courierDist[courier] = (courierDist[courier] || 0) + 1;
        if (city) cityDist[city] = (cityDist[city] || 0) + 1;
        (reasonSamples[reasonCluster] ||= new Set()).add(detail || "(blank)");
        returns.push({
          cn, customerName: name, itemName: clean(row[c.item]) || null, qty: money(row[c.qty]) || 1, phone: clean(row[c.phone]) || null,
          statusRaw: clean(row[c.status]), detail, reasonCluster, courierRaw, courier, orderNum, city, address: clean(row[c.addr]) || null,
          returnDate: parseDate(row[c.date]), orderDate: parseDate(row[c.odate]), match, reason: detail || reasonCluster,
        });
      }
    }

    // ---------- Reattempts ----------
    const reattempts: ReattemptRow[] = [];
    let aSkipped = 0;
    if (reattemptFile) {
      const rows = parseCSV(reattemptFile.csv);
      const hi = rows.findIndex((r) => r.join(",").toLowerCase().replace(/\s/g, "").includes("orderno"));
      const header = (rows[hi] || []).map((h) => h.trim());
      const col = (re: RegExp) => header.findIndex((h) => re.test(h));
      const c = { name: col(/name/i), num: col(/number/i), cn: col(/tracking/i), order: col(/order\s*no/i), date: col(/date/i) };
      for (let r = hi + 1; r < rows.length; r++) {
        const row = rows[r]; if (!row || row.every((x) => !clean(x))) continue;
        const name = clean(row[c.name]); const orderNum = clean(row[c.order]) || null; const cn = (c.cn >= 0 ? digits(row[c.cn]) : "") || null;
        if (!name && !orderNum && !cn) { aSkipped++; continue; }
        const match: ReattemptRow["match"] = (orderNum && byExt[orderNum]) ? "order#" : (cn && byCn[cn]) ? "cn" : "create";
        reattempts.push({ name, phone: clean(row[c.num]) || null, cn, orderNum, date: parseDate(row[c.date]), match });
      }
    }

    const report: any = {
      dryRun,
      returns: {
        rows: returns.length, skipped: rSkipped,
        matchedToOrder: returns.filter((r) => r.match !== "create").length,
        willCreateOrder: returns.filter((r) => r.match === "create").length,
        reasonClusters: reasonDist,
        reasonSamples: Object.fromEntries(Object.entries(reasonSamples).map(([k, v]) => [k, Array.from(v).slice(0, 6)])),
        couriers: courierDist,
        cities: Object.fromEntries(Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 15)),
      },
      reattempts: {
        rows: reattempts.length, skipped: aSkipped,
        matchedToOrder: reattempts.filter((r) => r.match !== "create").length,
        willCreateOrder: reattempts.filter((r) => r.match === "create").length,
      },
      detail: { returns, reattempts },
    };
    if (dryRun) return report;

    // ---------- persist (transaction) ----------
    const RSTATUS: Record<string, string> = {}; // could map "Order Cancel" etc.; returns import as REPORTED
    const before = { orders: await prisma.salesOrder.count(), returns: await prisma.salesReturn.count() };
    const res = await prisma.$transaction(async (tx) => {
      let ordersCreated = 0, returnsCreated = 0, reattemptsApplied = 0;
      const nextNo = async (model: "order" | "return") => {
        const field = model === "order" ? "orderNo" : "returnNo"; const prefix = model === "order" ? "SO-" : "RET-";
        const rows = model === "order" ? await tx.salesOrder.findMany({ where: { orderNo: { startsWith: prefix } }, select: { orderNo: true } }) : await tx.salesReturn.findMany({ where: { returnNo: { startsWith: prefix } }, select: { returnNo: true } });
        let max = 0; for (const r of rows as any[]) { const m = String(r[field]).match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
        return `${prefix}${String(max + 1).padStart(4, "0")}`;
      };
      const ensureOrder = async (ext: string | null, cn: string | null, r: Partial<ReturnRow>): Promise<string> => {
        if (ext && byExt[ext]) return byExt[ext];
        if (cn && byCn[cn]) return byCn[cn];
        const orderNo = await nextNo("order");
        const o = await tx.salesOrder.create({
          data: { orderNo, externalOrderNo: ext, trackingNo: cn, customerName: r.customerName || "(historical)", phone: r.phone ?? null, city: r.city ?? null,
            address: r.address ?? null, status: "RETURNED", channel: "ONLINE_STORE", courier: r.courier ?? null, dispatchedAt: r.orderDate ?? null,
            company: "OKASHASMART", sourceFile: "Returns SEP 2026", legacyId: ext || cn, createdBy: null,
            items: r.itemName ? { create: [{ description: r.itemName, quantity: r.qty || 1, unitPrice: 0, lineTotal: 0 }] } : undefined },
        });
        ordersCreated++;
        if (ext) byExt[ext] = o.id; if (cn) byCn[cn] = o.id;
        return o.id;
      };
      for (const r of returns) {
        const orderId = await ensureOrder(r.orderNum, r.cn, r);
        const returnNo = await nextNo("return");
        await tx.salesReturn.create({
          data: { returnNo, orderId, customerName: r.customerName, phone: r.phone, city: r.city, status: "REPORTED",
            reason: r.reason || r.reasonCluster, courier: r.courier, trackingNo: r.cn, reportedAt: r.returnDate ?? new Date(),
            company: "OKASHASMART", createdBy: null, items: r.itemName ? { create: [{ description: r.itemName, quantity: r.qty || 1 }] } : undefined },
        });
        returnsCreated++;
      }
      for (const a of reattempts) {
        const orderId = await ensureOrder(a.orderNum, a.cn, { customerName: a.name, phone: a.phone });
        const o = await tx.salesOrder.findUnique({ where: { id: orderId }, select: { reattemptCount: true, status: true } });
        await tx.salesOrder.update({ where: { id: orderId }, data: { reattemptCount: (o?.reattemptCount || 0) + 1, status: o?.status === "RETURNED" ? "RETURNED" : "DISPATCHED" } });
        reattemptsApplied++;
      }
      return { ordersCreated, returnsCreated, reattemptsApplied };
    }, { timeout: 180000 });
    const after = { orders: await prisma.salesOrder.count(), returns: await prisma.salesReturn.count() };
    return { ...report, persisted: { ...res, before, after } };
  }
}

export default ReturnImportService;
