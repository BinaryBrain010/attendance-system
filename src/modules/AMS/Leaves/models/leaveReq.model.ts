import { LeaveRequest, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { LeaveStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "../../../../core/errors/app.error";
import { employeeCardSelect, leaveRequestListSelect } from "../../../../core/db/safeSelect";

// Pakistan timezone constant
const PAKISTAN_TIMEZONE = "Asia/Karachi";

// Helper function to get start of day in Pakistan timezone, then convert to UTC for database query
function getStartOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "yyyy"));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "MM")) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "dd"));
  const pakistanMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  pakistanMidnight.setUTCHours(pakistanMidnight.getUTCHours() - 5);
  return pakistanMidnight;
}

// Helper function to get end of day in Pakistan timezone, then convert to UTC for database query
function getEndOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "yyyy"));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "MM")) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, "dd"));
  const pakistanEndOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  pakistanEndOfDay.setUTCHours(pakistanEndOfDay.getUTCHours() - 5);
  return pakistanEndOfDay;
}

function calculateLeaveDays(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

const leaveReqModel = prisma.$extends({
  model: {
    leaveRequest: {
      async gpCreate(this: any, createdData: any) {
        if (!Array.isArray(createdData)) {
          createdData = [createdData];
        }

        const createdItems = [];

        for (const data of createdData) {
          let newData = {
            ...data,
            createdAt: new Date(),
          };

        if (!data.employeeId) {
          throw new Error("Employee ID is required for leave request.");
        }

        const requestStartDate = new Date(data.startDate);
        const requestEndDate = new Date(data.endDate);

        if (isNaN(requestStartDate.getTime()) || isNaN(requestEndDate.getTime())) {
          throw new Error("Invalid start or end date for leave request.");
        }

        if (requestEndDate < requestStartDate) {
          throw new Error("Leave end date cannot be before start date.");
        }

        // Prevent overlapping pending/approved requests for the same employee
        const overlap = await prisma.leaveRequest.findFirst({
          where: {
            employeeId: data.employeeId,
            isDeleted: null,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            startDate: { lte: requestEndDate },
            endDate: { gte: requestStartDate },
          },
          select: { id: true, status: true, startDate: true, endDate: true },
        });

        if (overlap) {
          // Business rule, not a crash: 409 so the client sees a clean conflict and the error log
          // records it at warn level (no stack). The attendance "mark as leave" path avoids this
          // throw entirely by going through gpEnsureForDate (links to the existing request).
          throw new AppError(409, "A leave request already exists for the selected dates.");
        }

          // If leaveType is provided and it's not CASUAL, try to find the leave allocation
          if (data.leaveType && data.leaveType !== 'CASUAL' && data.employeeId) {
            // Find the leave allocation for this employee and leave type
            const leaveConfig = await prisma.leaveConfiguration.findFirst({
              where: {
                name: { contains: data.leaveType, mode: Prisma.QueryMode.insensitive },
                isDeleted: null,
              },
            });

          if (!leaveConfig) {
            throw new Error("Selected leave type is not configured.");
          }

            if (leaveConfig) {
              const leaveAllocation = await prisma.leaveAllocation.findFirst({
                where: {
                  employeeId: data.employeeId,
                  leaveConfigId: leaveConfig.id,
                  isDeleted: null,
                },
              });

              if (leaveAllocation) {
              const leaveDays = calculateLeaveDays(requestStartDate, requestEndDate);
              const remainingDays = leaveAllocation.remainingDays ?? (leaveAllocation.assignedDays - (leaveAllocation.usedDays || 0));
              if (remainingDays < leaveDays) {
                throw new Error(`Insufficient leave balance. Available: ${remainingDays} days, Requested: ${leaveDays} days.`);
              }
                newData.leaveAllocationId = leaveAllocation.id;
              }
            }
          }

          // If leaveAllocationId is not set, it's a casual leave (no link needed)
          if (!newData.leaveAllocationId) {
            newData.leaveType = newData.leaveType || 'CASUAL';
          }

          const createdItem = await prisma.leaveRequest.create({
            data: newData,
            include: {
              employee: true,
            },
          });

          createdItems.push(createdItem);
        }

        return createdItems.length === 1 ? createdItems[0] : createdItems;
      },

      // Find an overlapping ACTIVE (PENDING/APPROVED) leave for an employee on a date range (or null).
      // Only these statuses count: a REJECTED leave must NOT be linked to when marking attendance —
      // gpEnsureForDate then creates a fresh request instead (LeaveStatus has no CANCELLED).
      async gpFindOverlap(this: any, employeeId: string, startDate: Date, endDate: Date) {
        if (!employeeId) return null;
        return prisma.leaveRequest.findFirst({
          where: {
            employeeId,
            isDeleted: null,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { id: true, status: true, startDate: true, endDate: true },
        });
      },

      // Idempotent create for the "mark attendance as leave" path: if an overlapping request
      // already exists, LINK to it (return it) instead of creating a duplicate — which would throw
      // the "already exists" business rule and spam the error log. Genuine failures still surface.
      async gpEnsureForDate(this: any, data: any) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const existing = await leaveReqModel.leaveRequest.gpFindOverlap(data.employeeId, start, end);
        if (existing) return existing;
        return leaveReqModel.leaveRequest.gpCreate(data);
      },

      async gpUpdateStatus(requestId: string, status: LeaveStatus, userId?: string): Promise<void> {
        const currentRequest = await prisma.leaveRequest.findUnique({
          where: { id: requestId },
        }) as any;

        if (!currentRequest) {
          throw new Error(`Leave request with ID ${requestId} not found.`);
        }

        // HOTFIX unit scoping: a reviewer may only approve/reject leave for employees in their
        // accessible units (ams.viewAll.unit bypasses).
        if (userId && currentRequest.employeeId) {
          const { canAccessEmployee } = await import("../../Unit/helper/unitAccess.helper");
          const ok = await canAccessEmployee(userId, currentRequest.employeeId);
          if (!ok) throw new AppError(403, "This request is outside your units");
        }

        // Only a PENDING leave request can be approved or rejected (no double-apply).
        if (
          currentRequest.status !== LeaveStatus.PENDING &&
          (status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED)
        ) {
          throw new AppError(409, `Leave request is already ${String(currentRequest.status).toLowerCase()} and cannot be ${status === LeaveStatus.APPROVED ? "approved" : "rejected"} again.`);
        }

        // Calculate the number of days for the leave
        const startDate = new Date(currentRequest.startDate);
        const endDate = new Date(currentRequest.endDate);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Update the leave request status
        const leaveRequest = await prisma.leaveRequest.update({
          where: { id: requestId },
          data: { status },
        });

        // If approved and has leaveAllocationId (configured leave), update the allocation
        if (status === LeaveStatus.APPROVED && currentRequest.leaveAllocationId) {
          const allocation = await prisma.leaveAllocation.findUnique({
            where: { id: currentRequest.leaveAllocationId },
          }) as any;

          if (allocation) {
            // Calculate used days excluding current request
            const usedDays = await this.calculateUsedDaysForAllocation(currentRequest.leaveAllocationId, requestId);
            const remainingDays = allocation.assignedDays - usedDays;

            // Check if enough remaining days are available (including current request)
            if (remainingDays < leaveDays) {
              throw new Error(`Insufficient leave balance. Available: ${remainingDays} days, Requested: ${leaveDays} days`);
            }

            // Update the leave allocation balance (include current request in used days)
            const newUsedDays = usedDays + leaveDays;
            await prisma.leaveAllocation.update({
              where: { id: currentRequest.leaveAllocationId },
              data: {
                usedDays: newUsedDays,
                remainingDays: allocation.assignedDays - newUsedDays,
                updatedAt: new Date(),
              } as any,
            });
          }
        }

        // If rejected and was previously approved, restore the leave balance
        if (status === LeaveStatus.REJECTED && currentRequest.status === LeaveStatus.APPROVED && currentRequest.leaveAllocationId) {
          const allocation = await prisma.leaveAllocation.findUnique({
            where: { id: currentRequest.leaveAllocationId },
          }) as any;

          if (allocation) {
            const usedDays = await this.calculateUsedDaysForAllocation(currentRequest.leaveAllocationId, requestId);
            await prisma.leaveAllocation.update({
              where: { id: currentRequest.leaveAllocationId },
              data: {
                usedDays: usedDays,
                remainingDays: allocation.assignedDays - usedDays,
                updatedAt: new Date(),
              } as any,
            });
          }
        }

        // Sync attendance on approval
        if (status === LeaveStatus.APPROVED) {
          const startDate = new Date(currentRequest.startDate);
          const endDate = new Date(currentRequest.endDate);
          const normalizedStart = getStartOfDayPakistan(startDate);
          const normalizedEnd = getStartOfDayPakistan(endDate);

          for (let date = new Date(normalizedStart); date <= normalizedEnd; date = addDays(date, 1)) {
            const dayStart = getStartOfDayPakistan(date);
            const dayEnd = getEndOfDayPakistan(date);
            const existingAttendance = await prisma.attendance.findFirst({
              where: {
                employeeId: currentRequest.employeeId,
                date: { gte: dayStart, lte: dayEnd },
                isDeleted: null,
              },
            }) as any;

            if (existingAttendance) {
              if (existingAttendance.status === "ON_LEAVE") {
                continue;
              }

              const previousUpdate = {
                data: {
                  status: existingAttendance.status,
                  checkIn: existingAttendance.checkIn,
                  checkOut: existingAttendance.checkOut,
                  comment: existingAttendance.comment,
                  location: existingAttendance.location,
                  date: existingAttendance.date,
                },
                updatedBy: existingAttendance.updatedBy || null,
                updatedAt: existingAttendance.updatedAt || new Date(),
              };

              const existingPreviousUpdates = (existingAttendance.previousUpdates as any[]) || [];
              const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

              await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: "ON_LEAVE",
                  checkIn: null,
                  checkOut: null,
                  comment: currentRequest.reason || existingAttendance.comment || "",
                  updatedAt: new Date(),
                  previousUpdates: updatedPreviousUpdates,
                } as any,
              });
            } else {
              await prisma.attendance.create({
                data: {
                  employeeId: currentRequest.employeeId,
                  date: dayStart,
                  status: "ON_LEAVE",
                  checkIn: null,
                  checkOut: null,
                  comment: currentRequest.reason || "",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  previousUpdates: [],
                } as any,
              });
            }
          }
        }
      },

      // Calculate used days for an allocation (excluding current request if provided)
      async calculateUsedDaysForAllocation(leaveAllocationId: string, excludeRequestId?: string): Promise<number> {
        const where: any = {
          leaveAllocationId,
          status: 'APPROVED',
          isDeleted: null,
        };

        if (excludeRequestId) {
          where.id = { not: excludeRequestId };
        }

        const approvedRequests = await prisma.leaveRequest.findMany({
          where,
          select: {
            startDate: true,
            endDate: true,
          },
        });

        let totalUsedDays = 0;
        approvedRequests.forEach((request) => {
          const start = new Date(request.startDate);
          const end = new Date(request.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          totalUsedDays += diffDays;
        });

        return totalUsedDays;
      },

      async gpFindManyByEmployeeId(
        employeeId: string
      ): Promise<LeaveRequest[]> {
        return await prisma.leaveRequest.findMany({
          where: { employeeId, isDeleted: null },
          include: {
            leaveAllocation: {
              include: {
                leaveConfig: true,
              },
            },
          } as any,
        });
      },

      async gpFindMany(this: any, userId?: string) {
        const where: any = {
          isDeleted: null,
        };

        // Apply unit-based access control if userId is provided
        if (userId) {
          const { getAccessibleEmployeeIds } = await import('../../Unit/helper/unitAccess.helper');
          const accessibleEmployeeIds = await getAccessibleEmployeeIds(userId, 'employee');
          
          // If null, user has supervisor permission (access all)
          // If empty array, user has no access
          // If array with IDs, filter by those IDs
          if (accessibleEmployeeIds !== null) {
            if (accessibleEmployeeIds.length === 0) {
              return [];
            }
            where.employeeId = { in: accessibleEmployeeIds };
          }
        }

        return await prisma.leaveRequest.findMany({
          where,
          // Blob-safe: exclude leaveRequest.image + employee.image/faceDescriptor/previousUpdates so a
          // single base64 attachment/photo can't overflow the list payload (napi string crash).
          select: {
            ...leaveRequestListSelect,
            employee: { select: employeeCardSelect },
            leaveAllocation: { include: { leaveConfig: true } },
          } as any,
        });
      },

      async gpPgFindMany(
        this: any,
        page: number,
        pageSize: number,
        userId?: string,
        filters?: { status?: string; from?: string; to?: string; employeeId?: string }
      ) {
        const skip = (page - 1) * pageSize;

        const where: any = {
          isDeleted: null,
        };

        // Server-side filters (status, leave-start-date range, employee). Everything the list page can
        // filter by is applied here in SQL — the client never downloads unfiltered rows to narrow them.
        if (filters?.status) where.status = filters.status as LeaveStatus;
        if (filters?.employeeId) where.employeeId = filters.employeeId;
        if (filters?.from || filters?.to) {
          where.startDate = {};
          if (filters.from) where.startDate.gte = getStartOfDayPakistan(new Date(filters.from));
          if (filters.to) where.startDate.lte = getEndOfDayPakistan(new Date(filters.to));
        }

        // Apply unit-based access control if userId is provided
        if (userId) {
          const { getAccessibleEmployeeIds } = await import('../../Unit/helper/unitAccess.helper');
          const accessibleEmployeeIds = await getAccessibleEmployeeIds(userId, 'employee');

          // If null, user has supervisor permission (access all)
          // If empty array, user has no access
          // If array with IDs, filter by those IDs
          if (accessibleEmployeeIds !== null) {
            if (accessibleEmployeeIds.length === 0) {
              return { data: [], totalSize: 0 };
            }
            // Intersect unit-access with any explicit employeeId filter.
            if (where.employeeId && typeof where.employeeId === 'string') {
              where.employeeId = accessibleEmployeeIds.includes(where.employeeId)
                ? where.employeeId
                : '__none__';
            } else {
              where.employeeId = { in: accessibleEmployeeIds };
            }
          }
        }

        const [data, totalSize] = await Promise.all([
          prisma.leaveRequest.findMany({
            where,
            take: pageSize,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            select: {
              ...leaveRequestListSelect,
              employee: { select: employeeCardSelect },
              leaveAllocation: { include: { leaveConfig: true } },
            } as any,
          }),
          prisma.leaveRequest.count({ where }),
        ]);

        return { data, totalSize };
      },
    },
  },
});

export default leaveReqModel;

