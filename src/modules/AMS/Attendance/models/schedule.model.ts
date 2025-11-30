import prisma from "../../../../core/models/base.model";
import { startOfDay, endOfDay } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { AttendanceStatus } from "@prisma/client";
import { getCurrentTimeInPST } from "../../../../helper/date.helper";

// Pakistan timezone constant
const PAKISTAN_TIMEZONE = 'Asia/Karachi';

// Helper function to get start of day in Pakistan timezone, then convert to UTC for database query
function getStartOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  const pakistanMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  pakistanMidnight.setUTCHours(pakistanMidnight.getUTCHours() - 5);
  return pakistanMidnight;
}

// Helper function to get end of day in Pakistan timezone, then convert to UTC for database query
function getEndOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  const pakistanEndOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  pakistanEndOfDay.setUTCHours(pakistanEndOfDay.getUTCHours() - 5);
  return pakistanEndOfDay;
}

const attendanceScheduleModel = prisma.$extends({
  model: {
    attendanceScheduler: {
      async isTodayAttendanceMarkedSuccessfully(): Promise<boolean> {
        const today = new Date();
        const todayStart = getStartOfDayPakistan(today); // Start of the day in Pakistan timezone
        const todayEnd = getEndOfDayPakistan(today);

        // Check for both ABSENT and LEAVE (holidays/Sundays) parent types
        const attendanceSchedule = await prisma.attendanceScheduler.findFirst({
          where: {
            runTime: {
              gte: todayStart,
              lte: todayEnd,
            },
            parent: {
              in: ["ABSENT", "LEAVE"], // Check for both ABSENT and LEAVE (holidays)
            },
            status: "SUCCESS", // Check if status is SUCCESS
          },
        });

        return !!attendanceSchedule; // Return true if a matching record is found, otherwise false
      },

      async getNonCheckedOutEmployees() {
        const today = new Date();
        const todayStart = getStartOfDayPakistan(today); // Start of the day in Pakistan timezone
        const todayEnd = getEndOfDayPakistan(today);

        // Find all employees who have not been deleted and are not RESIGNED
        const allEmployees = await prisma.employee.findMany({
          select: { id: true },
          where: {
            isDeleted: null,
            status: {
              not: "RESIGNED",
            },
          },
        });

        const allEmployeeIds = allEmployees.map((e) => e.id);

        // Find attendance records for today where checkOut is null and status is PRESENT
        const nonCheckedOutAttendance = await prisma.attendance.findMany({
          where: {
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
            checkOut: null,
            comment:null, // Condition for no check-out
            status: "PRESENT", // Condition for PRESENT status
          },
          select: { employeeId: true },
        });

        // Extract employee IDs with non-checked-out attendance
        const nonCheckedOutEmployeeIds = nonCheckedOutAttendance.map(
          (attendance) => attendance.employeeId
        );

        // Return only employees who are in today's non-checked-out attendance
        const result = allEmployeeIds.filter((id) =>
          nonCheckedOutEmployeeIds.includes(id)
        );

        return result;
      },
      async getNonMarkedEmployees() {
        const today = new Date();
        const todayStart = getStartOfDayPakistan(today); // Start of the day in Pakistan timezone
        const todayEnd = getEndOfDayPakistan(today);

        const allEmployees = await prisma.employee.findMany({
          select: { id: true },
          where: {
            isDeleted: null,
            status: {
              not: "RESIGNED",
            },
          },
        });

        const allEmployeeIds = allEmployees.map((e) => e.id);

        const markedAttendance = await prisma.attendance.findMany({
          where: {
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: { employeeId: true },
        });

        const markedEmployeeIds = markedAttendance.map(
          (attendance) => attendance.employeeId
        );

        const nonMarkedEmployeeIds = allEmployeeIds.filter(
          (id) => !markedEmployeeIds.includes(id)
        );

        return nonMarkedEmployeeIds;
      },
    },
  },
});

export default attendanceScheduleModel;
