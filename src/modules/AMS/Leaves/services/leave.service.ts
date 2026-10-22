import leaveConfigModel from "../models/leave.model";
import { LeaveConfiguration } from "../types/leave";
import { paginatedData } from "../../../../types/paginatedData";
import prisma from "../../../../core/models/base.model";

class LeaveService {
  // 5c: usage summary for one leave type (how many allocations/employees use it + day totals).
  async getLeaveConfigUsage(configId: string): Promise<{
    allocationsCount: number;
    employeesCount: number;
    totalAssigned: number;
    totalUsed: number;
    totalRemaining: number;
  }> {
    if (!configId) throw new Error("Leave configuration ID is required");
    const allocations = await prisma.leaveAllocation.findMany({
      where: { leaveConfigId: configId, isDeleted: null },
      select: { employeeId: true, assignedDays: true, usedDays: true, remainingDays: true },
    });
    const employeeIds = new Set(allocations.map((a) => a.employeeId).filter(Boolean));
    const totalAssigned = allocations.reduce((s, a) => s + (a.assignedDays || 0), 0);
    const totalUsed = allocations.reduce((s, a) => s + (a.usedDays || 0), 0);
    const totalRemaining = allocations.reduce(
      (s, a) => s + (a.remainingDays ?? ((a.assignedDays || 0) - (a.usedDays || 0))),
      0
    );
    return {
      allocationsCount: allocations.length,
      employeesCount: employeeIds.size,
      totalAssigned,
      totalUsed,
      totalRemaining,
    };
  }

  // Get all leave configurations
  async getAllLeaveConfigurations(): Promise<LeaveConfiguration[]> {
    return await leaveConfigModel.leaveConfiguration.gpFindMany();
  }

  // Paginated retrieval of leave configurations
  async getLeaveConfigurations(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await leaveConfigModel.leaveConfiguration.gpPgFindMany(page, pageSize);
  }

  // Create new leave configuration(s)
  async createLeaveConfiguration(
    leaveConfigData: LeaveConfiguration | LeaveConfiguration[]
  ): Promise<LeaveConfiguration | LeaveConfiguration[]> {
    return await leaveConfigModel.leaveConfiguration.gpCreate(leaveConfigData);
  }

  // Update an existing leave configuration
  async updateLeaveConfiguration(
    configId: string,
    leaveConfigData: LeaveConfiguration
  ): Promise<any> {
    return await leaveConfigModel.leaveConfiguration.gpUpdate(configId, leaveConfigData);
  }

  // Soft delete a leave configuration
  async deleteLeaveConfiguration(configId: string): Promise<void> {
    await leaveConfigModel.leaveConfiguration.gpSoftDelete(configId);
  }

  // Restore a deleted leave configuration
  async restoreLeaveConfiguration(configId: string): Promise<void> {
    await leaveConfigModel.leaveConfiguration.gpRestore(configId);
  }

  // Get a single leave configuration by its ID
  async getLeaveConfigurationById(
    configId: string
  ): Promise<LeaveConfiguration | null> {
    return await leaveConfigModel.leaveConfiguration.gpFindById(configId);
  }

  // Get soft-deleted leave configurations
  async getDeletedLeaveConfigurations(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await leaveConfigModel.leaveConfiguration.gpPgFindDeletedMany(page, pageSize);
  }

  // Search leave configurations by a term
  async searchLeaveConfigurations(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['name', 'description']; // Specify searchable fields
    return await leaveConfigModel.leaveConfiguration.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  // Get total count of leave configurations
  async getTotalLeaveConfigurations(): Promise<number> {
    return await leaveConfigModel.leaveConfiguration.gpCount();
  }
}

export default LeaveService;