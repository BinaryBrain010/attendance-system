export enum LeaveStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
  }
  
  export interface LeaveRequest {
    id: string;
    employee: Employee; 
    employeeId: string;
    leaveAllocationId?: string;
    reason?: string;
    startDate: Date;
    endDate: Date;
    status: LeaveStatus;
    leaveType?: string; // "CASUAL", "MATERNITY", "SICK", etc.
    image?: string; 
    location?: string;
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted?: Date;
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
    leaveConfigId?: string;
    assignedDays: number;
    usedDays?: number;
    remainingDays?: number;
    note?: string; 
    allocationStartDate: Date;
    allocationEndDate?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted?: Date;
  }
  
  // Placeholder Employee interface (add fields as required)
  export interface Employee {
    id: string;
    name: string;
    // Add other fields as per your requirements
  }
  