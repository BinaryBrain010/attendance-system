import { AllowanceHeads } from "../../Access/types/access";

export interface User {
  id?: string;
  username: string;
  password: string;
  employeeId?: string | null;
  // defaultCompanyId?: string;
  // readAccess?: AllowanceHeads;
  // writeAccess?: AllowanceHeads;
  createdAt?: Date | null | undefined;
  updatedAt?: Date | null | undefined;
  isDeleted?: Date | null | undefined;
}

export interface UserData {
  id?: string;
  username: string;
  password: string;
  defaultCompanyId?: string;
  employeeId?: string;
  userRole: string[];
  userGroup: string[];
  // companyUser: string[];
}

export interface UserRole {
  id?: string;
  userId: string;
  roleId: string;
  active: boolean;
  createdAt?: Date | null | undefined;
  updatedAt?: Date | null | undefined;
  isDeleted?: Date | null | undefined;
}
