import prisma from "../../../../core/models/base.model";
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Attendance } from "../types/Attendance";
import {
  formatTime,
  getCurrentTimeInPST,
} from "../../../../helper/date.helper";

import { AttendanceStatus, Employee } from "@prisma/client";
import { convertToPST } from "../helper/date.helper";

// Pakistan timezone constant
const PAKISTAN_TIMEZONE = 'Asia/Karachi';

// Admin user ID constant
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// Helper function to get username from userId
async function getUpdatedByName(updatedBy: string | null): Promise<string | null> {
  if (!updatedBy) {
    return null;
  }
  
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
    console.error(`Error fetching username for userId ${updatedBy}:`, error);
    return null;
  }
}

// Helper function to get start of day in Pakistan timezone, then convert to UTC for database query
function getStartOfDayPakistan(date: Date): Date {
  // Get the date components in Pakistan timezone
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1; // Month is 0-indexed
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  
  // Create a date object representing 00:00:00 in Pakistan timezone
  // We create it as if it were UTC, then adjust
  const pakistanMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  // Pakistan is UTC+5, so 00:00:00 PKT = 19:00:00 previous day UTC
  // We need to subtract 5 hours from the UTC representation
  pakistanMidnight.setUTCHours(pakistanMidnight.getUTCHours() - 5);
  
  return pakistanMidnight;
}

// Helper function to get end of day in Pakistan timezone, then convert to UTC for database query
function getEndOfDayPakistan(date: Date): Date {
  // Get the date components in Pakistan timezone
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1; // Month is 0-indexed
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  
  // Create a date object representing 23:59:59.999 in Pakistan timezone
  const pakistanEndOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  
  // Pakistan is UTC+5, so 23:59:59.999 PKT = 18:59:59.999 same day UTC
  // We need to subtract 5 hours from the UTC representation
  pakistanEndOfDay.setUTCHours(pakistanEndOfDay.getUTCHours() - 5);
  
  return pakistanEndOfDay;
}
// import { FaceComparisonService } from "../../Face-api/services/face-api.service";
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace(/ /g, '/'); // Converts "07 May 2025" to "07/May/2025"
}

// Helper function to format time as HH:MM (24-hour)
function formatCommentTime(date: Date | null): string {
  if (!date) return 'no check-in time';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date); // e.g., "14:30"
}

const attendanceModel = prisma.$extends({
  model: {
    attendance: {
      async checkAttendance(
        employeeId: string,
        status: AttendanceStatus,
        date?: Date
      ) {
        // Use Pakistan timezone for date filtering
        const targetDate = date ? new Date(date) : new Date();
        const todayStart = getStartOfDayPakistan(targetDate);
        const todayEnd = getEndOfDayPakistan(targetDate);

        const employee: Employee = await prisma.employee.gpFindById(employeeId);
        const existingAttendance: any = await prisma.attendance.findFirst({
          where: {
            employeeId: employeeId,
            date: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
        });

        const employeeName = `${employee.name} ${employee.surname}`;

        if (existingAttendance && existingAttendance.status === "ON_LEAVE") {
          return {
            success: true,
            status: existingAttendance.status,
            message: `${employeeName} is on Leave`,
          };
        }

        if (existingAttendance && existingAttendance.status === "LATE") {
          return {
            success: true,
            status: existingAttendance.status,
            message: `${employeeName} is late `,
          };
        }

        if (existingAttendance && (existingAttendance.status === "PRESENT" || existingAttendance.status === "LATE")) {
          if (existingAttendance.checkIn && !existingAttendance.checkOut) {
            return {
              success: true,
              status: existingAttendance.status,
              message: `${employeeName} has checked in at: ${formatTime(
                convertToPST(existingAttendance.checkIn).toString()
              )} and has not checked out.\nDo you want to check out ${employeeName}?`,
            };
          }
          if (existingAttendance.checkOut && existingAttendance.checkIn) {
            return {
              success: true,
              status: existingAttendance.status,
              message: `${employeeName} has already checked in at: ${formatTime(
                convertToPST(existingAttendance.checkIn).toString()
              )} and checked out at: ${formatTime(
                convertToPST(existingAttendance.checkOut).toString()
              )}`,
            };
          }
        }

        if (existingAttendance && existingAttendance.status === "ABSENT") {
          return {
            success: true,
            status: existingAttendance.status,
            message: `${employeeName} is absent.`,
          };
        }

        return {
          success: true,
          status: null,
          message: `${employeeName} has not checked in yet! Do you want to mark attendance for ${employeeName} as ${status}?`,
        };
      },
 

      async getSpecificAttendances(type: any, employeeId: string) {
        // console.log(type);
        const data = await prisma.attendance.findMany({
          where: {
            employeeId: employeeId,
            status: type,
            isDeleted: null,
          },
          select: {
            date: true,
          },
        });

        return data;
      },
  
      
      // Helper function to generate comment based on status
       generateComment(
        employee: Employee,
        status: string,
        date: Date,
        checkIn: any,
        checkOut: any
      ): string {
        const employeeName = `${employee.name} ${employee.surname}`;
        const formattedDate = formatDate(date);
      
        switch (status) {
          case 'PRESENT':
            return `${employeeName} was present on ${formattedDate} and checked in at ${formatCommentTime(
              checkIn
            )} and checked out at ${formatCommentTime(checkOut)}`;
          case 'ABSENT':
            return `${employeeName} was absent on ${formattedDate}`;
          case 'LATE':
            return `${employeeName} was late on ${formattedDate} and checked in at ${formatCommentTime(checkIn)}`;
          case 'ON_LEAVE':
            return `${employeeName} was on leave on ${formattedDate}`;
          case 'HALF_DAY':
            return `${employeeName} worked half day on ${formattedDate} and checked in at ${formatCommentTime(
              checkIn
            )} and checked out at ${formatCommentTime(checkOut)}`;
          case 'HOLIDAYS':
            return `${employeeName} was on holiday on ${formattedDate}`;
          default:
            return 'No comment available';
        }
      },
      
      // Method to mark attendance
      async markAttendance(attendanceData: Attendance & { createdByUserId?: string; updatedByUserId?: string; createLeaveRequest?: boolean; leaveType?: string; leaveReason?: string }) {
        // Use database transaction to prevent race conditions
        return await prisma.$transaction(async (tx) => {
          // Extract audit trail fields and leave-related fields
          const { createdByUserId, updatedByUserId, createLeaveRequest, leaveType, leaveReason, ...attendanceFields } = attendanceData as any;
          
          // Use Pakistan timezone for date filtering
          const targetDate = attendanceFields.date
            ? new Date(attendanceFields.date)
            : new Date();
          const todayStart = getStartOfDayPakistan(targetDate);
          const todayEnd = getEndOfDayPakistan(targetDate);
        
          const employee = await tx.employee.findUnique({
            where: { id: attendanceFields.employeeId },
          });
        
          if (!employee) {
            return {
              success: false,
              message: `Employee with ID ${attendanceFields.employeeId} not found`,
            };
          }
        
          // Normalize the date to start of day in Pakistan timezone for consistent storage
          // This ensures the date field always represents the day in Pakistan timezone
          const normalizedDate = getStartOfDayPakistan(targetDate);
          
          // Check for existing attendance within the same day (Pakistan timezone)
          const existingAttendance = await tx.attendance.findFirst({
            where: {
              employeeId: attendanceFields.employeeId,
              date: {
                gte: todayStart,
                lt: todayEnd,
              },
              isDeleted: null, // Only check non-deleted records
            },
          });
        
          if (existingAttendance) {
            // Prepare previous update record for audit trail
            const existingAttendanceWithAudit = existingAttendance as any;
            const previousUpdate = {
              data: {
                status: existingAttendance.status,
                checkIn: existingAttendance.checkIn,
                checkOut: existingAttendance.checkOut,
                comment: existingAttendance.comment,
                location: existingAttendance.location,
                date: existingAttendance.date,
              },
              updatedBy: existingAttendanceWithAudit.updatedBy || null,
              updatedAt: existingAttendance.updatedAt || new Date(),
            };

            // Get existing previousUpdates  array or initialize empty array
            const existingPreviousUpdates = (existingAttendanceWithAudit.previousUpdates as any[]) || [];

            // Add current state to previousUpdates and keep only last 3
            const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

            // If attendance already exists, mark it as a checkout
            if ((existingAttendance.status === "PRESENT" || existingAttendance.status === "LATE") && existingAttendance.checkIn && !existingAttendance.checkOut) {
              const updatedAttendance = await tx.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  checkOut: new Date(), // Checkout time is the current time
                  comment:
                    attendanceFields.comment ||
                    existingAttendance.comment ||
                    '',
                  updatedBy: updatedByUserId || null,
                  updatedAt: new Date(),
                  previousUpdates: updatedPreviousUpdates,
                } as any,
              });
              return {
                success: true,
                message: `Check-out marked successfully for ${employee.name} ${employee.surname}!`,
                data: updatedAttendance,
              };
            }
        
            // If checkOut already exists, update the attendance if needed
            if (attendanceFields.status && attendanceFields.status !== existingAttendance.status) {
              const updatedAttendance = await tx.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: attendanceFields.status,
                  checkIn: attendanceFields.checkIn || existingAttendance.checkIn,
                  checkOut: attendanceFields.checkOut || existingAttendance.checkOut,
                  comment: attendanceFields.comment || existingAttendance.comment || '',
                  location: attendanceFields.location || existingAttendance.location,
                  updatedBy: updatedByUserId || null,
                  updatedAt: new Date(),
                  previousUpdates: updatedPreviousUpdates,
                } as any,
              });

              // If status changed to ON_LEAVE and createLeaveRequest is true, create a leave request
              if (attendanceFields.status === 'ON_LEAVE' && createLeaveRequest) {
                try {
                  const leaveReqModel = (await import('../../Leaves/models/leaveReq.model')).default;
                  
                  const leaveRequestData: any = {
                    employeeId: attendanceFields.employeeId,
                    startDate: normalizedDate,
                    endDate: normalizedDate,
                    status: 'APPROVED',
                    reason: leaveReason || 'Leave marked during attendance update',
                    leaveType: leaveType || 'CASUAL',
                  };

                  await leaveReqModel.leaveRequest.gpCreate(leaveRequestData);
                } catch (error) {
                  console.error('Error creating leave request during attendance update:', error);
                }
              }

              return {
                success: true,
                message: `Attendance updated successfully for ${employee.name} ${employee.surname}!`,
                data: updatedAttendance,
              };
            }
        
            // If checkOut already exists and no changes needed
            return {
              success: true,
              message: `Attendance already marked, including check-out for ${employee.name} ${employee.surname}`,
              data: existingAttendance,
            };
          }
        
          // If no existing attendance, proceed to create with normalized date
          const newAttendance = await tx.attendance.create({
            data: {
              ...attendanceFields,
              date: normalizedDate, // Use normalized date (start of day in Pakistan timezone)
              checkIn: attendanceFields.checkIn || new Date(),
              comment: attendanceFields.comment || '',
              createdBy: createdByUserId || null,
              previousUpdates: [],
            } as any,
          });

          // If status is ON_LEAVE and createLeaveRequest is true, create a leave request
          if (attendanceFields.status === 'ON_LEAVE' && createLeaveRequest) {
            try {
              // Import leave request model dynamically to avoid circular dependency
              const leaveReqModel = (await import('../../Leaves/models/leaveReq.model')).default;
              
              // Create leave request for the same date
              const leaveRequestData: any = {
                employeeId: attendanceFields.employeeId,
                startDate: normalizedDate,
                endDate: normalizedDate,
                status: 'APPROVED', // Auto-approve when marked during attendance
                reason: leaveReason || 'Leave marked during attendance',
                leaveType: leaveType || 'CASUAL',
              };

              // Create the leave request (this will automatically link to leave allocation if configured)
              await leaveReqModel.leaveRequest.gpCreate(leaveRequestData);
            } catch (error) {
              console.error('Error creating leave request during attendance marking:', error);
              // Don't fail the attendance marking if leave request creation fails
            }
          }
        
          return {
            success: true,
            message: `Attendance marked successfully for ${employee.name} ${employee.surname}!`,
            data: newAttendance,
          };
        });
      },

      // Bulk mark leave for selected employees
      async bulkMarkLeave(
        employeeIds: string[],
        date: Date,
        leaveType?: string,
        reason?: string,
        createLeaveRequest?: boolean,
        createdByUserId?: string
      ): Promise<any> {
        const normalizedDate = getStartOfDayPakistan(date);
        const dateStart = new Date(normalizedDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(normalizedDate);
        dateEnd.setHours(23, 59, 59, 999);

        const results = [];

        for (const employeeId of employeeIds) {
          try {
            // Check if employee exists
            const employee = await prisma.employee.findUnique({
              where: { id: employeeId, isDeleted: null },
            });

            if (!employee) {
              results.push({
                employeeId,
                success: false,
                message: `Employee not found`,
              });
              continue;
            }

            // Check if attendance already exists
            const existingAttendance = await prisma.attendance.findFirst({
              where: {
                employeeId,
                date: {
                  gte: dateStart,
                  lte: dateEnd,
                },
                isDeleted: null,
              },
            });

            if (existingAttendance) {
              // Update existing attendance to ON_LEAVE
              const updatedAttendance = await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: AttendanceStatus.ON_LEAVE,
                  comment: reason || existingAttendance.comment || '',
                  updatedBy: createdByUserId || null,
                  updatedAt: new Date(),
                } as any,
              });

              results.push({
                employeeId,
                employeeName: `${employee.name} ${employee.surname}`,
                success: true,
                message: `Leave marked successfully`,
                data: updatedAttendance,
              });
            } else {
              // Create new attendance record as ON_LEAVE
              const newAttendance = await prisma.attendance.create({
                data: {
                  employeeId,
                  date: normalizedDate,
                  status: AttendanceStatus.ON_LEAVE,
                  comment: reason || '',
                  createdBy: createdByUserId || null,
                  createdAt: new Date(),
                } as any,
              });

              results.push({
                employeeId,
                employeeName: `${employee.name} ${employee.surname}`,
                success: true,
                message: `Leave marked successfully`,
                data: newAttendance,
              });
            }

            // If createLeaveRequest is true, create a leave request
            if (createLeaveRequest) {
              try {
                const leaveReqModel = (await import('../../Leaves/models/leaveReq.model')).default;
                
                const leaveRequestData: any = {
                  employeeId,
                  startDate: normalizedDate,
                  endDate: normalizedDate,
                  status: 'APPROVED',
                  reason: reason || 'Bulk leave marking',
                  leaveType: leaveType || 'CASUAL',
                };

                await leaveReqModel.leaveRequest.gpCreate(leaveRequestData);
              } catch (error) {
                console.error(`Error creating leave request for employee ${employeeId}:`, error);
              }
            }
          } catch (error: any) {
            results.push({
              employeeId,
              success: false,
              message: error.message || 'Error marking leave',
            });
          }
        }

        return {
          success: true,
          message: `Bulk leave marking completed`,
          total: employeeIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        };
      },

      async gpFindEmployeeAttendance(
        this: any,
        employeeId: string,
        from: Date | string | null,
        to: Date | string | null
      ) {
        // Convert input dates to Date objects if they're strings
        const fromDate = from ? (typeof from === 'string' ? new Date(from) : from) : null;
        const toDate = to ? (typeof to === 'string' ? new Date(to) : to) : null;

        let todayStart: Date;
        let todayEnd: Date;

        if (fromDate) {
          // Get start of day in Pakistan timezone for the given date
          todayStart = getStartOfDayPakistan(fromDate);
        } else {
          // If no from date, use start of current month in Pakistan timezone
          const now = new Date();
          const nowInPakistan = toZonedTime(now, PAKISTAN_TIMEZONE);
          const startOfMonth = new Date(nowInPakistan.getFullYear(), nowInPakistan.getMonth(), 1);
          todayStart = getStartOfDayPakistan(startOfMonth);
        }

        if (toDate) {
          // Get end of day in Pakistan timezone for the given date
          todayEnd = getEndOfDayPakistan(toDate);
        } else {
          // If no to date, use end of today in Pakistan timezone
          const now = new Date();
          todayEnd = getEndOfDayPakistan(now);
        }

        // Fetch full attendance details with employee data
        // const data = await prisma.$queryRaw`

        //   SELECT
        //     a.*,
        //     e."name" AS "employeeName",
        //     e."surname" AS "employeeSurname",
        //     e."designation",
        //     e."contactNo",
        //     e."address",
        //     e."department",
        //     e."code" -- Include additional employee fields if needed
        //   FROM "Attendance" a
        //   LEFT JOIN "Employee" e
        //     ON a."employeeId" = ${employeeId}
        //   WHERE a."isDeleted" IS NULL
        //     AND a."date" >= ${todayStart.toISOString()}::timestamp
        //     AND a."date" <= ${todayEnd.toISOString()}::timestamp
        // `;
        const data = await prisma.$queryRaw`
SELECT 
    a.id,
    a."employeeId",
    a."date",
    a.status,
    a."checkIn",
    a."comment",
    a."checkOut",
    a.location,
    a."createdAt",
    a."updatedAt",
    a."isDeleted",
    e.code,
    e."name" AS "employeeName",
    e."surname" AS "employeeSurname",
    e."designation",
    e."contactNo",
    e."address",
    e."department"
FROM 
    public."Attendance" a
JOIN 
    public."Employee" e ON a."employeeId" = e.id
WHERE 
    a."employeeId" = ${employeeId} 
    AND a."isDeleted" IS NULL
    AND a."date" >= ${todayStart.toISOString()}::timestamp
    AND a."date" <= ${todayEnd.toISOString()}::timestamp
ORDER BY 
    a."date" ASC; 
        `;

        return data;
      },

      async gpFindDatedMany(this: any, from: Date | string | null, to: Date | string | null) {
        // Convert input dates to Date objects if they're strings
        const fromDate = from ? (typeof from === 'string' ? new Date(from) : from) : null;
        const toDate = to ? (typeof to === 'string' ? new Date(to) : to) : null;

        let todayStart: Date;
        let todayEnd: Date;

        if (fromDate) {
          // Get start of day in Pakistan timezone for the given date
          todayStart = getStartOfDayPakistan(fromDate);
        } else {
          // If no from date, use start of current month in Pakistan timezone
          const now = new Date();
          const nowInPakistan = toZonedTime(now, PAKISTAN_TIMEZONE);
          const startOfMonth = new Date(nowInPakistan.getFullYear(), nowInPakistan.getMonth(), 1);
          todayStart = getStartOfDayPakistan(startOfMonth);
        }

        if (toDate) {
          // Get end of day in Pakistan timezone for the given date
          todayEnd = getEndOfDayPakistan(toDate);
        } else {
          // If no to date, use end of today in Pakistan timezone
          const now = new Date();
          todayEnd = getEndOfDayPakistan(now);
        }

        console.log('Date filter - From:', todayStart.toISOString(), 'To:', todayEnd.toISOString());
        console.log('Date filter (Pakistan time) - From:', formatInTimeZone(todayStart, PAKISTAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'), 'To:', formatInTimeZone(todayEnd, PAKISTAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));

        // Fetch full attendance details with employee data
        const data = await prisma.$queryRaw`
          SELECT 
            a.*,
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation",
            e."contactNo",
            e."address",
            e."department", 
            e."code" -- Include additional employee fields if needed
          FROM "Attendance" a
          LEFT JOIN "Employee" e 
            ON a."employeeId" = e.id
          WHERE a."isDeleted" IS NULL
            AND a."date" >= ${todayStart.toISOString()}::timestamp
            AND a."date" <= ${todayEnd.toISOString()}::timestamp
            ORDER BY 
            a."date" ASC
        `;

        return data;
      },
      async gpFindMany(this: any) {
        // Get current date and calculate start/end of today in Pakistan timezone
        const now = new Date();
        const todayStart = getStartOfDayPakistan(now);
        const todayEnd = getEndOfDayPakistan(now);

        console.log('Today filter (UTC) - From:', todayStart.toISOString(), 'To:', todayEnd.toISOString());
        console.log('Today filter (Pakistan time) - From:', formatInTimeZone(todayStart, PAKISTAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'), 'To:', formatInTimeZone(todayEnd, PAKISTAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));

        // Fetch full attendance details with employee data
        const data = await prisma.$queryRaw`
          SELECT 
            a.*,
            e."name" AS "employeeName",
            e."surname" AS "employeeSurname",
            e."designation",
            e."contactNo",
            e."address",
            e."department", 
            e."code" -- Include additional employee fields if needed
          FROM "Attendance" a
          LEFT JOIN "Employee" e 
            ON a."employeeId" = e.id
          WHERE a."isDeleted" IS NULL
            AND a."date" >= ${todayStart.toISOString()}::timestamp
            AND a."date" <= ${todayEnd.toISOString()}::timestamp
            ORDER BY 
            a."date" ASC
        `;

        return data;
      },

      async markFaceAttendance(this: any, image: string) {
        const employees = await prisma.employee.findMany({
          where: { isDeleted: null },
          select: { id: true, image: true },
        });
      
        const validEmployees = employees.filter(emp => emp.image !== null) as { id: string; image: string }[];
      
        // const matchedEmployeeId = await FaceComparisonService.compareFace(image, validEmployees);
        const matchedEmployeeId = '';
      
        if (matchedEmployeeId) {

          const attendance  = {
            employeeId: matchedEmployeeId,
            date: new Date(),
            status: AttendanceStatus.ABSENT,
            checkIn: new Date(),
            checkOut: new Date(),
            location: '',
          }
          const Response = await attendanceModel.attendance.markAttendance(attendance);
          return Response;
        } else {

          return {
            success:false,
            message: 'No matching face found'
          };
        }
      },

      async gpCreate(this: any, createdData: any) {
        if (!Array.isArray(createdData)) {
          createdData = [createdData];
        }

        const createdItems = [];

        for (const data of createdData) {
          const { createdByUserId, ...remainingData } = data;
          
          let newData = {
            ...remainingData,
            createdAt: new Date(),
            createdBy: createdByUserId || null,
            previousUpdates: [],
          };

          const createdItem = await this.create({
            data: newData as any,
          });

          createdItems.push(createdItem);
        }

        return createdItems;
      },

      async gpUpdate(this: any, updateId: string, data: any) {
        const { updatedByUserId, ...remainingData } = data;

        // Get current state before update for audit trail
        const currentAttendance = await prisma.attendance.findUnique({
          where: { id: updateId },
        }) as any;

        if (!currentAttendance) {
          throw new Error(`Attendance with ID ${updateId} not found.`);
        }

        // Prepare previous update record
        const previousUpdate = {
          data: {
            status: currentAttendance.status,
            checkIn: currentAttendance.checkIn,
            checkOut: currentAttendance.checkOut,
            comment: currentAttendance.comment,
            location: currentAttendance.location,
            date: currentAttendance.date,
          },
          updatedBy: currentAttendance.updatedBy || null,
          updatedAt: currentAttendance.updatedAt || new Date(),
        };

        // Get existing previousUpdates array or initialize empty array
        const existingPreviousUpdates = (currentAttendance.previousUpdates as any[]) || [];

        // Add current state to previousUpdates and keep only last 3
        const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

        // Prepare update data with audit trail
        const updateData: any = {
          ...remainingData,
          updatedAt: new Date(),
          updatedBy: updatedByUserId || null,
          previousUpdates: updatedPreviousUpdates,
        };

        // Update the attendance data
        const updatedData = await prisma.attendance.update({
          where: { id: updateId },
          data: updateData as any,
        });

        return updatedData;
      },

      async getHistoryById(this: any, attendanceId: string, filter?: boolean, date?: string) {
        const attendance = await prisma.attendance.findUnique({
          where: { id: attendanceId },
        }) as any;

        if (!attendance) {
          throw new Error(`Attendance with ID ${attendanceId} not found.`);
        }

        const previousUpdates = (attendance.previousUpdates as any[]) || [];

        // Add updatedByName to each update record
        const previousUpdatesWithNames = await Promise.all(
          previousUpdates.map(async (update: any) => {
            const updatedByName = await getUpdatedByName(update.updatedBy || null);
            return {
              ...update,
              updatedByName: updatedByName,
            };
          })
        );

        // If filter is not true, return complete previousUpdates array with names
        if (!filter) {
          return previousUpdatesWithNames;
        }

        // If filter is true and date is provided, return record for that specific date
        if (filter && date) {
          const targetDate = new Date(date);
          // Normalize dates to compare only date part (ignore time)
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          const record = previousUpdatesWithNames.find((update: any) => {
            if (!update.updatedAt) return false;
            const updateDate = new Date(update.updatedAt);
            const updateDateStr = updateDate.toISOString().split('T')[0];
            return updateDateStr === targetDateStr;
          });

          return record || null;
        }

        // If filter is true but no date provided, return array of dates
        const dates = previousUpdatesWithNames
          .map((update: any) => update.updatedAt)
          .filter((date: any) => date !== null && date !== undefined);

        return dates;
      },
      
      
    },
  },
});

export default attendanceModel;
