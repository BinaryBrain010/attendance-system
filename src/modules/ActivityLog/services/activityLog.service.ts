import activityLogModel from "../models/activityLog.model";
import { ActivityLog, ActivityLogQuery } from "../types/activityLog";
import { paginatedData } from "../../../types/paginatedData";
import prisma from "../../../core/models/base.model";
import unitEmployeeModel from "../../AMS/Unit/models/unitEmployee.model";

class ActivityLogService {
  async getAllActivityLogs(query?: ActivityLogQuery): Promise<ActivityLog[]> {
    return await activityLogModel.activityLog.gpFindMany(query);
  }

  async getActivityLogs(query?: ActivityLogQuery): Promise<paginatedData> {
    return await activityLogModel.activityLog.gpPgFindMany(query);
  }

  async getActivityLogById(id: string): Promise<ActivityLog | null> {
    return await activityLogModel.activityLog.gpFindById(id);
  }

  async getActivityLogCount(query?: ActivityLogQuery): Promise<number> {
    return await activityLogModel.activityLog.gpCount(query);
  }

  async getActivityLogsByUser(userId: string, query?: Omit<ActivityLogQuery, 'userId'>): Promise<paginatedData> {
    return await activityLogModel.activityLog.gpPgFindMany({ ...query, userId });
  }

  async getActivityLogsByEntity(entityType: string, entityId: string, query?: Omit<ActivityLogQuery, 'entityType' | 'entityId'>): Promise<paginatedData> {
    return await activityLogModel.activityLog.gpPgFindMany({ ...query, entityType, entityId });
  }

  async getActivityLogsByUnit(unitId: string, query?: Omit<ActivityLogQuery, 'userId'>): Promise<paginatedData> {
    // Get all employees in the unit
    const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getEmployeesByUnitId(unitId);
    const employeeIds = unitEmployees.map((ue: any) => ue.employee?.id).filter((id: string) => id);

    if (employeeIds.length === 0) {
      return { data: [], totalSize: 0 };
    }

    // Get all user IDs linked to these employees
    const users = await prisma.user.findMany({
      where: {
        employeeId: { in: employeeIds },
        isDeleted: null,
      },
      select: {
        id: true,
      },
    });

    const userIds = users.map((user) => user.id);

    if (userIds.length === 0) {
      return { data: [], totalSize: 0 };
    }

    // Get activity logs for all these users
    // Since we need to filter by multiple user IDs, we'll need to modify the query
    // For now, we'll get logs for each user and combine them, or modify the model to support multiple userIds
    // Let's use a more efficient approach with a custom query
    const page = query?.page || 1;
    const pageSize = query?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    let whereClause = 'WHERE al."userId" IN (';
    whereClause += userIds.map((id, index) => `$${index + 1}`).join(', ');
    whereClause += ')';

    const params: any[] = [...userIds];
    let paramIndex = userIds.length + 1;

    if (query?.action) {
      whereClause += ` AND al.action = $${paramIndex}`;
      params.push(query.action);
      paramIndex++;
    }

    if (query?.entityType) {
      whereClause += ` AND al."entityType" = $${paramIndex}`;
      params.push(query.entityType);
      paramIndex++;
    }

    if (query?.entityId) {
      whereClause += ` AND al."entityId" = $${paramIndex}`;
      params.push(query.entityId);
      paramIndex++;
    }

    if (query?.from) {
      whereClause += ` AND al."createdAt" >= $${paramIndex}`;
      params.push(new Date(query.from));
      paramIndex++;
    }

    if (query?.to) {
      whereClause += ` AND al."createdAt" <= $${paramIndex}`;
      params.push(new Date(query.to));
      paramIndex++;
    }

    const data = await prisma.$queryRawUnsafe(`
      SELECT 
        al.*,
        u.username AS "userName"
      FROM "ActivityLog" al
      LEFT JOIN "User" u ON al."userId" = u.id
      ${whereClause}
      ORDER BY al."createdAt" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `, ...params, pageSize, skip) as any[];

    const totalSizeResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "ActivityLog" al
      ${whereClause}
    `, ...params) as any[];

    const totalSize = totalSizeResult[0]?.count || 0;

    // Resolve admin username
    const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
    const resolvedData = await Promise.all(
      data.map(async (item: any) => {
        if (!item.userName && item.userId) {
          if (item.userId === ADMIN_USER_ID) {
            item.userName = "Admin";
          } else {
            const user = await prisma.user.findUnique({
              where: { id: item.userId },
              select: { username: true },
            });
            item.userName = user?.username || null;
          }
        }
        return item;
      })
    );

    return { data: resolvedData, totalSize };
  }
}

export default ActivityLogService;
