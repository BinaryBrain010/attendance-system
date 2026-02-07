export interface SystemConfigData {
  /** Display name of the system (e.g. "Results management") */
  systemName: string;
  /** Base URL / address of the system (e.g. "https://app.example.com") */
  systemAddress: string;
  /** Default calendar type for leave/reports (e.g. "Annual") */
  defaultCalendar: string;
  /** Default home screen after login (e.g. "Individual dashboard", "Analytics") */
  homeScreen: string;
  /** Logo image URL or path (optional) */
  logoUrl: string;
  /** Minutes after shift start before marking as LATE (e.g. 20) */
  lateGraceMinutes: number;
  /** Hour (0-23) when absent marking job runs (e.g. 23 = 11 PM) */
  absentMarkingHour: number;
  /** Minute (0-59) when absent marking job runs (e.g. 55) */
  absentMarkingMinute: number;
  /** Minutes before shift end that early check-out is allowed without penalty (e.g. 5) */
  earlyCheckOutGraceMinutes: number;
  /** Whether to require check-out; if true, comment added when missing */
  requireCheckOut: boolean;
  /** Timezone for attendance (e.g. "Asia/Karachi") */
  timezone: string;
  /** Hours worked below this count as half-day (e.g. 4) */
  halfDayThresholdHours: number;
  /** Day of week for weekly holiday (0 = Sunday, 1 = Monday, ... 6 = Saturday) */
  weeklyHolidayDay: number;
  /** Whether to auto-mark Sundays as holiday */
  autoMarkSundaysAsHoliday: boolean;
  /** Max minutes after shift end to allow check-out without "forgot to check out" comment */
  checkOutReminderAfterShiftMinutes: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfigData = {
  systemName: "Quick Mark",
  systemAddress: "",
  defaultCalendar: "Annual",
  homeScreen: "Individual dashboard",
  logoUrl: "",
  lateGraceMinutes: 20,
  absentMarkingHour: 23,
  absentMarkingMinute: 55,
  earlyCheckOutGraceMinutes: 5,
  requireCheckOut: true,
  timezone: "Asia/Karachi",
  halfDayThresholdHours: 4,
  weeklyHolidayDay: 0, // Sunday
  autoMarkSundaysAsHoliday: false,
  checkOutReminderAfterShiftMinutes: 60,
};
