import schedule from "node-schedule";
import prisma from "../../../../core/models/base.model";
import AttendanceScheduleService from "../services/schedule.service";
import { Attendance } from "../types/Attendance";
import { AttendanceScheduler } from "../types/schedule";
import {
  AttendanceStatus,
  Employee,
  ScheduleParent,
  ScheduleStatus,
} from "@prisma/client";
import { startOfDay } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import AttendanceService from "../services/attendnace.service";
import { getCurrentTimeInPST } from "../../../../helper/date.helper";

// Pakistan timezone constant
const PAKISTAN_TIMEZONE = 'Asia/Karachi';

// Helper function to check if a date is Sunday in Pakistan timezone
function isSunday(date: Date): boolean {
  const pakistanDate = toZonedTime(date, PAKISTAN_TIMEZONE);
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  return pakistanDate.getDay() === 0;
}

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

class AttendanceSchedulerHelper {
  private service: AttendanceScheduleService = new AttendanceScheduleService();
  private attendanceService: AttendanceService = new AttendanceService();
  private attendanceSchedulerService: AttendanceScheduleService =
    new AttendanceScheduleService();
  private attendanceSchedule: schedule.Job;
  private nonCheckedOutCommentSchedule: schedule.Job;
  constructor() {
    this.attendanceSchedule = schedule.scheduleJob(
      "*/1 * * * *", // Runs every minute
      this.cleanup.bind(this)
    );

    this.nonCheckedOutCommentSchedule = schedule.scheduleJob(
       "*/1 * * * *",// Runs every minute from 11:50 PM to 11:55 PM
      this.markNonCheckedOutComments.bind(this)
    );
  }

  private async cleanup() {
    await this.absentMarking();
  }

  private async absentMarking() {
    const now = getCurrentTimeInPST();
    const todayDate = getStartOfDayPakistan(now); // Start of the day in Pakistan timezone

    try {
      // Check if the time is between 11:55 PM and 12:00 AM
      const hour = now.getHours();
      const minutes = now.getMinutes();
      console.log(hour, ":", minutes);
      const absentsMarked =
        await this.attendanceSchedulerService.isTodaysAttendanceMarked();

      if (!absentsMarked) {
        if (hour === 23 && minutes >= 55) {
          console.log(
            `Running cleanup during the last 5 minutes of the day as the time is now: ${now}...`
          );

          const data = await this.service.getNonMarkedEmployees();
          try {
            // Check if today is Sunday in Pakistan timezone
            const isTodaySunday = isSunday(now);
            const statusToMark = isTodaySunday ? AttendanceStatus.HOLIDAYS : AttendanceStatus.ABSENT;
            const logMessage = isTodaySunday 
              ? "Holidays (Sundays) marked successfully!" 
              : "Absents marked successfully!";
            const parentType = isTodaySunday ? ScheduleParent.LEAVE : ScheduleParent.ABSENT;

            data.forEach(async (employeeId: string) => {
              if (employeeId) {
                const attendance: Attendance = {
                  employeeId,
                  status: statusToMark,
                  date: todayDate, // Use today's start of the day
                  createdAt: now, // Keep creation time as now
                };

                await this.attendanceService.markAttendance(attendance);
              }
            });

            const scheduleReport: AttendanceScheduler = {
              log: logMessage,
              parent: parentType,
              status: ScheduleStatus.SUCCESS,
              employeeIds: data,
              runTime: now,
            };

            await this.attendanceSchedulerService.createAttendanceSchedule(
              scheduleReport
            );
          } catch (err: any) {
            const isTodaySunday = isSunday(now);
            const logMessage = isTodaySunday 
              ? "Holidays (Sundays) marking failed!" 
              : "Absents marking failed!";
            const parentType = isTodaySunday ? ScheduleParent.LEAVE : ScheduleParent.ABSENT;
            
            const scheduleReport: AttendanceScheduler = {
              log: logMessage,
              parent: parentType,
              status: ScheduleStatus.FAIL,
              employeeIds: [],
              runTime: now,
            };
            await this.attendanceSchedulerService.createAttendanceSchedule(
              scheduleReport
            );
          }
        } else {
          console.log(
            `Cleanup skipped. Current time is outside the last 5 minutes of the day. Now: ${now}`
          );
        }
      } else {
        console.log("Skipping because the status is:", absentsMarked);
      }
    } catch (error) {
      const isTodaySunday = isSunday(now);
      const logMessage = isTodaySunday 
        ? "Holidays (Sundays) marking failed!" 
        : "Absents marking failed!";
      const parentType = isTodaySunday ? ScheduleParent.LEAVE : ScheduleParent.ABSENT;
      
      const scheduleReport: AttendanceScheduler = {
        log: logMessage,
        parent: parentType,
        status: ScheduleStatus.SKIP,
        employeeIds: [],
        runTime: now,
      };
      await this.attendanceSchedulerService.createAttendanceSchedule(
        scheduleReport
      );
      console.error("Error during attendance cleanup:", error);
    }
  }

  private async markNonCheckedOutComments() {
    const now = getCurrentTimeInPST();
    const todayDate = getStartOfDayPakistan(now); // Start of the day in Pakistan timezone
    const hour = now.getHours();
    const minutes = now.getMinutes();
    // Ensure the scheduler runs only between 11:50 PM and 11:55 PM
    if (hour !== 23 || minutes < 50 || minutes > 55) {
      console.log(
        `Non-checked-out comment marking skipped. Current time is outside 11:50 PM - 11:55 PM. Now: ${now}`
      );
      return;
    }

    let scheduleReport: AttendanceScheduler = {
      log: "Error occurred during non-checked-out comment marking.",
      parent: ScheduleParent.CHECK_OUT,
      status: ScheduleStatus.FAIL,
      employeeIds: [],
      runTime: now,
    };

    try {
      console.log(`Running non-checked-out comment marking at ${now}...`);

      const nonCheckedOutEmployeeIds =
        await this.service.getNonCheckoutEmployees();

      if (nonCheckedOutEmployeeIds.length === 0) {
        console.log("No non-checked-out employees found.");
        scheduleReport = {
          log: "No non-checked-out employees found.",
          parent: ScheduleParent.CHECK_OUT,
          status: ScheduleStatus.SUCCESS,
          employeeIds: [],
          runTime: now,
        };
        return;
      }

      // Update attendance records with comment
      const todayEnd = getEndOfDayPakistan(now);
      for (const employeeId of nonCheckedOutEmployeeIds) {
        const attendance = await prisma.attendance.findFirst({
          where: {
            employeeId,
            date: {
              gte: todayDate,
              lte: todayEnd,
            },
            checkOut: null,
            status: "PRESENT",
          },
        });

        if (attendance) {
          await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              comment: "Checked Out not marked",
            },
          });
        }
      }

      scheduleReport = {
        log: `Successfully added comments for ${nonCheckedOutEmployeeIds.length} non-checked-out employees.`,
        parent: ScheduleParent.CHECK_OUT,
        status: ScheduleStatus.SUCCESS,
        employeeIds: nonCheckedOutEmployeeIds,
        runTime: now,
      };
    } catch (error) {
      console.log("Error Marking Check outs", error);
    }

    await this.attendanceSchedulerService.createAttendanceSchedule(
      scheduleReport
    );
  }
}

export default new AttendanceSchedulerHelper();
