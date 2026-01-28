import { UnitType } from "@prisma/client";

export interface Unit {
  id?: string;
  name: string;
  type: UnitType;
  code?: string;
  description?: string | null;
  address?: string | null;
  contactNo?: string | null;
  email?: string | null;
  attendanceManagerId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  isDeleted?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  previousUpdates?: any;
}

export interface UnitEmployee {
  id?: string;
  unitId: string;
  employeeId: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: Date;
}
