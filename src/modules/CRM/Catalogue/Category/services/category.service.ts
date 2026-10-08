import prisma from "../../../../../core/models/base.model";

class CategoryService {
  getAll() {
    return prisma.category.gpFindMany();
  }
  get(page = 1, pageSize = 10) {
    return prisma.category.gpPgFindMany(page, pageSize);
  }
  getDeleted(page = 1, pageSize = 10) {
    return prisma.category.gpPgFindDeletedMany(page, pageSize);
  }
  getById(id: string) {
    return prisma.category.gpFindById(id);
  }
  total() {
    return prisma.category.gpCount();
  }
  create(data: any) {
    return prisma.category.gpCreate(data);
  }
  update(id: string, data: any) {
    return prisma.category.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.category.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.category.gpRestore(id);
  }
  search(term: string, page = 1, pageSize = 10) {
    return prisma.category.gpSearch(term, ["name", "description"], page, pageSize);
  }
}

export default CategoryService;
