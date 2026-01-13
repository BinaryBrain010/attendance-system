import leaveAllocModel from "../models/leaveAlloc.model";
import { LeaveAllocation } from "../types/leave";
import { paginatedData } from "../../../../types/paginatedData";

class LeaveAllocService {
  // Get all leave allocations
  async getAllLeaveAllocations(): Promise<LeaveAllocation[]> {
    return await leaveAllocModel.leaveAllocation.gpFindMany();
  }

  // Paginated retrieval of leave allocations
  async getLeaveAllocations(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await leaveAllocModel.leaveAllocation.gpPgFindMany(page, pageSize);
  }


  // Create new leave allocation(s)
  async createLeaveAllocation(
    leaveAllocData: LeaveAllocation | LeaveAllocation[]
  ): Promise<LeaveAllocation | LeaveAllocation[]> {
    return await leaveAllocModel.leaveAllocation.gpCreate(leaveAllocData);
  }

  // Update an existing leave allocation
  async updateLeaveAllocation(
    allocId: string,
    leaveAllocData: LeaveAllocation
  ): Promise<any> {
    return await leaveAllocModel.leaveAllocation.gpUpdate(allocId, leaveAllocData);
  }

  // Soft delete a leave allocation
  async deleteLeaveAllocation(allocId: string): Promise<void> {
    await leaveAllocModel.leaveAllocation.gpSoftDelete(allocId);
  }

  // Restore a deleted leave allocation
  async restoreLeaveAllocation(allocId: string): Promise<void> {
    await leaveAllocModel.leaveAllocation.gpRestore(allocId);
  }

  // Get a single leave allocation by its ID
  async getLeaveAllocationById(
    allocId: string
  ): Promise<LeaveAllocation | null> {
    return await leaveAllocModel.leaveAllocation.gpFindById(allocId);
  }

  async getLeaveAllocationByEmployeeId(
    employeeId: string
  ) {
    return await leaveAllocModel.leaveAllocation.gpFindByEmployeeId(employeeId);
  }

  // Get leave allocations by employee ID
  async getLeaveAllocationsByEmployeeId(
    employeeId: string
  ): Promise<any[]> {
    return await leaveAllocModel.leaveAllocation.gpFindManyByEmployeeId(employeeId) ;
  }

  // Get soft-deleted leave allocations
  async getDeletedLeaveAllocations(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await leaveAllocModel.leaveAllocation.gpPgFindDeletedMany(page, pageSize);
  }

  // Search leave allocations by a term
  async searchLeaveAllocations(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['note']; // Specify searchable fields
    return await leaveAllocModel.leaveAllocation.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  // Get total count of leave allocations
  async getTotalLeaveAllocations(): Promise<number> {
    return await leaveAllocModel.leaveAllocation.gpCount();
  }

  // Assign leave configuration to all employees
  async assignToAllEmployees(
    leaveConfigId: string,
    assignedDays: number,
    allocationStartDate: Date,
    allocationEndDate?: Date,
    note?: string
  ): Promise<any[]> {
    return await leaveAllocModel.leaveAllocation.assignToAllEmployees(
      leaveConfigId,
      assignedDays,
      allocationStartDate,
      allocationEndDate,
      note
    );
  }

  // Update leave balance for an allocation
  async updateLeaveBalance(leaveAllocationId: string): Promise<void> {
    await leaveAllocModel.leaveAllocation.updateLeaveBalance(leaveAllocationId);
  }
}

export default LeaveAllocService;
