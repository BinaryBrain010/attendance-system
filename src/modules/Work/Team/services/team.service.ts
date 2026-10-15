import prisma from "../../../../core/models/base.model";
import { GOD_ID, getFeatureSet, holds } from "../../../CRM/shared/access";
import { NotFoundError } from "../../../../core/errors/app.error";

const include = {
  lead: { select: { id: true, name: true, surname: true } },
  unit: { select: { id: true, name: true } },
  members: { where: { isDeleted: null }, include: { employee: { select: { id: true, name: true, surname: true } } } },
  _count: { select: { tasks: true } },
};

/** Team ids visible to the caller: all (work.team.read.all / god) or teams they lead or belong to. */
async function visibleTeamWhere(userId: string): Promise<Record<string, any>> {
  if (userId === GOD_ID) return { isDeleted: null };
  const feats = await getFeatureSet(userId);
  if (holds(feats, "work.team.read.all.*")) return { isDeleted: null };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  const empId = user?.employeeId;
  if (!empId) return { isDeleted: null, id: "__none__" };
  return { isDeleted: null, OR: [{ leadId: empId }, { members: { some: { employeeId: empId, isDeleted: null } } }] };
}

class TeamService {
  async get(userId: string) {
    const where = await visibleTeamWhere(userId);
    return prisma.team.findMany({ where, include, orderBy: { name: "asc" } });
  }
  async getById(_userId: string, id: string) {
    const t = await prisma.team.findUnique({ where: { id }, include });
    return t && !t.isDeleted ? t : null;
  }
  async create(userId: string, data: any) {
    const { members = [], ...h } = data;
    return prisma.team.create({
      data: {
        name: h.name, description: h.description ?? null, leadId: h.leadId ?? null, unitId: h.unitId ?? null,
        ...(Array.isArray(h.statuses) && h.statuses.length ? { statuses: h.statuses } : {}),
        createdBy: userId, members: { create: (members || []).map((e: string) => ({ employeeId: e })) },
      },
      include,
    });
  }
  async update(userId: string, id: string, data: any) {
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) throw new NotFoundError("Team not found");
    const HEADER = ["name", "description", "leadId", "unitId", "statuses"];
    const d: any = { updatedBy: userId };
    for (const k of HEADER) if (k in data) d[k] = data[k];
    return prisma.team.update({ where: { id }, data: d, include });
  }
  async setMembers(userId: string, id: string, employeeIds: string[]) {
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) throw new NotFoundError("Team not found");
    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    if (employeeIds.length) await prisma.teamMember.createMany({ data: employeeIds.map((e) => ({ teamId: id, employeeId: e })) });
    return prisma.team.update({ where: { id }, data: { updatedBy: userId }, include });
  }
  async remove(userId: string, id: string) {
    return prisma.team.update({ where: { id }, data: { isDeleted: new Date(), updatedBy: userId } });
  }
}

export default TeamService;
