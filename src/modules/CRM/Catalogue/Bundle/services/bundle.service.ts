import prisma from "../../../../../core/models/base.model";

class BundleService {
  getAll() {
    return prisma.bundle.findMany({ where: { isDeleted: null }, include: { items: { where: { isDeleted: null } } } });
  }
  get(page = 1, pageSize = 10) {
    return prisma.bundle.gpPgFindMany(page, pageSize);
  }
  getDeleted(page = 1, pageSize = 10) {
    return prisma.bundle.gpPgFindDeletedMany(page, pageSize);
  }
  getById(id: string) {
    return prisma.bundle.findUnique({ where: { id, isDeleted: null }, include: { items: { where: { isDeleted: null } } } });
  }
  total() {
    return prisma.bundle.gpCount();
  }
  create(data: any) {
    const { items, ...rest } = data;
    return prisma.bundle.create({
      data: {
        ...rest,
        items: Array.isArray(items) && items.length ? { create: items.map((i: any) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity ?? 1 })) } : undefined,
      },
      include: { items: true },
    });
  }
  update(id: string, data: any) {
    const { items, ...rest } = data;
    return prisma.bundle.gpUpdate(id, rest);
  }
  async addItem(bundleId: string, item: any) {
    return prisma.bundleItem.create({ data: { bundleId, productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity ?? 1 } });
  }
  remove(id: string) {
    return prisma.bundle.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.bundle.gpRestore(id);
  }
  search(term: string, page = 1, pageSize = 10) {
    return prisma.bundle.gpSearch(term, ["name", "description"], page, pageSize);
  }
}

export default BundleService;
