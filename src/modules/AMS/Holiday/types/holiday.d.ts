export interface Holiday {
  id?: string;
  date: Date;
  reason?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: Date;
  createdBy?: string;
  updatedBy?: string;
  previousUpdates?: any;
}
