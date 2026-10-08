import prisma from "../../../../core/models/base.model";

const include = {
  employee: { select: { id: true, name: true, surname: true, code: true, company: true } },
  teamLead: { select: { id: true, agentCode: true } },
};

class SalesAgentService {
  getAll() {
    return prisma.salesAgent.findMany({ where: { isDeleted: null }, include, orderBy: { agentCode: "asc" } });
  }
  async get(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.salesAgent.findMany({ where: { isDeleted: null }, include, skip, take: pageSize, orderBy: { agentCode: "asc" } }),
      prisma.salesAgent.count({ where: { isDeleted: null } }),
    ]);
    return { data, totalSize };
  }
  getById(id: string) {
    return prisma.salesAgent.findUnique({ where: { id }, include: { ...include, members: { where: { isDeleted: null }, select: { id: true, agentCode: true } } } });
  }
  me(userId: string) {
    return prisma.salesAgent.findFirst({ where: { userId, isDeleted: null }, include });
  }
  total() {
    return prisma.salesAgent.gpCount();
  }
  /** Resolve the linked User from the employeeId (employee create auto-creates a user). */
  async create(data: any) {
    let { userId } = data;
    if (!userId && data.employeeId) {
      const user = await prisma.user.findFirst({ where: { employeeId: data.employeeId, isDeleted: null }, select: { id: true } });
      userId = user?.id ?? null;
    }
    return prisma.salesAgent.gpCreate({ ...data, userId });
  }
  update(id: string, data: any) {
    return prisma.salesAgent.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.salesAgent.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.salesAgent.gpRestore(id);
  }
  search(term: string, page = 1, pageSize = 10) {
    return prisma.salesAgent.gpSearch(term, ["agentCode", "outlet"], page, pageSize);
  }
}

export default SalesAgentService;
