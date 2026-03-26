import schedule from "node-schedule";
import prisma from "../../../../core/models/base.model";
import AttendanceScheduleService from "../services/schedule.service";
import { Attendance } from "../types/Attendance";
import { AttendanceScheduler } from "../types/schedule";
import {
  AttendanceStatus,
  ScheduleParent,
  ScheduleStatus,
} from "@prisma/client";
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

class AttendanceSchedulerHelper {
  private service: AttendanceScheduleService = new AttendanceScheduleService();
  private attendanceService: AttendanceService = new AttendanceService();
  private attendanceSchedulerService: AttendanceScheduleService =
    new AttendanceScheduleService();
  private attendanceSchedule: schedule.Job;
  constructor() {
    this.attendanceSchedule = schedule.scheduleJob(
      "*/1 * * * *", // Runs every minute
      this.cleanup.bind(this)
    );
  }

  private async cleanup() {
    await this.absentMarking();
  }

  private async absentMarking() {
    const now = getCurrentTimeInPST();
    const todayDate = getStartOfDayPakistan(now); // Start of the day in Pakistan timezone

    try {
      const { default: SystemConfigService } = await import('../../SystemConfig/services/systemConfig.service');
      const { getShiftEndForAbsentCheck } = await import('../../SystemConfig/helper/attendanceStatus.helper');
      const { hour: configHour, minute: configMinute } = await SystemConfigService.getAbsentMarkingTime();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const absentsMarked =
        await this.attendanceSchedulerService.isTodaysAttendanceMarked();

      if (!absentsMarked) {
        if (hour === configHour && minutes >= configMinute) {
          console.log(
            `Running absent marking at configured time (${configHour}:${String(configMinute).padStart(2, '0')}). Now: ${now}...`
          );

          const nonMarked = await this.service.getNonMarkedEmployees();
          const data: string[] = [];
          for (const employeeId of nonMarked) {
            const shiftEnd = await getShiftEndForAbsentCheck(prisma, employeeId, todayDate, now);
            if (shiftEnd === null) {
              data.push(employeeId);
            } else if (now.getTime() >= shiftEnd.getTime()) {
              data.push(employeeId);
            }
          }
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
            `Absent marking skipped. Current time is outside configured absent marking time (${configHour}:${String(configMinute).padStart(2, '0')}). Now: ${now}`
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
}

export default new AttendanceSchedulerHelper();
