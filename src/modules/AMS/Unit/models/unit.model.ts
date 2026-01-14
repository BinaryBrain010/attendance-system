import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { Unit } from "../types/unit";

// Admin user ID constant
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// Helper function to get username from userId
async function getUpdatedByName(updatedBy: string | null): Promise<string | null> {
  if (!updatedBy) {
    return null;
  }
  
  if (updatedBy === ADMIN_USER_ID) {
    return "Admin";
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { username: true },
    });
    
    return user?.username || null;
  } catch (error) {
    console.error(`Error fetching username for userId ${updatedBy}:`, error);
    return null;
  }
}

const unitModel = prisma.$extends({
  model: {
    unit: {
      async gpFindMany(this: any) {
        return await prisma.unit.findMany({
          where: { isDeleted: null },
          orderBy: { createdAt: 'desc' },
          include: {
            attendanceManager: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
        });
      },

      async gpFindById(this: any, id: string) {
        const unit = await prisma.unit.findUnique({
          where: { id, isDeleted: null },
          include: {
            attendanceManager: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
        }) as any;

        if (unit) {
          const updatedByName = await getUpdatedByName(unit.updatedBy || null);
          return {
            ...unit,
            updatedByName: updatedByName,
          };
        }

        return unit;
      },

      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.unit.findMany({
            where: { isDeleted: null },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
              attendanceManager: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  code: true,
                },
              },
            },
          }),
          prisma.unit.count({
            where: { isDeleted: null },
          }),
        ]);

        return {
          data,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.unit.findMany({
            where: { isDeleted: { not: null } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.unit.count({
            where: { isDeleted: { not: null } },
          }),
        ]);

        return {
          data,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpSearch(this: any, searchTerm: string | string[], page: number, pageSize: number) {
        const searchTerms = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        const searchConditions = searchTerms.map(term => ({
          OR: [
            { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { address: { contains: term, mode: Prisma.QueryMode.insensitive } },
          ],
        }));

        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.unit.findMany({
            where: {
              AND: [
                { isDeleted: null },
                { OR: searchConditions },
              ],
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
            include: {
              attendanceManager: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  code: true,
                },
              },
            },
          }),
          prisma.unit.count({
            where: {
              AND: [
                { isDeleted: null },
                { OR: searchConditions },
              ],
            },
          }),
        ]);

        return {
          data,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpCount(this: any): Promise<number> {
        return await prisma.unit.count({
          where: { isDeleted: null },
        });
      },

      async gpCreate(this: any, unitData: any) {
        const { createdByUserId, ...remainingData } = unitData;

        const data = await prisma.unit.create({
          data: {
            ...remainingData,
            createdBy: createdByUserId || null,
            createdAt: new Date(),
          },
          include: {
            attendanceManager: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
        });

        return data;
      },

      async gpUpdate(this: any, updateId: string, data: any) {
        const { updatedByUserId, ...remainingData } = data;

        // Get current state before update for audit trail
        const currentUnit = await prisma.unit.findUnique({
          where: { id: updateId },
        }) as any;

        if (!currentUnit) {
          throw new Error(`Unit with ID ${updateId} not found.`);
        }

        // Prepare previous update record
        const previousUpdate = {
          data: {
            name: currentUnit.name,
            type: currentUnit.type,
            description: currentUnit.description,
            address: currentUnit.address,
            contactNo: currentUnit.contactNo,
            email: currentUnit.email,
            attendanceManagerId: currentUnit.attendanceManagerId,
          },
          updatedBy: currentUnit.updatedBy || null,
          updatedAt: currentUnit.updatedAt || new Date(),
        };

        // Get existing previousUpdates array or initialize empty array
        const existingPreviousUpdates = (currentUnit.previousUpdates as any[]) || [];

        // Add current state to previousUpdates and keep only last 3
        const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

        // Update the unit
        const updatedUnit = await prisma.unit.update({
          where: { id: updateId },
          data: {
            ...remainingData,
            updatedAt: new Date(),
            updatedBy: updatedByUserId || null,
            previousUpdates: updatedPreviousUpdates,
          },
          include: {
            attendanceManager: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
        });

        return updatedUnit;
      },

      async gpSoftDelete(this: any, id: string) {
        const unit = await prisma.unit.findUnique({
          where: { id, isDeleted: null },
        });

        if (!unit) {
          throw new Error(`Unit with ID ${id} not found.`);
        }

        return await prisma.unit.update({
          where: { id },
          data: {
            isDeleted: new Date(),
          },
        });
      },

      async gpRestore(this: any, id: string) {
        const unit = await prisma.unit.findUnique({
          where: { id },
        });

        if (!unit) {
          throw new Error(`Unit with ID ${id} not found.`);
        }

        return await prisma.unit.update({
          where: { id },
          data: {
            isDeleted: null,
          },
        });
      },

      async getHistoryById(this: any, unitId: string, filter?: boolean, date?: string) {
        const unit = await prisma.unit.findUnique({
          where: { id: unitId },
        }) as any;

        if (!unit) {
          throw new Error(`Unit with ID ${unitId} not found.`);
        }

        const previousUpdates = (unit.previousUpdates as any[]) || [];

        // Add updatedByName to each update record
        const previousUpdatesWithNames = await Promise.all(
          previousUpdates.map(async (update: any) => {
            const updatedByName = await getUpdatedByName(update.updatedBy || null);
            return {
              ...update,
              updatedByName: updatedByName,
            };
          })
        );

        // If filter is not true, return complete previousUpdates array with names
        if (!filter) {
          return previousUpdatesWithNames;
        }

        // If filter is true and date is provided, return record for that specific date
        if (filter && date) {
          const targetDate = new Date(date);
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          const record = previousUpdatesWithNames.find((update: any) => {
            if (!update.updatedAt) return false;
            const updateDate = new Date(update.updatedAt);
            const updateDateStr = updateDate.toISOString().split('T')[0];
            return updateDateStr === targetDateStr;
          });

          return record || null;
        }

        // If filter is true but no date provided, return array of dates
        const dates = previousUpdatesWithNames
          .map((update: any) => update.updatedAt)
          .filter((date: any) => date !== null && date !== undefined);

        return dates;
      },
    },
  },
});

export default unitModel;
