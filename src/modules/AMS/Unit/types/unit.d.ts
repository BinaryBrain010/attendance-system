import { UnitType } from "@prisma/client";

export interface Unit {
  id?: string;
  name: string;
  type: UnitType;
  description?: string;
  address?: string;
  contactNo?: string;
  email?: string;
  attendanceManagerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: Date;
  createdBy?: string;
  updatedBy?: string;
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
