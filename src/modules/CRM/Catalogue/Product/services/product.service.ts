import prisma from "../../../../../core/models/base.model";

const currentPrice = { where: { isDeleted: null, validTo: null } };
const include = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  variants: { where: { isDeleted: null } },
  images: { where: { isDeleted: null } },
  prices: currentPrice,
};

class ProductService {
  getAll() {
    return prisma.product.findMany({ where: { isDeleted: null }, include, orderBy: { name: "asc" } });
  }
  async get(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.product.findMany({ where: { isDeleted: null }, include, skip, take: pageSize, orderBy: { name: "asc" } }),
      prisma.product.count({ where: { isDeleted: null } }),
    ]);
    return { data, totalSize };
  }
  getDeleted(page = 1, pageSize = 10) {
    return prisma.product.gpPgFindDeletedMany(page, pageSize);
  }
  getById(id: string) {
    return prisma.product.findUnique({ where: { id, isDeleted: null }, include });
  }
  byCategory(categoryId: string) {
    return prisma.product.findMany({ where: { isDeleted: null, categoryId }, include, orderBy: { name: "asc" } });
  }
  /**
   * Sales of a product: sold qty + revenue from DELIVERED order lines, quoted qty, returned qty, and
   * recent orders/quotations containing it. cost/margin fields are emitted here and stripped by the
   * controller (stripCost) unless the caller holds crm.catalogue.cost.*. Line items carry a loose
   * productId (no relation), so we query the item tables directly.
   */
  async sales(productId: string) {
    const [orderItems, quoteItems, returnItems, recentOrders, recentQuotes] = await Promise.all([
      prisma.salesOrderItem.findMany({ where: { productId, isDeleted: null, order: { isDeleted: null, status: "DELIVERED" } }, select: { quantity: true, lineTotal: true, unitCost: true } }),
      prisma.quotationItem.findMany({ where: { productId, isDeleted: null }, select: { quantity: true } }),
      prisma.returnItem.findMany({ where: { productId, isDeleted: null }, select: { quantity: true } }),
      prisma.salesOrderItem.findMany({ where: { productId, isDeleted: null }, select: { quantity: true, unitPrice: true, lineTotal: true, order: { select: { id: true, orderNo: true, customerName: true, status: true, createdAt: true } } }, orderBy: { id: "desc" }, take: 10 }),
      prisma.quotationItem.findMany({ where: { productId, isDeleted: null }, select: { quantity: true, unitPrice: true, quotation: { select: { id: true, quotationNo: true, version: true, customerName: true, status: true, createdAt: true } } }, orderBy: { id: "desc" }, take: 10 }),
    ]);
    const soldQty = orderItems.reduce((t, i) => t + (i.quantity || 0), 0);
    const revenue = orderItems.reduce((t, i) => t + (i.lineTotal || 0), 0);
    let cost = 0, costedLines = 0, pendingLines = 0;
    for (const i of orderItems) { if (i.unitCost != null) { cost += i.unitCost * (i.quantity || 0); costedLines++; } else pendingLines++; }
    const margin = costedLines ? revenue - cost : null;
    return {
      soldQty, revenue,
      cost, margin, marginPct: margin != null && revenue ? Math.round((margin / revenue) * 100) : null, costedLines, pendingLines,
      quotedQty: quoteItems.reduce((t, i) => t + (i.quantity || 0), 0),
      returnedQty: returnItems.reduce((t, i) => t + (i.quantity || 0), 0),
      recentOrders: recentOrders.map((i) => ({ ...(i.order as any), quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      recentQuotations: recentQuotes.map((i) => ({ ...(i.quotation as any), quantity: i.quantity, unitPrice: i.unitPrice })),
    };
  }
  total() {
    return prisma.product.gpCount();
  }
  create(data: any) {
    return prisma.product.gpCreate(data);
  }
  update(id: string, data: any) {
    return prisma.product.gpUpdate(id, data);
  }
  addVariant(productId: string, v: any) {
    return prisma.productVariant.create({ data: { productId, name: v.name, attributes: v.attributes ?? undefined, skuSuffix: v.skuSuffix ?? null, isActive: v.isActive ?? true } });
  }
  addImage(productId: string, img: any) {
    return prisma.productImage.create({ data: { productId, url: img.url, isPrimary: img.isPrimary ?? false, sortOrder: img.sortOrder ?? 0 } });
  }
  remove(id: string) {
    return prisma.product.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.product.gpRestore(id);
  }
  /** Typeahead for the quotation/order product picker: matches name or SKU, and returns each
   * product with its variants and current prices (cost stripped by the controller) so the picker
   * can show the tier price and block pending lines without extra round-trips. */
  async search(term: string, page = 1, pageSize = 10) {
    const t = String(term ?? "").trim();
    const where: any = { isDeleted: null };
    if (t) where.OR = [
      { name: { contains: t, mode: "insensitive" } },
      { sku: { contains: t, mode: "insensitive" } },
    ];
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.product.findMany({ where, include, skip, take: pageSize, orderBy: { name: "asc" } }),
      prisma.product.count({ where }),
    ]);
    return { data, totalSize };
  }
}

export default ProductService;
