import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";

const shiftModel = prisma.$extends({
  model: {
    shift: {
      async gpFindMany(this: any) {
        return await prisma.shift.findMany({
          where: { isDeleted: null },
          orderBy: { createdAt: "desc" },
        });
      },

      async gpFindById(this: any, id: string) {
        const shift = await prisma.shift.findUnique({
          where: { id, isDeleted: null },
        });

        if (!shift) {
          return null;
        }

        const [assignments, timetables] = await Promise.all([
          prisma.shiftAssignment.findMany({
            where: { shiftId: id, isDeleted: null },
            orderBy: { startDate: "desc" },
          }),
          (prisma as any).shiftTimetable?.findMany
            ? (prisma as any).shiftTimetable.findMany({
                where: { shiftId: id, isDeleted: null },
                orderBy: { dayOfWeek: "asc" },
              })
            : Promise.resolve([]),
        ]);

        return {
          ...shift,
          assignments,
          timetables,
        };
      },

      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.shift.findMany({
            where: { isDeleted: null },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          prisma.shift.count({ where: { isDeleted: null } }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.shift.findMany({
            where: { isDeleted: { not: null } },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          prisma.shift.count({ where: { isDeleted: { not: null } } }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpSearch(this: any, searchTerm: string | string[], page: number, pageSize: number) {
        const searchTerms = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        const searchConditions = searchTerms.map((term) => ({
          OR: [
            { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
          ],
        }));

        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.shift.findMany({
            where: {
              AND: [{ isDeleted: null }, { OR: searchConditions }],
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          prisma.shift.count({
            where: {
              AND: [{ isDeleted: null }, { OR: searchConditions }],
            },
          }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpCount(this: any) {
        return await prisma.shift.count({ where: { isDeleted: null } });
      },
    },

    shiftAssignment: {
      async getAssignedEmployeesByShiftId(this: any, shiftId: string) {
        return await prisma.shiftAssignment.findMany({
          where: {
            shiftId,
            isDeleted: null,
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            employee: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
          orderBy: [{ startDate: "desc" }],
        });
      },

      async softDeleteById(this: any, id: string) {
        await prisma.shiftAssignment.update({
          where: { id },
          data: { isDeleted: new Date(), updatedAt: new Date() },
        });
      },
    },
  },
});

export default shiftModel;
