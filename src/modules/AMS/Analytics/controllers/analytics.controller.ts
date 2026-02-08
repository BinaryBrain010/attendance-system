import { Request, Response } from "express";
import { ApiResponse } from "../../../../core/utils/response.util";
import personalAttendanceAnalyticsService from "../services/personalAttendanceAnalytics.service";

const ATTENDANCE_READ_FEATURE = "attendance.read.*";

async function checkAttendanceReadPermission(req: Request): Promise<boolean> {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) return false;
  try {
    const accessModel = (await import("../../../rbac/Access/models/access.model")).default;
    return await accessModel.user.checkUserPermission(userId, ATTENDANCE_READ_FEATURE);
  } catch {
    return false;
  }
}

class AnalyticsController {
  async getPersonalAttendanceAnalytics(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized", statusCode: 401 });
    }
    const year = req.query.year != null ? parseInt(String(req.query.year), 10) : undefined;
    const month = req.query.month != null ? parseInt(String(req.query.month), 10) : undefined;
    const options = (year != null && !isNaN(year) && month != null && !isNaN(month))
      ? { year, month }
      : undefined;

    try {
      const data = await personalAttendanceAnalyticsService.getPersonalAttendanceAnalytics(userId, options);
      if (data === null) {
        const now = new Date();
        const monthLabels = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return ApiResponse.success(res, {
          employeeId: null,
          employeeName: null,
          today: null,
          averages: {
            averageHours: "0h 0mins",
            averageCheckIn: "—",
            averageCheckOut: "—",
            onTimeArrivalPercent: 0,
          },
          myAttendance: {
            onTime: 0,
            workFromHome: 0,
            late: 0,
            absent: 0,
            total: 0,
            max: 1500,
          },
          performanceBetterThanPercent: 0,
          pendingLeaveRequests: 0,
          monthly: {
            year: options?.year ?? now.getFullYear(),
            month: options?.month ?? now.getMonth(),
            monthLabel: `${monthLabels[options?.month ?? now.getMonth()]} ${options?.year ?? now.getFullYear()}`,
            present: 0,
            absent: 0,
            late: 0,
            onLeave: 0,
            onTime: 0,
            workFromHome: 0,
          },
          last7DaysCheckInOut: [],
        }, "Personal attendance analytics (no linked employee).");
      }
      return ApiResponse.success(res, data, "Personal attendance analytics retrieved successfully.");
    } catch (error) {
      console.error("Error fetching personal attendance analytics:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch analytics",
        statusCode: 500,
      });
    }
  }

  async getTopAttendanceUsers(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized", statusCode: 401 });
    }
    const hasPermission = await checkAttendanceReadPermission(req);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to read attendance.",
        statusCode: 403,
      });
    }
    const year = req.query.year != null ? parseInt(String(req.query.year), 10) : undefined;
    const options = year != null && !isNaN(year) ? { year } : undefined;
    try {
      const data = await personalAttendanceAnalyticsService.getTopAttendanceUsers(options?.year);
      return ApiResponse.success(res, data, "Top attendance users retrieved successfully.");
    } catch (error) {
      console.error("Error fetching top attendance users:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch top attendance users",
        statusCode: 500,
      });
    }
  }
}

export default new AnalyticsController();
