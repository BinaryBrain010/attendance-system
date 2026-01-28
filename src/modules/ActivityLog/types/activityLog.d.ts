export interface ActivityLog {
  id?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export interface ActivityLogQuery {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date | string;
  to?: Date | string;
  page?: number;
  pageSize?: number;
}
