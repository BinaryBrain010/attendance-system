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
  /** When true, rows produced under impersonation (impersonatorId set) are excluded — used for a
   *  user's OWN activity log so they don't see what an admin did while logged in as them. */
  excludeImpersonated?: boolean;
}
