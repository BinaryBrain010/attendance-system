/**
 * Backfill unit prices for RETURNS_IMPORT orders (LOCAL only). The returns importer creates
 * historical orders with unitPrice = 0 ("pending price") because the catalogue has no real prices
 * yet. Once catalogue prices exist, run this to match each line's description to a product by name
 * and set unitPrice from that product's non-pending price list, then recompute line/order totals.
 *
 *   npx ts-node qa/backfillReturnImportPrices.ts           # dry-run (default): report only
 *   npx ts-node qa/backfillReturnImportPrices.ts --apply   # persist
 */
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) { console.error(`refusing: DATABASE_URL host "${host}" is not local`); process.exit(2); }
const APPLY = process.argv.includes("--apply");

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function priceOf(p: any): number | null {
  const usable = (p.prices || []).filter((x: any) => x.isDeleted == null && !x.pricePending && x.price != null && (x.validTo == null || new Date(x.validTo) > new Date()));
  if (!usable.length) return null;
  const retail = usable.find((x: any) => x.tier === "RETAIL");
  return (retail || usable[0]).price;
}

async function main() {
  const products = await prisma.product.findMany({ where: { isDeleted: null }, include: { prices: true } });
  const priced = products.map((p) => ({ id: p.id, name: p.name, n: norm(p.name), price: priceOf(p) })).filter((p) => p.price != null);
  if (!priced.length) { console.log("No catalogue prices set yet — nothing to backfill. Set prices first, then re-run."); await prisma.$disconnect(); return; }

  const orders = await prisma.salesOrder.findMany({ where: { sourceFile: "RETURNS_IMPORT", isDeleted: null }, include: { items: { where: { isDeleted: null } } } });
  let lineMatched = 0, lineUnmatched = 0, ordersTouched = 0;
  const unmatchedSamples = new Set<string>();

  for (const o of orders) {
    let changed = false, subtotal = 0;
    for (const it of o.items) {
      if (it.unitPrice && it.unitPrice > 0) { subtotal += it.lineTotal || 0; continue; }
      const dn = norm(it.description || "");
      const hit = dn ? priced.find((p) => p.n === dn) || priced.find((p) => dn.includes(p.n) || p.n.includes(dn)) : null;
      if (hit && hit.price) {
        const lineTotal = hit.price * (it.quantity || 1);
        if (APPLY) await prisma.salesOrderItem.update({ where: { id: it.id }, data: { productId: hit.id, unitPrice: hit.price, lineTotal } });
        subtotal += lineTotal; lineMatched++; changed = true;
      } else { lineUnmatched++; if (it.description) unmatchedSamples.add(it.description); }
    }
    if (changed) {
      ordersTouched++;
      if (APPLY) await prisma.salesOrder.update({ where: { id: o.id }, data: { subtotal, total: subtotal - (o.discount || 0) } });
    }
  }

  console.log(`${APPLY ? "APPLIED" : "DRY-RUN"} — RETURNS_IMPORT orders: ${orders.length}, orders touched: ${ordersTouched}`);
  console.log(`lines matched to a priced product: ${lineMatched}, unmatched: ${lineUnmatched}`);
  if (unmatchedSamples.size) console.log("unmatched sample descriptions:", Array.from(unmatchedSamples).slice(0, 15));
  if (!APPLY) console.log("\nRe-run with --apply to persist.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
