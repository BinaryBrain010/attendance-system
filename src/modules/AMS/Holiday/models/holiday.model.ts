import { Holiday, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { AttendanceStatus } from "@prisma/client";

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

const holidayModel = prisma.$extends({
  model: {
    holiday: {
      async gpFindMany(this: any) {
        return await prisma.holiday.findMany({
          where: { isDeleted: null },
          orderBy: { date: 'desc' },
        });
      },

      async gpFindById(this: any, id: string) {
        const holiday = await prisma.holiday.findUnique({
          where: { id, isDeleted: null },
        }) as any;

        if (holiday) {
          const updatedByName = await getUpdatedByName(holiday.updatedBy || null);
          return {
            ...holiday,
            updatedByName: updatedByName,
          };
        }

        return holiday;
      },

      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.holiday.findMany({
            where: { isDeleted: null },
            orderBy: { date: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.holiday.count({
            where: { isDeleted: null },
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

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.holiday.findMany({
            where: { isDeleted: { not: null } },
            orderBy: { date: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.holiday.count({
            where: { isDeleted: { not: null } },
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

      async gpSearch(this: any, searchTerm: string | string[], page: number, pageSize: number) {
        const searchTerms = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        const searchConditions = searchTerms.map(term => ({
          OR: [
            { reason: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
          ],
        }));

        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.holiday.findMany({
            where: {
              AND: [
                { isDeleted: null },
                { OR: searchConditions },
              ],
            },
            orderBy: { date: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.holiday.count({
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
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpCount(this: any): Promise<number> {
        return await prisma.holiday.count({
          where: { isDeleted: null },
        });
      },

      async gpCreate(this: any, holidayData: any) {
        const { createdByUserId, ...remainingData } = holidayData;
        
        // Normalize date to start of day
        const holidayDate = new Date(remainingData.date);
        holidayDate.setHours(0, 0, 0, 0);

        const data = await prisma.holiday.create({
          data: {
            ...remainingData,
            date: holidayDate,
            createdBy: createdByUserId || null,
            createdAt: new Date(),
          },
        });

        // Mark all employees' attendance as HOLIDAYS for this date
        await this.markHolidayAttendance(holidayDate);

        return data;
      },

      async gpUpdate(this: any, updateId: string, data: any) {
        const { updatedByUserId, ...remainingData } = data;

        // Get current state before update for audit trail
        const currentHoliday = await prisma.holiday.findUnique({
          where: { id: updateId },
        }) as any;

        if (!currentHoliday) {
          throw new Error(`Holiday with ID ${updateId} not found.`);
        }

        // Prepare previous update record
        const previousUpdate = {
          data: {
            date: currentHoliday.date,
            reason: currentHoliday.reason,
            description: currentHoliday.description,
            isActive: currentHoliday.isActive,
          },
          updatedBy: currentHoliday.updatedBy || null,
          updatedAt: currentHoliday.updatedAt || new Date(),
        };

        // Get existing previousUpdates array or initialize empty array
        const existingPreviousUpdates = (currentHoliday.previousUpdates as any[]) || [];

        // Add current state to previousUpdates and keep only last 3
        const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

        // Normalize date if provided
        let updateData: any = {
          ...remainingData,
          updatedAt: new Date(),
          updatedBy: updatedByUserId || null,
          previousUpdates: updatedPreviousUpdates,
        };

        if (remainingData.date) {
          const holidayDate = new Date(remainingData.date);
          holidayDate.setHours(0, 0, 0, 0);
          updateData.date = holidayDate;
        }

        // Update the holiday
        const updatedHoliday = await prisma.holiday.update({
          where: { id: updateId },
          data: updateData as any,
        });

        // If date changed or isActive changed, update attendance records
        if (remainingData.date || remainingData.isActive !== undefined) {
          const oldDate = new Date(currentHoliday.date);
          oldDate.setHours(0, 0, 0, 0);
          
          // Remove holiday from old date if date changed
          if (remainingData.date && oldDate.getTime() !== updateData.date.getTime()) {
            await this.unmarkHolidayAttendance(oldDate);
          }

          // Mark holiday on new date if active
          if (updateData.isActive !== false) {
            const newDate = remainingData.date ? updateData.date : oldDate;
            await this.markHolidayAttendance(newDate);
          } else {
            // If deactivated, remove holiday attendance
            const holidayDate = remainingData.date ? updateData.date : oldDate;
            await this.unmarkHolidayAttendance(holidayDate);
          }
        }

        return updatedHoliday;
      },

      async gpSoftDelete(this: any, id: string) {
        const holiday = await prisma.holiday.findUnique({
          where: { id, isDeleted: null },
        });

        if (!holiday) {
          throw new Error(`Holiday with ID ${id} not found.`);
        }

        // Unmark holiday attendance before soft delete
        const holidayDate = new Date(holiday.date);
        holidayDate.setHours(0, 0, 0, 0);
        await this.unmarkHolidayAttendance(holidayDate);

        return await prisma.holiday.update({
          where: { id },
          data: {
            isDeleted: new Date(),
            isActive: false,
          },
        });
      },

      async gpRestore(this: any, id: string) {
        const holiday = await prisma.holiday.findUnique({
          where: { id },
        });

        if (!holiday) {
          throw new Error(`Holiday with ID ${id} not found.`);
        }

        const restored = await prisma.holiday.update({
          where: { id },
          data: {
            isDeleted: null,
            isActive: true,
          },
        });

        // Mark holiday attendance if active
        if (restored.isActive) {
          const holidayDate = new Date(restored.date);
          holidayDate.setHours(0, 0, 0, 0);
          await this.markHolidayAttendance(holidayDate);
        }

        return restored;
      },

      async markHolidayAttendance(this: any, date: Date) {
        // Get all active employees
        const employees = await prisma.employee.findMany({
          where: {
            isDeleted: null,
            status: { notIn: ['RESIGNED', 'FIRE'] },
          },
          select: { id: true },
        });

        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        // Mark attendance as HOLIDAYS for all employees on this date
        for (const employee of employees) {
          // Check if attendance already exists
          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              employeeId: employee.id,
              date: {
                gte: dateStart,
                lte: dateEnd,
              },
              isDeleted: null,
            },
          });

          if (existingAttendance) {
            // Update existing attendance to HOLIDAYS
            await prisma.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                status: AttendanceStatus.HOLIDAYS,
                updatedAt: new Date(),
              },
            });
          } else {
            // Create new attendance record as HOLIDAYS
            await prisma.attendance.create({
              data: {
                employeeId: employee.id,
                date: dateStart,
                status: AttendanceStatus.HOLIDAYS,
                createdAt: new Date(),
              },
            });
          }
        }
      },

      async unmarkHolidayAttendance(this: any, date: Date) {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        // Find all HOLIDAYS attendance records for this date
        const holidayAttendances = await prisma.attendance.findMany({
          where: {
            date: {
              gte: dateStart,
              lte: dateEnd,
            },
            status: AttendanceStatus.HOLIDAYS,
            isDeleted: null,
          },
        });

        // Delete these attendance records (soft delete)
        for (const attendance of holidayAttendances) {
          await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              isDeleted: new Date(),
            },
          });
        }
      },

      async markSundaysForYear(this: any, year: number, createdByUserId?: string) {
        const holidays: any[] = [];
        const startDate = new Date(year, 0, 1); // January 1
        const endDate = new Date(year, 11, 31); // December 31

        // Find all Sundays in the year
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          if (currentDate.getDay() === 0) { // Sunday
            const sundayDate = new Date(currentDate);
            sundayDate.setHours(0, 0, 0, 0);

            // Check if holiday already exists for this date
            const existingHoliday = await prisma.holiday.findFirst({
              where: {
                date: {
                  gte: sundayDate,
                  lte: new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000 - 1),
                },
                isDeleted: null,
              },
            });

            if (!existingHoliday) {
              const holiday = await prisma.holiday.create({
                data: {
                  date: sundayDate,
                  reason: 'Sunday',
                  description: 'Weekly holiday - Sunday',
                  isActive: true,
                  createdBy: createdByUserId || null,
                  createdAt: new Date(),
                },
              });

              holidays.push(holiday);

              // Mark all employees' attendance as HOLIDAYS
              await this.markHolidayAttendance(sundayDate);
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        return holidays;
      },

      async getHistoryById(this: any, holidayId: string, filter?: boolean, date?: string) {
        const holiday = await prisma.holiday.findUnique({
          where: { id: holidayId },
        }) as any;

        if (!holiday) {
          throw new Error(`Holiday with ID ${holidayId} not found.`);
        }

        const previousUpdates = (holiday.previousUpdates as any[]) || [];

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

export default holidayModel;
