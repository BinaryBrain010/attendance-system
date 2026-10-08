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
    const { productId, tier, variantId = null, price, cost = null, createdBy } = data;
    return prisma.$transaction(async (tx) => {
      await tx.priceList.updateMany({
        where: { productId, tier, variantId, validTo: null, isDeleted: null },
        data: { validTo: new Date() },
      });
      return tx.priceList.create({ data: { productId, tier, variantId, price, cost, createdBy } });
    });
  }
  update(id: string, data: any) {
    return prisma.priceList.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }
  remove(id: string) {
    return prisma.priceList.update({ where: { id }, data: { isDeleted: new Date() } });
  }
}

export default PriceListService;
