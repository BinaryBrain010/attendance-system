import { LeaveRequest, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { LeaveStatus } from "@prisma/client";

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

          // If leaveType is provided and it's not CASUAL, try to find the leave allocation
          if (data.leaveType && data.leaveType !== 'CASUAL' && data.employeeId) {
            // Find the leave allocation for this employee and leave type
            const leaveConfig = await prisma.leaveConfiguration.findFirst({
              where: {
                name: { contains: data.leaveType, mode: Prisma.QueryMode.insensitive },
                isDeleted: null,
              },
            });

            if (leaveConfig) {
              const leaveAllocation = await prisma.leaveAllocation.findFirst({
                where: {
                  employeeId: data.employeeId,
                  leaveConfigId: leaveConfig.id,
                  isDeleted: null,
                },
              });

              if (leaveAllocation) {
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
          });

          createdItems.push(createdItem);
        }

        return createdItems.length === 1 ? createdItems[0] : createdItems;
      },

      async gpUpdateStatus(requestId: string, status: LeaveStatus): Promise<void> {
        const currentRequest = await prisma.leaveRequest.findUnique({
          where: { id: requestId },
        }) as any;

        if (!currentRequest) {
          throw new Error(`Leave request with ID ${requestId} not found.`);
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
    },
  },
});

export default leaveReqModel;

