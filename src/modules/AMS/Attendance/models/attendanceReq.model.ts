
import { AttendanceStatus, LeaveStatus, Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import { AttendanceRequest } from "../types/AttendanceRequest";
import attendanceModel from "./attendance.model";

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


const attendanceRequestModel = prisma.$extends({
  model: {
    attendanceRequest:{

      async gpFindMany(this: any): Promise<any[]> {
        const data = await prisma.$queryRaw`
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

      async gpFindById(this: any, id: string): Promise<any> {
        const data = await prisma.$queryRaw`
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

      async gpPgFindMany(this: any, page: number, pageSize: number): Promise<any> {
        const skip = (page - 1) * pageSize;
        
        const data = await prisma.$queryRaw`
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
          ORDER BY ar."createdAt" DESC
          LIMIT ${pageSize}
          OFFSET ${skip}
        ` as any[];

        const totalSizeResult = await prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM "AttendanceRequest" ar
          WHERE ar."isDeleted" IS NULL
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

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number): Promise<any> {
        const skip = (page - 1) * pageSize;
        
        const data = await prisma.$queryRaw`
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

      async gpUpdateStatus(requestId: string, status: LeaveStatus, approvedBy?: string): Promise<void> {
        const attendanceRequest = await prisma.attendanceRequest.findUnique({
          where: { id: requestId },
        }) as any;

        if (!attendanceRequest) {
          throw new Error(`Attendance request with ID ${requestId} not found.`);
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

          // Remove undefined fields
          Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined || updateData[key] === null) {
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
          
          const attendanceData = {
            employeeId,
            date: proposedDate || new Date(),
            checkIn: proposedCheckIn || new Date(),
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
