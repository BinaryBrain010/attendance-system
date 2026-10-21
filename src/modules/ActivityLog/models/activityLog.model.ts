import prisma from "../../../core/models/base.model";
import { ActivityLog, ActivityLogQuery } from "../types/activityLog";

// Helper function to get username from userId
async function getUsernameFromUserId(userId: string | null): Promise<string | null> {
  if (!userId) {
    return null;
  }
  
  // Admin user ID constant
  const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
  
  if (userId === ADMIN_USER_ID) {
    return "Admin";
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    
    return user?.username || null;
  } catch (error) {
    console.error("Error fetching username:", error);
    return null;
  }
}

const activityLogModel = prisma.$extends({
  model: {
    activityLog: {
      async gpFindMany(this: any, query?: ActivityLogQuery): Promise<any[]> {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (query?.userId) {
          whereClause += ` AND al."userId" = $${paramIndex}`;
          params.push(query.userId);
          paramIndex++;
        }

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

        // A user's OWN activity log must not reveal actions performed while an admin was impersonating
        // them; those rows carry an impersonatorId. Admin surfaces (audit.read.*) leave this off.
        if (query?.excludeImpersonated) {
          whereClause += ` AND al."impersonatorId" IS NULL`;
        }

        // Blob-safe + bounded: exclude the large `metadata` JSON and hard-cap the rows (no unbounded
        // "all" path). metadata is fetched on demand via getById for the detail view.
        const data = await prisma.$queryRawUnsafe(`
          SELECT
            al.id, al."userId", al.action, al."entityType", al."entityId", al.description,
            al."ipAddress", al."impersonatorId", al."createdAt",
            u.username AS "userName"
          FROM "ActivityLog" al
          LEFT JOIN "User" u ON al."userId" = u.id
          ${whereClause}
          ORDER BY al."createdAt" DESC
          LIMIT 1000
        `, ...params) as any[];

        // Resolve admin username
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.userName && item.userId) {
              item.userName = await getUsernameFromUserId(item.userId);
            }
            return item;
          })
        );

        return resolvedData;
      },

      async gpPgFindMany(this: any, query?: ActivityLogQuery): Promise<any> {
        const page = query?.page || 1;
        const pageSize = query?.pageSize || 10;
        const skip = (page - 1) * pageSize;

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (query?.userId) {
          whereClause += ` AND al."userId" = $${paramIndex}`;
          params.push(query.userId);
          paramIndex++;
        }

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

        // A user's OWN activity log must not reveal actions performed while an admin was impersonating
        // them; those rows carry an impersonatorId. Admin surfaces (audit.read.*) leave this off.
        if (query?.excludeImpersonated) {
          whereClause += ` AND al."impersonatorId" IS NULL`;
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
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.userName && item.userId) {
              item.userName = await getUsernameFromUserId(item.userId);
            }
            return item;
          })
        );

        return { data: resolvedData, totalSize };
      },

      async gpFindById(this: any, id: string): Promise<any> {
        const data = await prisma.$queryRawUnsafe(`
          SELECT 
            al.*,
            u.username AS "userName"
          FROM "ActivityLog" al
          LEFT JOIN "User" u ON al."userId" = u.id
          WHERE al.id = $1
          LIMIT 1
        `, id) as any[];

        if (!data[0]) {
          return null;
        }

        const item = data[0];
        if (!item.userName && item.userId) {
          item.userName = await getUsernameFromUserId(item.userId);
        }

        return item;
      },

      async gpCount(this: any, query?: ActivityLogQuery): Promise<number> {
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (query?.userId) {
          whereClause += ` AND "userId" = $${paramIndex}`;
          params.push(query.userId);
          paramIndex++;
        }

        if (query?.action) {
          whereClause += ` AND action = $${paramIndex}`;
          params.push(query.action);
          paramIndex++;
        }

        if (query?.entityType) {
          whereClause += ` AND "entityType" = $${paramIndex}`;
          params.push(query.entityType);
          paramIndex++;
        }

        if (query?.entityId) {
          whereClause += ` AND "entityId" = $${paramIndex}`;
          params.push(query.entityId);
          paramIndex++;
        }

        if (query?.from) {
          whereClause += ` AND "createdAt" >= $${paramIndex}`;
          params.push(new Date(query.from));
          paramIndex++;
        }

        if (query?.to) {
          whereClause += ` AND "createdAt" <= $${paramIndex}`;
          params.push(new Date(query.to));
          paramIndex++;
        }

        if (query?.excludeImpersonated) {
          whereClause += ` AND "impersonatorId" IS NULL`;
        }

        const result = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS count
          FROM "ActivityLog"
          ${whereClause}
        `, ...params) as any[];

        return result[0]?.count || 0;
      },
    },
  },
});

export default activityLogModel;
