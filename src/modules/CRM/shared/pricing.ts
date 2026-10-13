/**
 * Line pricing guard. A quotation/order line must have a usable price: either an explicit
 * `unitPrice` on the line, or the referenced product's current PriceList carries a real
 * (non-pending, non-null) price. A line that resolves to no price is rejected — we never quote or
 * sell at a placeholder/zero price. Returns the lines with `unitPrice` filled in from the catalogue
 * where it was omitted.
 *
 * `defaultTier` is the header tier of the quotation/order; a line with no `tier` of its own is
 * priced at that tier. Catalogue lookup prefers a variant-specific price row (when the line carries
 * a variantId) and falls back to the product-level price (variantId null). For a product-linked
 * line, `unitCost` is always taken from the catalogue so the margin report works even when the
 * caller (an agent without cost permission) never sees or sends cost.
 */
import prisma from "../../../core/models/base.model";
import { AppError } from "../../../core/errors/app.error";

type Tier = "RETAIL" | "DEALER" | "OUTLET";

/** Current price for a product at a tier, preferring the variant-specific row when variantId is given. */
async function currentPrice(productId: string, variantId: string | null | undefined, tier: Tier) {
  if (variantId) {
    const v = await prisma.priceList.findFirst({
      where: { productId, variantId, tier, validTo: null, isDeleted: null },
      orderBy: { validFrom: "desc" },
    });
    if (v) return v;
  }
  return prisma.priceList.findFirst({
    where: { productId, variantId: null, tier, validTo: null, isDeleted: null },
    orderBy: { validFrom: "desc" },
  });
}

export async function priceLines(items: any[], defaultTier: Tier = "RETAIL"): Promise<any[]> {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const out: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const tier: Tier = (it.tier as Tier) ?? defaultTier ?? "RETAIL";

    if (typeof it.unitPrice === "number") {
      // Explicit price wins (e.g. a negotiated price, or a free-text custom line). For a
      // product-linked line we still fill unitCost from the catalogue so margin stays correct.
      if (it.productId && (it.unitCost === undefined || it.unitCost === null)) {
        const current = await currentPrice(it.productId, it.variantId, tier);
        if (current && !current.pricePending && current.cost !== null && current.cost !== undefined) {
          out.push({ ...it, unitCost: current.cost });
          continue;
        }
      }
      out.push(it);
      continue;
    }

    if (!it.productId) {
      throw new AppError(400, `Line ${i + 1}: no unitPrice and no productId — cannot price this line`);
    }
    const current = await currentPrice(it.productId, it.variantId, tier);
    if (!current || current.pricePending || current.price === null || current.price === undefined) {
      throw new AppError(400, `Line ${i + 1}: product ${it.productId} has no ${tier} price yet (pricePending) — set a price before quoting/selling`);
    }
    out.push({ ...it, unitPrice: current.price, unitCost: it.unitCost ?? current.cost ?? null });
  }
  return out;
}
