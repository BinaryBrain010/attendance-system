export interface Shift {
  id?: string;
  name: string;
  startTime: Date;
  endTime: Date;
  description?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  isDeleted?: Date | null;
}

export interface ShiftAssignmentPayload {
  employeeId: string;
  shiftId: string;
  startDate: Date;
  endDate?: Date | null;
}

export interface ShiftTimetablePayload {
  shiftId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
}

export type ShiftTimetableBlockType = "WORK" | "BREAK" | "CUSTOM";

export interface ShiftTimetableBlockPayload {
  id?: string;
  shiftId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  type?: ShiftTimetableBlockType;
  customType?: string | null;
  label?: string | null;
}
