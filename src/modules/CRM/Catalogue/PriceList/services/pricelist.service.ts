import prisma from "../../../../../core/models/base.model";

class PriceListService {
  /** Current prices for a product (validTo null). */
  byProduct(productId: string) {
    return prisma.priceList.findMany({
      where: { productId, isDeleted: null, validTo: null },
      orderBy: { tier: "asc" },
    });
  }
  getById(id: string) {
    return prisma.priceList.findUnique({ where: { id } });
  }
  /** Add a price for a (product, tier, variant); supersede the prior current one. */
  async create(data: any) {
    const { productId, tier, variantId = null, price = null, cost = null, createdBy } = data;
    const pricePending = price === null || price === undefined;
    return prisma.$transaction(async (tx) => {
      await tx.priceList.updateMany({
        where: { productId, tier, variantId, validTo: null, isDeleted: null },
        data: { validTo: new Date() },
      });
      return tx.priceList.create({ data: { productId, tier, variantId, price, cost, pricePending, createdBy } });
    });
  }
  update(id: string, data: any) {
    return prisma.priceList.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }
  remove(id: string) {
    return prisma.priceList.update({ where: { id }, data: { isDeleted: new Date() } });
  }

  /** Bulk-set RETAIL price/cost from rows [{sku, price, cost}], matching products by SKU. Cost-gated
   * in the controller. dryRun reports matches without writing. */
  async bulkSetPrices(rows: { sku?: any; price?: any; cost?: any }[], createdBy: string | null, dryRun: boolean) {
    const toInt = (v: any) => { const n = parseInt(String(v ?? "").replace(/[^0-9.]/g, ""), 10); return Number.isFinite(n) && n >= 0 ? n : null; };
    const products = await prisma.product.findMany({ where: { isDeleted: null }, select: { id: true, sku: true, name: true } });
    const bySku: Record<string, any> = {};
    for (const p of products) bySku[String(p.sku).toUpperCase()] = p;
    const matched: any[] = [], unmatched: any[] = [];
    for (const r of rows || []) {
      const sku = String(r.sku ?? "").trim().toUpperCase();
      if (!sku) { unmatched.push({ sku: r.sku ?? "", reason: "blank SKU" }); continue; }
      const price = toInt(r.price), cost = toInt(r.cost);
      const p = bySku[sku];
      if (!p) { unmatched.push({ sku: r.sku, reason: "no product with this SKU" }); continue; }
      if (price == null && cost == null) { unmatched.push({ sku: r.sku, reason: "no usable price or cost" }); continue; }
      matched.push({ sku, productId: p.id, name: p.name, price, cost });
    }
    if (dryRun) return { dryRun: true, matched: matched.length, unmatched, sample: matched.slice(0, 15) };
    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const m of matched) {
        await tx.priceList.updateMany({ where: { productId: m.productId, tier: "RETAIL", variantId: null, validTo: null, isDeleted: null }, data: { validTo: new Date() } });
        await tx.priceList.create({ data: { productId: m.productId, tier: "RETAIL", variantId: null, price: m.price, cost: m.cost, pricePending: m.price == null, createdBy } });
        updated++;
      }
    }, { timeout: 120000 });
    return { dryRun: false, updated, unmatched };
  }
}

export default PriceListService;
