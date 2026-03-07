import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import SystemConfigService from "../services/systemConfig.service";

/** Transaction-like client with shiftAssignment (from prisma.$transaction or extended client). */
type TransactionClient = { shiftAssignment: { findFirst: (args: any) => Promise<any> } };

/**
 * Build a moment on the attendance date at the given time-of-day, in the system timezone.
 * Fixes LATE/PRESENT by using the same calendar day as attendance (e.g. Pakistan) instead of UTC day.
 */
async function buildMomentOnDateInTimezone(
  date: Date,
  timeOfDay: Date,
  timezone: string
): Promise<Date> {
  const y = parseInt(formatInTimeZone(date, timezone, "yyyy"), 10);
  const month = parseInt(formatInTimeZone(date, timezone, "MM"), 10) - 1;
  const d = parseInt(formatInTimeZone(date, timezone, "dd"), 10);
  const zoned = toZonedTime(timeOfDay, timezone);
  const h = zoned.getHours();
  const min = zoned.getMinutes();
  const sec = zoned.getSeconds();
  // Interpret (y, month, d, h, min, sec) as local time in timezone -> UTC
  return fromZonedTime(new Date(y, month, d, h, min, sec, 0), timezone);
}

/**
 * Get employee's shift start time on the attendance date (in system timezone).
 * Uses ShiftAssignment (startDate <= date <= endDate) and Shift.startTime.
 * Shift time is interpreted in the system timezone (e.g. Asia/Karachi) so 10:00 = 10 AM on that day.
 */
async function getShiftStartOnDate(
  tx: TransactionClient,
  employeeId: string,
  date: Date
): Promise<Date | null> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const assignment = await tx.shiftAssignment.findFirst({
    where: {
      employeeId,
      isDeleted: null,
      shift: { isDeleted: null },
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    include: { shift: true },
  });

  if (!assignment?.shift) return null;

  const config = await SystemConfigService.getConfig();
  const timezone = config.timezone ?? "Asia/Karachi";
  const shiftStartTime = new Date(assignment.shift.startTime);
  return buildMomentOnDateInTimezone(date, shiftStartTime, timezone);
}

/**
 * Get employee's shift end time on the attendance date (in system timezone).
 * Uses ShiftAssignment and Shift.endTime for that day.
 */
export async function getShiftEndOnDate(
  tx: TransactionClient,
  employeeId: string,
  date: Date
): Promise<Date | null> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const assignment = await tx.shiftAssignment.findFirst({
    where: {
      employeeId,
      isDeleted: null,
      shift: { isDeleted: null },
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    include: { shift: true },
  });

  if (!assignment?.shift) return null;

  const config = await SystemConfigService.getConfig();
  const timezone = config.timezone ?? "Asia/Karachi";
  const shiftEndTime = new Date(assignment.shift.endTime);
  return buildMomentOnDateInTimezone(date, shiftEndTime, timezone);
}

/**
 * Get the shift end datetime for absent-marking: only consider an employee's
 * shift "ended" when current time is past this. Handles overnight shifts
 * (e.g. 22:00–06:00): if we're before today's shift start, the relevant end
 * is today at endTime; if we're on or after today's shift start, the relevant
 * end is tomorrow at endTime so we don't mark absent mid-shift.
 */
export async function getShiftEndForAbsentCheck(
  tx: TransactionClient,
  employeeId: string,
  todayDate: Date,
  now: Date
): Promise<Date | null> {
  const dayStart = new Date(todayDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(todayDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const assignment = await tx.shiftAssignment.findFirst({
    where: {
      employeeId,
      isDeleted: null,
      shift: { isDeleted: null },
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    include: { shift: true },
  });

  if (!assignment?.shift) return null;

  const config = await SystemConfigService.getConfig();
  const timezone = config.timezone ?? "Asia/Karachi";
  const shiftStartTime = new Date(assignment.shift.startTime);
  const shiftEndTime = new Date(assignment.shift.endTime);
  const startOnDay = await buildMomentOnDateInTimezone(todayDate, shiftStartTime, timezone);
  const endOnDay = await buildMomentOnDateInTimezone(todayDate, shiftEndTime, timezone);

  const isOvernight = endOnDay.getTime() <= startOnDay.getTime();

  if (!isOvernight) {
    return endOnDay;
  }

  if (now.getTime() < startOnDay.getTime()) {
    return endOnDay;
  }

  const tomorrow = new Date(todayDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const endTomorrow = await buildMomentOnDateInTimezone(tomorrow, shiftEndTime, timezone);
  return endTomorrow;
}

/**
 * Resolve effective attendance status (PRESENT vs LATE) based on check-in time,
 * employee's shift start, and system config lateGraceMinutes.
 */
export async function getEffectiveStatusForCheckIn(
  tx: TransactionClient,
  employeeId: string,
  date: Date,
  checkInTime: Date
): Promise<"PRESENT" | "LATE"> {
  const shiftStart = await getShiftStartOnDate(tx, employeeId, date);
  if (!shiftStart) return "PRESENT";

  const lateGraceMinutes = await SystemConfigService.getLateGraceMinutes();
  const lateThreshold = new Date(shiftStart.getTime() + lateGraceMinutes * 60 * 1000);

  return checkInTime > lateThreshold ? "LATE" : "PRESENT";
}
