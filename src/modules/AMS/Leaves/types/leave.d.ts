import { LeaveStatus } from "@prisma/client";

export { LeaveStatus };
  
  export interface LeaveRequest {
    id: string;
    employee?: Employee; 
    employeeId: string;
    leaveAllocationId?: string | null;
    reason?: string | null;
    startDate: Date;
    endDate: Date;
    status: LeaveStatus;
    leaveType?: string | null; // "CASUAL", "MATERNITY", "SICK", etc.
    image?: string | null; 
    location?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    isDeleted?: Date | null;
  }
  
  export interface LeaveConfiguration {
    id: string; 
    name: string; 
    description?: string; 
    maxDays: number; 
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted?: Date;
  }
  
  export interface LeaveAllocation {
    id: string; 
    employeeId: string;
    leaveConfigId?: string | null;
    assignedDays: number;
    allocatedDays?: number;
    usedDays?: number;
    remainingDays?: number;
    note?: string | null; 
    allocationStartDate: Date;
    allocationEndDate?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    isDeleted?: Date | null;
  }
  
  // Placeholder Employee interface (add fields as required)
  export interface Employee {
    id: string;
    name: string;
    // Add other fields as per your requirements
  }
  