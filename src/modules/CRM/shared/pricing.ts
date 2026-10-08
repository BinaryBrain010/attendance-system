/**
 * Line pricing guard. A quotation/order line must have a usable price: either an explicit
 * `unitPrice` on the line, or the referenced product's current PriceList carries a real
 * (non-pending, non-null) price. A line that resolves to no price is rejected — we never quote or
 * sell at a placeholder/zero price. Returns the lines with `unitPrice` filled in from the catalogue
 * where it was omitted.
 */
import prisma from "../../../core/models/base.model";
import { AppError } from "../../../core/errors/app.error";

export async function priceLines(items: any[]): Promise<any[]> {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const out: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (typeof it.unitPrice === "number") { out.push(it); continue; } // explicit price wins
    if (!it.productId) {
      throw new AppError(400, `Line ${i + 1}: no unitPrice and no productId — cannot price this line`);
    }
    const current = await prisma.priceList.findFirst({
      where: { productId: it.productId, tier: it.tier ?? "RETAIL", validTo: null, isDeleted: null },
      orderBy: { validFrom: "desc" },
    });
    if (!current || current.pricePending || current.price === null || current.price === undefined) {
      throw new AppError(400, `Line ${i + 1}: product ${it.productId} has no price yet (pricePending) — set a price before quoting/selling`);
    }
    out.push({ ...it, unitPrice: current.price, unitCost: it.unitCost ?? current.cost ?? null });
  }
  return out;
}
