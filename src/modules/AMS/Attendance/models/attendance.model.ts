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
      async markAttendance(attendanceData: Attendance) {
        // Use database transaction to prevent race conditions
        return await prisma.$transaction(async (tx) => {
          // Use Pakistan timezone for date filtering
          const targetDate = attendanceData.date
            ? new Date(attendanceData.date)
            : new Date();
          const todayStart = getStartOfDayPakistan(targetDate);
          const todayEnd = getEndOfDayPakistan(targetDate);
        
          const employee = await tx.employee.findUnique({
            where: { id: attendanceData.employeeId },
          });
        
          if (!employee) {
            return {
              success: false,
              message: `Employee with ID ${attendanceData.employeeId} not found`,
            };
          }
        
          // Normalize the date to start of day in Pakistan timezone for consistent storage
          // This ensures the date field always represents the day in Pakistan timezone
          const normalizedDate = getStartOfDayPakistan(targetDate);
          
          // Check for existing attendance within the same day (Pakistan timezone)
          const existingAttendance = await tx.attendance.findFirst({
            where: {
              employeeId: attendanceData.employeeId,
              date: {
                gte: todayStart,
                lt: todayEnd,
              },
              isDeleted: null, // Only check non-deleted records
            },
          });
        
          if (existingAttendance) {
            // If attendance already exists, mark it as a checkout
            if ((existingAttendance.status === "PRESENT" || existingAttendance.status === "LATE") && existingAttendance.checkIn && !existingAttendance.checkOut) {
              const updatedAttendance = await tx.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  checkOut: new Date(), // Checkout time is the current time
                  comment:
                    attendanceData.comment ||
                    existingAttendance.comment ||
                    ''
                },
              });
              return {
                success: true,
                message: `Check-out marked successfully for ${employee.name} ${employee.surname}!`,
                data: updatedAttendance,
              };
            }
        
            // If checkOut already exists, update the attendance if needed
            if (attendanceData.status && attendanceData.status !== existingAttendance.status) {
              const updatedAttendance = await tx.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: attendanceData.status,
                  checkIn: attendanceData.checkIn || existingAttendance.checkIn,
                  checkOut: attendanceData.checkOut || existingAttendance.checkOut,
                  comment: attendanceData.comment || existingAttendance.comment || '',
                  location: attendanceData.location || existingAttendance.location,
                },
              });
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
              ...attendanceData,
              date: normalizedDate, // Use normalized date (start of day in Pakistan timezone)
              checkIn: attendanceData.checkIn || new Date(),
              comment: attendanceData.comment || '',
            },
          });
        
          return {
            success: true,
            message: `Attendance marked successfully for ${employee.name} ${employee.surname}!`,
            data: newAttendance,
          };
        });
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
      }
      
      
    },
  },
});

export default attendanceModel;
