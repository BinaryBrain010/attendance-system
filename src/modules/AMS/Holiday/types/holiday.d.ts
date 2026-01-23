export interface Holiday {
  id?: string;
  date: Date;
  name?: string;
  reason?: string | null;
  description?: string | null;
  isActive?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  isDeleted?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  previousUpdates?: any;
}
