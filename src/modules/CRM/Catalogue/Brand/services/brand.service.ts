import prisma from "../../../../../core/models/base.model";

class BrandService {
  getAll() {
    return prisma.brand.gpFindMany();
  }
  get(page = 1, pageSize = 10) {
    return prisma.brand.gpPgFindMany(page, pageSize);
  }
  getDeleted(page = 1, pageSize = 10) {
    return prisma.brand.gpPgFindDeletedMany(page, pageSize);
  }
  getById(id: string) {
    return prisma.brand.gpFindById(id);
  }
  total() {
    return prisma.brand.gpCount();
  }
  create(data: any) {
    return prisma.brand.gpCreate(data);
  }
  update(id: string, data: any) {
    return prisma.brand.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.brand.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.brand.gpRestore(id);
  }
  search(term: string, page = 1, pageSize = 10) {
    return prisma.brand.gpSearch(term, ["name"], page, pageSize);
  }
}

export default BrandService;
