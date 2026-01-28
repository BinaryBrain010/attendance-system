import prisma from "../../../core/models/base.model";
import { ActivityLog } from "../types/activityLog";

/**
 * Logs an activity/action performed by a user
 * @param logData - Activity log data
 * @returns Created activity log
 */
export async function logActivity(logData: ActivityLog): Promise<any> {
  try {
    const activityLog = await (prisma as any).activityLog.create({
      data: {
        userId: logData.userId || null,
        action: logData.action,
        entityType: logData.entityType,
        entityId: logData.entityId || null,
        description: logData.description || null,
        metadata: logData.metadata || null,
        ipAddress: logData.ipAddress || null,
        userAgent: logData.userAgent || null,
      },
    });
    console.log('Activity logged successfully:', { action: logData.action, entityType: logData.entityType, entityId: logData.entityId });
    return activityLog;
  } catch (error: any) {
    // Don't throw error - activity logging should not break the main flow
    console.error("Error logging activity:", error?.message || error);
    if (error?.message?.includes('ActivityLog') || error?.message?.includes('does not exist')) {
      console.error("⚠️ ActivityLog table may not exist. Please run: npx prisma migrate deploy && npx prisma generate");
    }
    return null;
  }
}

/**
 * Logs an activity from a request object
 * Extracts userId, ipAddress, and userAgent from the request
 */
export async function logActivityFromRequest(
  req: any,
  action: string,
  entityType: string,
  entityId?: string,
  description?: string,
  metadata?: any
): Promise<any> {
  const userId = (req as any).userId;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  return await logActivity({
    userId,
    action,
    entityType,
    entityId,
    description,
    metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Helper to create activity log metadata from before/after states
 */
export function createMetadataFromChanges(before?: any, after?: any, changes?: any): any {
  return {
    before: before || null,
    after: after || null,
    changes: changes || null,
    timestamp: new Date().toISOString(),
  };
}
