import { userCardSelect } from "../../../../core/db/safeSelect";
import bcrypt from "bcrypt";
import prisma from "../../../../core/models/base.model";
import { createRole } from "../types/role";
const roleModel = prisma.$extends({
  model: {
    role: {
      async gpFindMany(this: any) {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        const data = await this.findMany({
          where: {
            isDeleted: null,
            id: {
              not: excludedId,
            },
          },
        });

        return data;
      },
      async gpSoftDelete(this: any, id: string) {
        const existingItem = await this.findUnique({ where: { id } });
        if (existingItem.isDeleted === null) {
          await this.update({
            where: { id },
            data: { isDeleted: new Date() },
          });
        }

        await prisma.userRole.deleteMany({
          where:{
            roleId:id
          }
        })

        await prisma.groupRole.deleteMany({
          where:{
            groupId:id
          }
        })

      
      },
      async changeRole(this: any, userId: string, role: string) {
        const userRole = await prisma.userRole.findFirst({
          where: {
            userId: userId,
            isDeleted: null,
          },
        });

        if (!userRole) {
          throw new Error(`User role for user ${userId} not found.`);
        }

        const roleData = await prisma.role.findFirst({
          where: {
            name: role,
          },
        });

        const newRole = {
          userId: userId,
          roleId: roleData?.id,
        };

        await prisma.userRole.gpUpdate(userRole.id, newRole);
        return newRole;
      },

      async gpCreate(this: any, data: createRole) {
        // const rules: BusinessRule[] =
        //   await businessRuleModel.businessRule.actFindByFeatureId(
        //     "role.create.*"
        //   );

        // const readAccess = rules[0].operation.readAccess;
        // const writeAccess = rules[0].operation.writeAccess;

        let newData = {
          name: data.name,
          createdAt: new Date(),
          // readAccess: { ...readAccess },
          // writeAccess: { ...writeAccess }
        };

        const createdItem = await this.create({
          data: newData,
        });

        const mappedUsers = data.users.map((userId) => ({
          userId: userId,
          roleId: createdItem.id,
          active: true,
        }));

        await prisma.userRole.gpCreate(mappedUsers);

        const mappedGroups = data.groups.map((groupId: string) => ({
          groupId: groupId,
          roleId: createdItem.id,
          active: true,
        }));

        await prisma.groupRole.gpCreate(mappedGroups);

        return createdItem;
      },

      async gpUpdate(this: any, roleId: string, newData: createRole) {
        const updatedRole = await this.update({
          where: { id: roleId },
          data: { name: newData.name },
        });

        await prisma.userRole.deleteMany({
          where: { roleId: updatedRole.id },
        });

        await prisma.groupRole.deleteMany({
          where: { roleId: updatedRole.id },
        });

        const mappedUsers = newData.users.map((userId) => ({
          userId: userId,
          roleId: updatedRole.id,
          active: true,
        }));

        await prisma.userRole.gpCreate(mappedUsers);

        const mappedGroups = newData.groups.map((groupId: string) => ({
          groupId: groupId,
          roleId: updatedRole.id,
          active: true,
        }));

        await prisma.groupRole.gpCreate(mappedGroups);

        return updatedRole;
      },

      async getRoleByroleId(roleId: string) {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        const Role = await prisma.role.findMany({
            where: {
                id: roleId,
                isDeleted: null,
            },
            include: {
                userRoles: {
                    where: {
                        isDeleted: null,
                        userId: {
                          not: excludedId,
                        },
                    },
                    include: { user: { select: userCardSelect } },
                },
                groupRoles: {
                  where: {
                      isDeleted: null,
                      
                  },
                  include: {
                      group: true,
                  },
              },
            },
            orderBy: {
                name: "asc",
            },
        });
    
        return Role[0];
    },

    async gpPgFindManyWithSortAndFilter(
      this: any,
      page: number,
      pageSize: number,
      sortBy: string,
      sortOrder: 'asc' | 'desc',
      filter?: string,
      search?: string
    ) {
      const skip = (page - 1) * pageSize;
      const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
      
      // Build where clause
      const where: any = {
        isDeleted: null,
        id: {
          not: excludedId,
        },
      };

      // Check if filter is "true" for limited field selection
      const isFilterMode = filter === "true";

      // Add search filter if provided (multi-term sequential filtering)
      if (search) {
        const searchTerms = search
          .trim()
          .split(/\s+/)
          .filter((term) => term.length > 0);

        if (searchTerms.length > 0) {
          where.AND = where.AND || [];
          searchTerms.forEach((term) => {
            where.AND.push({
              OR: [{ name: { contains: term, mode: 'insensitive' } }],
            });
          });
        }
      }

      const order = sortOrder === 'asc' ? 'asc' : 'desc';
      // Sortable incl. server-computed users/groups counts. Default createdAt.
      let orderBy: any;
      if (sortBy === 'usersCount') orderBy = { userRoles: { _count: order } };
      else if (sortBy === 'groupsCount') orderBy = { groupRoles: { _count: order } };
      else if (['name', 'createdAt', 'updatedAt'].includes(sortBy)) orderBy = { [sortBy]: order };
      else orderBy = { createdAt: order };

      if (isFilterMode) {
        const [data, totalSize] = await Promise.all([
          this.findMany({ where, select: { id: true, name: true }, take: pageSize, skip, orderBy }),
          this.count({ where }),
        ]);
        return { data, totalSize };
      }

      // Full list: server-computed users count, groups count, permissions count.
      const [rows, totalSize] = await Promise.all([
        this.findMany({
          where,
          select: {
            id: true, name: true, createdAt: true, updatedAt: true,
            userRoles: { where: { isDeleted: null }, select: { id: true } },
            groupRoles: { where: { isDeleted: null }, select: { id: true } },
          },
          take: pageSize, skip, orderBy,
        }),
        this.count({ where }),
      ]);

      // Permissions count per role from FeaturePermission(parentType=Role) allowedFeatures.
      const ids = rows.map((r: any) => r.id);
      const perms = ids.length
        ? await prisma.featurePermission.findMany({ where: { parentType: 'Role', parentId: { in: ids } }, select: { parentId: true, permissions: true } })
        : [];
      const permCount = new Map<string, number>();
      for (const p of perms) {
        const af = (p.permissions as any)?.allowedFeatures;
        permCount.set(p.parentId, Array.isArray(af) ? af.length : 0);
      }

      const data = rows.map((r: any) => ({
        id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt,
        usersCount: (r.userRoles || []).length,
        groupsCount: (r.groupRoles || []).length,
        permissionsCount: permCount.get(r.id) ?? 0,
      }));

      return { data, totalSize };
    },
    
    },
  },
});

export default roleModel;
