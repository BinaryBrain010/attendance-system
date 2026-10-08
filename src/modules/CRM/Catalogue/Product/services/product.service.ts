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
  search(term: string, page = 1, pageSize = 10) {
    return prisma.product.gpSearch(term, ["name", "sku", "description"], page, pageSize);
  }
}

export default ProductService;
