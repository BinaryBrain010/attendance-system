import { LeaveAllocation, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";

const leaveAllocModel = prisma.$extends({
  model: {
    leaveAllocation: {
      async gpCreate(this: any, createdData: any) {
        if (!Array.isArray(createdData)) {
          createdData = [createdData];
        }

        const createdItems = [];

        for (const data of createdData) {
          // Ensure usedDays and remainingDays are initialized
          const usedDays = data.usedDays || 0;
          const assignedDays = data.assignedDays || 0;
          const remainingDays = data.remainingDays !== undefined 
            ? data.remainingDays 
            : assignedDays - usedDays;

          let newData = {
            ...data,
            usedDays,
            remainingDays: remainingDays > 0 ? remainingDays : 0,
            createdAt: new Date(),
          };

          const createdItem = await prisma.leaveAllocation.create({
            data: newData,
          });

          createdItems.push(createdItem);
        }

        return createdItems.length === 1 ? createdItems[0] : createdItems;
      },

      async gpFindByEmployeeId(this: any, id: string) {
        const data = await prisma.leaveAllocation.findMany({
          where: {
            employeeId: id,
            isDeleted: null,
          },
          select: {
            id: true,
            allocationEndDate: true,
            allocationStartDate: true,
            note: true,
            assignedDays: true,
            usedDays: true,
            remainingDays: true,
            leaveConfig: {
              select: {
                id: true,
                name: true,
                description: true,
                maxDays: true,
              },
            },
          },
        });

        return data;
      },
      // Method to get leave allocations by employee ID
      async gpFindManyByEmployeeId(
        employeeId: string
      ): Promise<LeaveAllocation[]> {
        const allocations = await prisma.leaveAllocation.findMany({
          where: {
            employeeId,
            isDeleted: null,
          },
          include: {
            leaveConfig: true,
          },
        });

        // Calculate usedDays and remainingDays for each allocation
        return await Promise.all(
          allocations.map(async (alloc) => {
            const usedDays = await this.calculateUsedDays(alloc.id);
            const remainingDays = alloc.assignedDays - usedDays;
            
            return {
              ...alloc,
              usedDays,
              remainingDays: remainingDays > 0 ? remainingDays : 0,
            };
          })
        );
      },

      // Calculate used days from approved leave requests
      async calculateUsedDays(leaveAllocationId: string): Promise<number> {
        const approvedRequests = await prisma.leaveRequest.findMany({
          where: {
            leaveAllocationId,
            status: 'APPROVED',
            isDeleted: null,
          },
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

      // Assign leave configuration to all employees
      async assignToAllEmployees(
        leaveConfigId: string,
        assignedDays: number,
        allocationStartDate: Date,
        allocationEndDate?: Date,
        note?: string
      ): Promise<LeaveAllocation[]> {
        // Get all active employees
        const employees = await prisma.employee.findMany({
          where: {
            isDeleted: null,
            status: { notIn: ['RESIGNED', 'FIRE'] },
          },
          select: { id: true },
        });

        const allocations: LeaveAllocation[] = [];

        for (const employee of employees) {
          // Check if allocation already exists for this employee and leave config
          const existing = await prisma.leaveAllocation.findFirst({
            where: {
              employeeId: employee.id,
              leaveConfigId,
              isDeleted: null,
            },
          });

          if (!existing) {
            const allocation = await prisma.leaveAllocation.create({
              data: {
                employeeId: employee.id,
                leaveConfigId,
                assignedDays,
                usedDays: 0,
                remainingDays: assignedDays,
                allocationStartDate,
                allocationEndDate,
                note: note || `Bulk assignment of ${assignedDays} days`,
                createdAt: new Date(),
              },
            });
            allocations.push(allocation);
          }
        }

        return allocations;
      },

      // Update used and remaining days for an allocation
      async updateLeaveBalance(leaveAllocationId: string): Promise<void> {
        const allocation = await prisma.leaveAllocation.findUnique({
          where: { id: leaveAllocationId },
        });

        if (!allocation) {
          throw new Error(`Leave allocation with ID ${leaveAllocationId} not found.`);
        }

        const usedDays = await this.calculateUsedDays(leaveAllocationId);
        const remainingDays = allocation.assignedDays - usedDays;

        await prisma.leaveAllocation.update({
          where: { id: leaveAllocationId },
          data: {
            usedDays,
            remainingDays: remainingDays > 0 ? remainingDays : 0,
            updatedAt: new Date(),
          },
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

        const allocations = await prisma.leaveAllocation.findMany({
          where,
          include: {
            leaveConfig: true,
          },
        });

        // Calculate usedDays and remainingDays for each allocation
        return await Promise.all(
          allocations.map(async (alloc) => {
            const usedDays = await this.calculateUsedDays(alloc.id);
            const remainingDays = alloc.assignedDays - usedDays;
            
            return {
              ...alloc,
              usedDays,
              remainingDays: remainingDays > 0 ? remainingDays : 0,
            };
          })
        );
      },

      async gpPgFindMany(this: any, page: number, pageSize: number, userId?: string) {
        const skip = (page - 1) * pageSize;
        
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
              return { data: [], totalSize: 0 };
            }
            where.employeeId = { in: accessibleEmployeeIds };
          }
        }

        const allocations = await prisma.leaveAllocation.findMany({
          where,
          take: pageSize,
          skip: skip,
          orderBy: { createdAt: 'desc' },
          include: {
            leaveConfig: true,
          },
        });

        // Calculate usedDays and remainingDays for each allocation
        const data = await Promise.all(
          allocations.map(async (alloc) => {
            const usedDays = await this.calculateUsedDays(alloc.id);
            const remainingDays = alloc.assignedDays - usedDays;
            
            return {
              ...alloc,
              usedDays,
              remainingDays: remainingDays > 0 ? remainingDays : 0,
            };
          })
        );

        const totalSize = await prisma.leaveAllocation.count({ where });

        return { data, totalSize };
      },
    },
  },
});

export default leaveAllocModel;
