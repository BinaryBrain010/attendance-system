/**
 * Explicit audit events for things that are not ordinary DB writes to a business model:
 * LOGIN / LOGOUT / LOGIN_FAILED (Auth), PERMISSION_CHANGE (RBAC grant edits), EXPORT (Excel/PDF),
 * IMPORT (bulk importers). Call logEvent(...) from the relevant controller/service; it reads the
 * request context for userId/ip/userAgent/platform/requestId automatically.
 */
import prisma from "../models/base.model";
import { auditEvent } from "./auditWriter";

export function logEvent(opts: {
  module?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  changes?: Record<string, any> | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  requestId?: string | null;
}): Promise<void> {
  return auditEvent(prisma, opts);
}

export default logEvent;
