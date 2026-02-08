import prisma from "../../../../core/models/base.model";

export interface PersonalAttendanceAnalytics {
  employeeId: string | null;
  employeeName: string | null;
  today: {
    status: "present" | "absent" | "late" | "on_leave" | "half_day" | "holidays";
    message: string;
    inOfficePercent: number;
    timeLeftSeconds: number | null;
    checkIn: string | null;
    checkOut: string | null;
  } | null;
  averages: {
    averageHours: string;
    averageCheckIn: string;
    averageCheckOut: string;
    onTimeArrivalPercent: number;
  };
  myAttendance: {
    onTime: number;
    workFromHome: number;
    late: number;
    absent: number;
    total: number;
    max: number;
  };
  performanceBetterThanPercent: number;
  pendingLeaveRequests: number;
  /** Stats for the selected month (present = onTime, absent, late, onLeave = workFromHome). */
  monthly: {
    year: number;
    month: number;
    monthLabel: string;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    onTime: number;
    workFromHome: number;
  };
  /** Last 7 days (including today) with check-in and check-out for chart. */
  last7DaysCheckInOut: { date: string; checkIn: string | null; checkOut: string | null }[];
}

export class PersonalAttendanceAnalyticsService {
  async getPersonalAttendanceAnalytics(
    userId: string,
    options?: { year?: number; month?: number }
  ): Promise<PersonalAttendanceAnalytics | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    if (!user?.employeeId) return null;

    const employeeId = user.employeeId;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, isDeleted: null },
      select: { name: true, surname: true },
    });
    const employeeName = employee ? `${employee.name} ${employee.surname}`.trim() : null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const sevenDaysAgoStart = new Date(now);
    sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 6);
    sevenDaysAgoStart.setHours(0, 0, 0, 0);

    const selectedYear = options?.year ?? now.getFullYear();
    const selectedMonth = options?.month ?? now.getMonth();
    const monthStart = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    const monthLabels = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthLabel = `${monthLabels[selectedMonth]} ${selectedYear}`;

    const [
      todayAttendance,
      allAttendances,
      attendanceByStatus,
      attendanceByStatusMonth,
      pendingLeaveCount,
      totalEmployeesWithAttendance,
      onTimeCountsByEmployee,
      last7DaysAttendances,
    ] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
          isDeleted: null,
        },
        select: { status: true, checkIn: true, checkOut: true },
      }),
      prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: oneYearAgo, lte: now },
          isDeleted: null,
          checkIn: { not: null },
          checkOut: { not: null },
        },
        select: { checkIn: true, checkOut: true, status: true },
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          employeeId,
          date: { gte: oneYearAgo, lte: now },
          isDeleted: null,
        },
        _count: { status: true },
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          isDeleted: null,
        },
        _count: { status: true },
      }),
      prisma.leaveRequest.count({
        where: {
          employeeId,
          status: "PENDING",
          isDeleted: null,
        },
      }),
      prisma.attendance.groupBy({
        by: ["employeeId"],
        where: {
          date: { gte: oneYearAgo, lte: now },
          isDeleted: null,
        },
        _count: { employeeId: true },
      }),
      prisma.attendance.groupBy({
        by: ["employeeId", "status"],
        where: {
          date: { gte: oneYearAgo, lte: now },
          isDeleted: null,
          status: { in: ["PRESENT", "LATE"] },
        },
        _count: { status: true },
      }),
      prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: sevenDaysAgoStart, lte: todayEnd },
          isDeleted: null,
        },
        select: { date: true, checkIn: true, checkOut: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    attendanceByStatus.forEach((item) => {
      statusCounts[item.status] = item._count.status;
    });
    const onTime = statusCounts["PRESENT"] ?? 0;
    const late = statusCounts["LATE"] ?? 0;
    const absent = statusCounts["ABSENT"] ?? 0;
    const workFromHome = statusCounts["ON_LEAVE"] ?? 0;
    const total = onTime + late + absent + workFromHome + (statusCounts["HALF_DAY"] ?? 0) + (statusCounts["HOLIDAYS"] ?? 0);
    const max = Math.max(total, 1500);

    let averageHours = "0h 0mins";
    let averageCheckIn = "—";
    let averageCheckOut = "—";
    if (allAttendances.length > 0) {
      let totalMinutes = 0;
      const checkIns: Date[] = [];
      const checkOuts: Date[] = [];
      allAttendances.forEach((a) => {
        if (a.checkIn && a.checkOut) {
          totalMinutes += (new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / (1000 * 60);
          checkIns.push(new Date(a.checkIn));
          checkOuts.push(new Date(a.checkOut));
        }
      });
      if (allAttendances.length > 0) {
        const avgMins = totalMinutes / allAttendances.length;
        const h = Math.floor(avgMins / 60);
        const m = Math.round(avgMins % 60);
        averageHours = `${h}h ${m}mins`;
      }
      if (checkIns.length > 0) {
        const avgCheckInMs = checkIns.reduce((s, d) => s + d.getTime(), 0) / checkIns.length;
        averageCheckIn = new Date(avgCheckInMs).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
      if (checkOuts.length > 0) {
        const avgCheckOutMs = checkOuts.reduce((s, d) => s + d.getTime(), 0) / checkOuts.length;
        averageCheckOut = new Date(avgCheckOutMs).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
    }

    const presentPlusLate = onTime + late;
    const onTimeArrivalPercent = presentPlusLate > 0 ? Math.round((onTime / presentPlusLate) * 10000) / 100 : 100;

    const employeeOnTimeRate = presentPlusLate > 0 ? onTime / presentPlusLate : 1;
    const employeeRates: { employeeId: string; rate: number }[] = [];
    const byEmployee = new Map<string, { present: number; late: number }>();
    onTimeCountsByEmployee.forEach((row) => {
      const key = row.employeeId;
      if (!byEmployee.has(key)) byEmployee.set(key, { present: 0, late: 0 });
      const v = byEmployee.get(key)!;
      if (row.status === "PRESENT") v.present = row._count.status;
      else v.late = row._count.status;
    });
    byEmployee.forEach((v, employeeId) => {
      const sum = v.present + v.late;
      employeeRates.push({ employeeId, rate: sum > 0 ? v.present / sum : 1 });
    });
    employeeRates.sort((a, b) => a.rate - b.rate);
    const rank = employeeRates.findIndex((r) => r.employeeId === employeeId);
    // "Better than X% employees" = percentage of employees with lower on-time rate than this employee
    const performanceBetterThanPercent =
      employeeRates.length <= 1
        ? 100
        : rank < 0
          ? 50
          : Math.round((rank / employeeRates.length) * 10000) / 100;

    let timeLeftSeconds: number | null = null;
    if (!todayAttendance) {
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const secs = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
      timeLeftSeconds = secs;
    }

    const todayStatus = todayAttendance
      ? (todayAttendance.status.toLowerCase() as PersonalAttendanceAnalytics["today"] extends { status: infer S } ? S : never)
      : "absent";
    const todayMessage = todayAttendance
      ? `You have marked yourself as ${todayAttendance.status.toLowerCase().replace("_", " ")} today.`
      : "You have not marked yourself as present today!";

    const workingDaysInYear = 260;
    const inOfficePercent = total > 0 ? Math.round((onTime / Math.min(total, workingDaysInYear)) * 10000) / 100 : 0;

    const monthStatusCounts: Record<string, number> = {};
    attendanceByStatusMonth.forEach((item) => {
      monthStatusCounts[item.status] = item._count.status;
    });
    const monthlyPresent = monthStatusCounts["PRESENT"] ?? 0;
    const monthlyLate = monthStatusCounts["LATE"] ?? 0;
    const monthlyAbsent = monthStatusCounts["ABSENT"] ?? 0;
    const monthlyOnLeave = monthStatusCounts["ON_LEAVE"] ?? 0;

    return {
      employeeId,
      employeeName,
      today: {
        status: todayStatus,
        message: todayMessage,
        inOfficePercent: Math.min(100, inOfficePercent),
        timeLeftSeconds,
        checkIn: todayAttendance?.checkIn ? new Date(todayAttendance.checkIn).toISOString() : null,
        checkOut: todayAttendance?.checkOut ? new Date(todayAttendance.checkOut).toISOString() : null,
      },
      averages: {
        averageHours,
        averageCheckIn,
        averageCheckOut,
        onTimeArrivalPercent,
      },
      myAttendance: {
        onTime,
        workFromHome,
        late,
        absent,
        total,
        max,
      },
      performanceBetterThanPercent,
      pendingLeaveRequests: pendingLeaveCount,
      monthly: {
        year: selectedYear,
        month: selectedMonth,
        monthLabel,
        present: monthlyPresent,
        absent: monthlyAbsent,
        late: monthlyLate,
        onLeave: monthlyOnLeave,
        onTime: monthlyPresent,
        workFromHome: monthlyOnLeave,
      },
      last7DaysCheckInOut: (() => {
        const byDate = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
        last7DaysAttendances.forEach((a) => {
          const d = new Date(a.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          byDate.set(key, {
            checkIn: a.checkIn ? new Date(a.checkIn) : null,
            checkOut: a.checkOut ? new Date(a.checkOut) : null,
          });
        });
        const out: { date: string; checkIn: string | null; checkOut: string | null }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgoStart);
          d.setDate(d.getDate() + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const rec = byDate.get(key);
          out.push({
            date: key,
            checkIn: rec?.checkIn ? rec.checkIn.toISOString() : null,
            checkOut: rec?.checkOut ? rec.checkOut.toISOString() : null,
          });
        }
        return out;
      })(),
    };
  }

  /**
   * Top 5 employees by attendance % for a given year.
   * attendance % = (present / total recorded days) * 100, where total = present + late + absent + on_leave + half_day + holidays.
   * So someone with 5 present and 10 absent gets 5/15 ≈ 33.33%, not 100%.
   */
  async getTopAttendanceUsers(year?: number): Promise<{ employeeId: string; employeeName: string; attendancePercent: number; onTime: number; late: number; absent: number; total: number }[]> {
    const targetYear = year ?? new Date().getFullYear();
    const yearStart = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const attendanceByEmployee = await prisma.attendance.groupBy({
      by: ["employeeId", "status"],
      where: {
        date: { gte: yearStart, lte: yearEnd },
        isDeleted: null,
      },
      _count: { status: true },
    });

    const byEmployee = new Map<string, { present: number; late: number; absent: number; total: number }>();
    attendanceByEmployee.forEach((row) => {
      const key = row.employeeId;
      if (!byEmployee.has(key)) byEmployee.set(key, { present: 0, late: 0, absent: 0, total: 0 });
      const v = byEmployee.get(key)!;
      const count = row._count.status;
      v.total += count;
      if (row.status === "PRESENT") v.present += count;
      else if (row.status === "LATE") v.late += count;
      else if (row.status === "ABSENT") v.absent += count;
    });

    const employeeIds = Array.from(byEmployee.keys());
    if (employeeIds.length === 0) return [];

    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, isDeleted: null },
      select: { id: true, name: true, surname: true },
    });
    const nameById = new Map(employees.map((e) => [e.id, `${e.name} ${e.surname}`.trim()]));

    const list: { employeeId: string; employeeName: string; attendancePercent: number; onTime: number; late: number; absent: number; total: number }[] = [];
    byEmployee.forEach((v, employeeId) => {
      if (v.total === 0) return;
      const attendancePercent = Math.round((v.present / v.total) * 10000) / 100;
      list.push({
        employeeId,
        employeeName: nameById.get(employeeId) ?? "Unknown",
        attendancePercent,
        onTime: v.present,
        late: v.late,
        absent: v.absent,
        total: v.total,
      });
    });

    list.sort((a, b) => b.attendancePercent - a.attendancePercent);
    return list.slice(0, 5);
  }
}

export default new PersonalAttendanceAnalyticsService();
