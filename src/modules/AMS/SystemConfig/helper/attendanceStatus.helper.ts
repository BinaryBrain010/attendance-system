import SystemConfigService from "../services/systemConfig.service";

/** Transaction-like client with shiftAssignment (from prisma.$transaction or extended client). */
type TransactionClient = { shiftAssignment: { findFirst: (args: any) => Promise<any> } };

/**
 * Get employee's shift start time on a given date (in local date terms).
 * Uses ShiftAssignment (startDate <= date <= endDate) and Shift.startTime.
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

  const shiftStart = new Date(assignment.shift.startTime);
  const startOnDay = new Date(date);
  startOnDay.setUTCHours(shiftStart.getUTCHours(), shiftStart.getUTCMinutes(), 0, 0);

  return startOnDay;
}

/**
 * Get employee's shift end time on a given date.
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

  const shiftEnd = new Date(assignment.shift.endTime);
  const endOnDay = new Date(date);
  endOnDay.setUTCHours(shiftEnd.getUTCHours(), shiftEnd.getUTCMinutes(), 0, 0);

  return endOnDay;
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

  const shiftStart = new Date(assignment.shift.startTime);
  const shiftEnd = new Date(assignment.shift.endTime);
  const startOnDay = new Date(todayDate);
  startOnDay.setUTCHours(shiftStart.getUTCHours(), shiftStart.getUTCMinutes(), 0, 0);
  const endOnDay = new Date(todayDate);
  endOnDay.setUTCHours(shiftEnd.getUTCHours(), shiftEnd.getUTCMinutes(), 0, 0);

  const isOvernight = endOnDay.getTime() <= startOnDay.getTime();

  if (!isOvernight) {
    return endOnDay;
  }

  if (now.getTime() < startOnDay.getTime()) {
    return endOnDay;
  }

  const tomorrow = new Date(todayDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const endTomorrow = new Date(tomorrow);
  endTomorrow.setUTCHours(shiftEnd.getUTCHours(), shiftEnd.getUTCMinutes(), 0, 0);
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
