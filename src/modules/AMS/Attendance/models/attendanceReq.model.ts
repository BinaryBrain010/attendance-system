
import { AttendanceStatus, LeaveStatus, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { AttendanceRequest } from "../types/AttendanceRequest";
import attendanceModel from "./attendance.model";
import { AppError } from "../../../../core/errors/app.error";

// Helper function to get username from userId
async function getUpdatedByName(updatedBy: string | null): Promise<string | null> {
  if (!updatedBy) {
    return null;
  }

  // Admin user ID constant
  const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

  if (updatedBy === ADMIN_USER_ID) {
    return "Admin";
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { username: true },
    });

    return user?.username || null;
  } catch (error) {
    console.error("Error fetching username:", error);
    return null;
  }
}

// Build the shared WHERE clause for attendance-request list/stats from optional server-side filters
// (status, employeeId, created-date range). Always excludes soft-deleted rows. Values are bound
// parameters (Prisma.sql), so this is injection-safe.
function buildArFilter(f: any, scope?: string[] | null): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`ar."isDeleted" IS NULL`];
  if (f?.status) conds.push(Prisma.sql`ar.status::text = ${String(f.status)}`);
  if (f?.employeeId) conds.push(Prisma.sql`ar."employeeId" = ${String(f.employeeId)}`);
  if (f?.from) conds.push(Prisma.sql`ar."createdAt" >= ${new Date(f.from)}`);
  if (f?.to) conds.push(Prisma.sql`ar."createdAt" <= ${new Date(f.to)}`);
  // HOTFIX unit scoping: when scope is a (possibly empty) array, restrict to those employees;
  // null = see all (ams.viewAll.unit or no userId). Empty array -> matches nothing.
  if (scope != null) {
    const ids = scope.length > 0 ? scope : ["__none__"];
    conds.push(Prisma.sql`ar."employeeId" IN (${Prisma.join(ids)})`);
  }
  return Prisma.join(conds, " AND ");
}


const attendanceRequestModel = prisma.$extends({
  model: {
    attendanceRequest: {

      async gpFindMany(this: any): Promise<any[]> {
        const data = await prisma.$queryRaw`
          SELECT
            ar.id, ar."employeeId", ar."attendanceId", ar.reason, ar.status, ar.location,
            ar."proposedStatus", ar."proposedCheckIn", ar."proposedCheckOut", ar."proposedComment",
            ar."proposedLocation", ar."proposedDate", ar."requestedBy", ar."approvedBy",
            ar."createdAt", ar."updatedAt", ar."isDeleted", ar."createdById", ar."updatedById", ar."deletedById",
            (ar.image IS NOT NULL) AS "hasImage",
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ar."isDeleted" IS NULL
          ORDER BY ar."createdAt" DESC
          LIMIT 100000
        ` as any[];

        // Never silently truncate: prod has ~11k requests. The 100k ceiling (image excluded, hasImage
        // flag only, so the payload is bounded by row count) comfortably covers it; warn if ever hit.
        if (data.length >= 100000) {
          console.warn(`[list-cap] attendanceRequest.gpFindMany: hit 100000-row ceiling — result TRUNCATED; paginate/stream this export.`);
        }

        // Resolve usernames for admin user
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.requestedByName && item.requestedBy) {
              item.requestedByName = await getUpdatedByName(item.requestedBy);
            }
            if (!item.approvedByName && item.approvedBy) {
              item.approvedByName = await getUpdatedByName(item.approvedBy);
            }
            return item;
          })
        );

        return resolvedData;
      },

      async gpFindById(this: any, id: string): Promise<any> {
        const data = await prisma.$queryRaw`
          SELECT
            ar.id, ar."employeeId", ar."attendanceId", ar.reason, ar.status, ar.location,
            ar."proposedStatus", ar."proposedCheckIn", ar."proposedCheckOut", ar."proposedComment",
            ar."proposedLocation", ar."proposedDate", ar."requestedBy", ar."approvedBy",
            ar."createdAt", ar."updatedAt", ar."isDeleted", ar."createdById", ar."updatedById", ar."deletedById",
            ar.image,
            (ar.image IS NOT NULL) AS "hasImage",
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ar.id = ${id} 
            AND ar."isDeleted" IS NULL
          LIMIT 1
        ` as any[];

        if (!data[0]) {
          return null;
        }

        const item = data[0];
        // Resolve usernames for admin user
        if (!item.requestedByName && item.requestedBy) {
          item.requestedByName = await getUpdatedByName(item.requestedBy);
        }
        if (!item.approvedByName && item.approvedBy) {
          item.approvedByName = await getUpdatedByName(item.approvedBy);
        }

        return item;
      },

      async gpPgFindMany(this: any, page: number, pageSize: number, filters?: any, scope?: string[] | null): Promise<any> {
        const size = Math.min(Math.max(1, Number(pageSize) || 10), 100); // hard max take 100
        const skip = (Math.max(1, Number(page) || 1) - 1) * size;
        const where = buildArFilter(filters, scope);

        const data = await prisma.$queryRaw(Prisma.sql`
          SELECT
            ar.id, ar."employeeId", ar."attendanceId", ar.reason, ar.status, ar.location,
            ar."proposedStatus", ar."proposedCheckIn", ar."proposedCheckOut", ar."proposedComment",
            ar."proposedLocation", ar."proposedDate", ar."requestedBy", ar."approvedBy",
            ar."createdAt", ar."updatedAt", ar."isDeleted", ar."createdById", ar."updatedById", ar."deletedById",
            (ar.image IS NOT NULL) AS "hasImage",
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ${where}
          ORDER BY ar."createdAt" DESC
          LIMIT ${size}
          OFFSET ${skip}
        `) as any[];

        const totalSizeResult = await prisma.$queryRaw(Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ${where}
        `) as any[];

        const totalSize = totalSizeResult[0]?.count || 0;

        // Resolve usernames for admin user
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.requestedByName && item.requestedBy) {
              item.requestedByName = await getUpdatedByName(item.requestedBy);
            }
            if (!item.approvedByName && item.approvedBy) {
              item.approvedByName = await getUpdatedByName(item.approvedBy);
            }
            return item;
          })
        );

        return { data: resolvedData, totalSize };
      },

      // Server-side aggregate stats (status counts + current-year monthly distribution) computed by
      // SQL GROUP BY — replaces the old pattern of downloading every row to the client to count them.
      async gpStats(this: any, filters?: any, scope?: string[] | null): Promise<any> {
        const where = buildArFilter(filters, scope);
        const statusRows = await prisma.$queryRaw(Prisma.sql`
          SELECT ar.status::text AS status, COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ${where}
          GROUP BY ar.status
        `) as Array<{ status: string; count: number }>;
        const byStatus: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
        let total = 0;
        for (const r of statusRows) { byStatus[r.status] = r.count; total += r.count; }

        const monthRows = await prisma.$queryRaw(Prisma.sql`
          SELECT EXTRACT(MONTH FROM ar."createdAt")::int AS month, COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ${where} AND EXTRACT(YEAR FROM ar."createdAt") = EXTRACT(YEAR FROM NOW())
          GROUP BY 1 ORDER BY 1
        `) as Array<{ month: number; count: number }>;
        const monthly = Array(12).fill(0);
        for (const m of monthRows) if (m.month >= 1 && m.month <= 12) monthly[m.month - 1] = m.count;

        return {
          total,
          pending: byStatus.PENDING || 0,
          approved: byStatus.APPROVED || 0,
          rejected: byStatus.REJECTED || 0,
          monthly,
        };
      },

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number): Promise<any> {
        const skip = (page - 1) * pageSize;

        const data = await prisma.$queryRaw`
          SELECT
            ar.id, ar."employeeId", ar."attendanceId", ar.reason, ar.status, ar.location,
            ar."proposedStatus", ar."proposedCheckIn", ar."proposedCheckOut", ar."proposedComment",
            ar."proposedLocation", ar."proposedDate", ar."requestedBy", ar."approvedBy",
            ar."createdAt", ar."updatedAt", ar."isDeleted", ar."createdById", ar."updatedById", ar."deletedById",
            (ar.image IS NOT NULL) AS "hasImage",
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ar."isDeleted" IS NOT NULL
          ORDER BY ar."createdAt" DESC
          LIMIT ${pageSize}
          OFFSET ${skip}
        ` as any[];

        const totalSizeResult = await prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ar."isDeleted" IS NOT NULL
        ` as any[];

        const totalSize = totalSizeResult[0]?.count || 0;

        // Resolve usernames for admin user
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.requestedByName && item.requestedBy) {
              item.requestedByName = await getUpdatedByName(item.requestedBy);
            }
            if (!item.approvedByName && item.approvedBy) {
              item.approvedByName = await getUpdatedByName(item.approvedBy);
            }
            return item;
          })
        );

        return { data: resolvedData, totalSize };
      },

      async gpUpdateStatus(requestId: string, status: LeaveStatus, approvedBy?: string, note?: string, userId?: string): Promise<void> {
        const attendanceRequest = await prisma.attendanceRequest.findUnique({
          where: { id: requestId },
        }) as any;

        if (!attendanceRequest) {
          throw new Error(`Attendance request with ID ${requestId} not found.`);
        }

        // HOTFIX unit scoping: the reviewer may only approve/reject requests for employees in
        // their accessible units (ams.viewAll.unit bypasses).
        if (userId && attendanceRequest.employeeId) {
          const { canAccessEmployee } = await import("../../Unit/helper/unitAccess.helper");
          const ok = await canAccessEmployee(userId, attendanceRequest.employeeId);
          if (!ok) throw new AppError(403, "This request is outside your units");
        }

        // Only a PENDING request can be approved or rejected (no double-apply).
        if (
          attendanceRequest.status !== LeaveStatus.PENDING &&
          (status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED)
        ) {
          throw new AppError(409, `Attendance request is already ${String(attendanceRequest.status).toLowerCase()} and cannot be ${status === LeaveStatus.APPROVED ? "approved" : "rejected"} again.`);
        }

        // Update the request status
        const updatedRequest = await prisma.attendanceRequest.update({
          where: { id: requestId },
          data: {
            status,
            approvedBy: status === LeaveStatus.APPROVED ? (approvedBy || null) : null,
          },
        });

        // If approved and has attendanceId, apply the proposed changes
        if (status === LeaveStatus.APPROVED && attendanceRequest.attendanceId) {
          // Update the attendance with proposed changes
          const updateData: any = {
            status: attendanceRequest.proposedStatus,
            checkIn: attendanceRequest.proposedCheckIn,
            checkOut: attendanceRequest.proposedCheckOut,
            comment: attendanceRequest.proposedComment,
            location: attendanceRequest.proposedLocation,
          };

          // Remove empty/undefined/null fields so approving a request never wipes an
          // existing value (e.g. clearing a saved comment/location with a blank proposal).
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined || updateData[key] === null || updateData[key] === "") {
              delete updateData[key];
            }
          });

          await attendanceModel.attendance.gpUpdate(
            attendanceRequest.attendanceId,
            updateData
          );
        } else if (status === LeaveStatus.APPROVED && !attendanceRequest.attendanceId) {
          // This is a new attendance request (not an update)
          // Create new attendance with proposed data
          const { employeeId, proposedDate, proposedCheckIn, proposedStatus, proposedLocation, proposedComment } = attendanceRequest;

          // Use the time the employee actually submitted the request (createdAt) as the
          // fallback — NOT the approval time — so approving a request later does not shift
          // the marked date/check-in to "now".
          const requestedAt = attendanceRequest.createdAt || new Date();

          const attendanceData = {
            employeeId,
            date: proposedDate || requestedAt,
            checkIn: proposedCheckIn || requestedAt,
            status: (proposedStatus as AttendanceStatus) || AttendanceStatus.PRESENT,
            location: proposedLocation,
            comment: proposedComment,
          };

          await attendanceModel.attendance.markAttendance(attendanceData);
        }
      },
      async gpFindManyByEmployeeId(
        employeeId: string
      ): Promise<any[]> {
        const data = await prisma.$queryRaw`
          SELECT
            ar.id, ar."employeeId", ar."attendanceId", ar.reason, ar.status, ar.location,
            ar."proposedStatus", ar."proposedCheckIn", ar."proposedCheckOut", ar."proposedComment",
            ar."proposedLocation", ar."proposedDate", ar."requestedBy", ar."approvedBy",
            ar."createdAt", ar."updatedAt", ar."isDeleted", ar."createdById", ar."updatedById", ar."deletedById",
            (ar.image IS NOT NULL) AS "hasImage",
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ar."employeeId" = ${employeeId}
            AND ar."isDeleted" IS NULL
          ORDER BY ar."createdAt" DESC
        ` as any[];

        // Resolve usernames for admin user
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.requestedByName && item.requestedBy) {
              item.requestedByName = await getUpdatedByName(item.requestedBy);
            }
            if (!item.approvedByName && item.approvedBy) {
              item.approvedByName = await getUpdatedByName(item.approvedBy);
            }
            return item;
          })
        );

        return resolvedData;
      },

      async gpSearch(
        this: any,
        searchTerm: string | string[],
        columns: string[],
        page: number,
        pageSize: number
      ): Promise<any> {
        const skip = (page - 1) * pageSize;
        const searchTermsArray = Array.isArray(searchTerm) ? searchTerm : [searchTerm];

        // Build search conditions - escape SQL injection properly
        let searchWhereClause = '';
        if (searchTermsArray.length > 0 && columns.length > 0) {
          const conditions: string[] = [];
          for (const term of searchTermsArray) {
            // Escape single quotes to prevent SQL injection
            const escapedTerm = String(term).replace(/'/g, "''").replace(/\\/g, "\\\\");
            const termConditions: string[] = [];
            for (const col of columns) {
              // Only allow safe, whitelisted column names
              if (col === 'reason' || col === 'location') {
                termConditions.push(`ar."${col}"::text ILIKE '%${escapedTerm}%'`);
              } else if (col === 'status') {
                termConditions.push(`ar.status::text ILIKE '%${escapedTerm}%'`);
              }
            }
            if (termConditions.length > 0) {
              conditions.push(`(${termConditions.join(' OR ')})`);
            }
          }
          if (conditions.length > 0) {
            searchWhereClause = `AND (${conditions.join(' OR ')})`;
          }
        }

        const data = await prisma.$queryRawUnsafe(`
          SELECT 
            ar.*,
            e.id AS "employeeId",
            e.code AS "employeeCode",
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation" AS "employeeDesignation",
            e."department" AS "employeeDepartment",
            e."contactNo" AS "employeeContactNo",
            e."address" AS "employeeAddress",
            e."status" AS "employeeStatus",
            ru.username AS "requestedByName",
            au.username AS "approvedByName"
          FROM "AttendanceRequest" ar
          LEFT JOIN "Employee" e ON ar."employeeId" = e.id
          LEFT JOIN "User" ru ON ar."requestedBy" = ru.id
          LEFT JOIN "User" au ON ar."approvedBy" = au.id
          WHERE ar."isDeleted" IS NULL
            ${searchWhereClause}
          ORDER BY ar."createdAt" DESC
          LIMIT ${pageSize}
          OFFSET ${skip}
        `) as any[];

        const totalSizeResult = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ar."isDeleted" IS NULL
            ${searchWhereClause}
        `) as any[];

        const totalSize = totalSizeResult[0]?.count || 0;

        // Resolve usernames for admin user
        const resolvedData = await Promise.all(
          data.map(async (item: any) => {
            if (!item.requestedByName && item.requestedBy) {
              item.requestedByName = await getUpdatedByName(item.requestedBy);
            }
            if (!item.approvedByName && item.approvedBy) {
              item.approvedByName = await getUpdatedByName(item.approvedBy);
            }
            return item;
          })
        );

        return { data: resolvedData, totalSize };
      },
    }
  },
});
export default attendanceRequestModel;
