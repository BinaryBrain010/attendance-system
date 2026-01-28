import unitModel from "../models/unit.model";
import { Unit } from "../types/unit";
import { paginatedData } from "../../../../types/paginatedData";
import prisma from "../../../../core/models/base.model";
import unitEmployeeModel from "../models/unitEmployee.model";
import { formatInTimeZone } from 'date-fns-tz';
import { AttendanceStatus } from "@prisma/client";

const PAKISTAN_TIMEZONE = 'Asia/Karachi';

function getStartOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return startOfDay;
}

function getEndOfDayPakistan(date: Date): Date {
  const year = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'yyyy'));
  const month = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'MM')) - 1;
  const day = parseInt(formatInTimeZone(date, PAKISTAN_TIMEZONE, 'dd'));
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  return endOfDay;
}

interface UnitAttendanceFilters {
  from?: Date | string;
  to?: Date | string;
  status?: AttendanceStatus;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

class UnitService {
  async getAllUnits(): Promise<Unit[]> {
    return await unitModel.unit.gpFindMany();
  }

  async getUnits(page: number, pageSize: number): Promise<paginatedData> {
    return await unitModel.unit.gpPgFindMany(page, pageSize);
  }

  async getDeletedUnits(page: number, pageSize: number): Promise<paginatedData> {
    return await unitModel.unit.gpPgFindDeletedMany(page, pageSize);
  }

  async createUnit(unitData: Unit | Unit[]): Promise<Unit | Unit[]> {
    if (Array.isArray(unitData)) {
      return await Promise.all(
        unitData.map((unit) => unitModel.unit.gpCreate(unit))
      );
    }
    return await unitModel.unit.gpCreate(unitData);
  }

  async updateUnit(unitId: string, unitData: Unit): Promise<Unit> {
    return await unitModel.unit.gpUpdate(unitId, unitData);
  }

  async deleteUnit(unitId: string): Promise<void> {
    await unitModel.unit.gpSoftDelete(unitId);
  }

  async restoreUnit(unitId: string): Promise<void> {
    await unitModel.unit.gpRestore(unitId);
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    return await unitModel.unit.gpFindById(unitId);
  }

  async getTotalUnits(): Promise<number> {
    return await unitModel.unit.gpCount();
  }

  async searchUnits(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await unitModel.unit.gpSearch(searchTerm, page, pageSize);
  }

  async getHistoryById(unitId: string, filter?: boolean, date?: string): Promise<any> {
    return await unitModel.unit.getHistoryById(unitId, filter, date);
  }

  async getUnitAttendanceAndStats(unitId: string, filters?: UnitAttendanceFilters): Promise<any> {
    // Get all employees in the unit
    const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getEmployeesByUnitId(unitId);
    const employeeIds = unitEmployees.map((ue: any) => ue.employee?.id).filter((id: string) => id);

    if (employeeIds.length === 0) {
      return {
        attendance: { data: [], totalSize: 0 },
        stats: {
          totalEmployees: 0,
          totalAttendance: 0,
          byStatus: {
            PRESENT: 0,
            ABSENT: 0,
            ON_LEAVE: 0,
            LATE: 0,
            HALF_DAY: 0,
          },
          dateRange: {
            from: filters?.from || null,
            to: filters?.to || null,
          }
        }
      };
    }

    // Parse date filters
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (filters?.from) {
      fromDate = filters.from instanceof Date ? filters.from : new Date(filters.from);
      fromDate = getStartOfDayPakistan(fromDate);
    } else {
      // Default to start of current month
      const now = new Date();
      const nowInPakistan = formatInTimeZone(now, PAKISTAN_TIMEZONE, 'yyyy-MM-dd');
      const [year, month] = nowInPakistan.split('-').map(Number);
      fromDate = getStartOfDayPakistan(new Date(Date.UTC(year, month - 1, 1)));
    }

    if (filters?.to) {
      toDate = filters.to instanceof Date ? filters.to : new Date(filters.to);
      toDate = getEndOfDayPakistan(toDate);
    } else {
      // Default to end of today
      toDate = getEndOfDayPakistan(new Date());
    }

    // Build WHERE clause for attendance query
    let whereClause = 'WHERE a."employeeId" IN (';
    whereClause += employeeIds.map((id: string, index: number) => `$${index + 1}`).join(', ');
    whereClause += ')';
    whereClause += ` AND a."isDeleted" IS NULL`;
    whereClause += ` AND a.date >= $${employeeIds.length + 1}`;
    whereClause += ` AND a.date <= $${employeeIds.length + 2}`;

    const params: any[] = [...employeeIds, fromDate, toDate];
    let paramIndex = employeeIds.length + 3;

    if (filters?.status) {
      whereClause += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.employeeId) {
      whereClause += ` AND a."employeeId" = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    // Get paginated attendance data
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const attendanceData = await prisma.$queryRawUnsafe(`
      SELECT 
        a.*,
        e.code AS "employeeCode",
        e."name" AS "employeeName",
        e."surname" AS "employeeSurname",
        e."designation",
        e."department",
        e."contactNo",
        e.image AS "employeeImage",
        e.status AS "employeeStatus"
      FROM "Attendance" a
      LEFT JOIN "Employee" e ON a."employeeId" = e.id
      ${whereClause}
      ORDER BY a.date DESC, e."name" ASC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `, ...params, pageSize, skip) as any[];

    const totalSizeResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "Attendance" a
      ${whereClause}
    `, ...params) as any[];

    const totalSize = totalSizeResult[0]?.count || 0;

    // Get statistics - use same params structure
    let statsWhereClause = 'WHERE a."employeeId" IN (';
    statsWhereClause += employeeIds.map((id: string, index: number) => `$${index + 1}`).join(', ');
    statsWhereClause += ')';
    statsWhereClause += ` AND a."isDeleted" IS NULL`;
    statsWhereClause += ` AND a.date >= $${employeeIds.length + 1}`;
    statsWhereClause += ` AND a.date <= $${employeeIds.length + 2}`;

    const statsParams: any[] = [...employeeIds, fromDate, toDate];

    const statsData = await prisma.$queryRawUnsafe(`
      SELECT 
        a.status,
        COUNT(*)::int AS count
      FROM "Attendance" a
      ${statsWhereClause}
      GROUP BY a.status
    `, ...statsParams) as Array<{ status: string; count: number }>;

    // Build stats object
    const statsByStatus: Record<string, number> = {
      PRESENT: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
      LATE: 0,
      HALF_DAY: 0,
    };

    statsData.forEach((item) => {
      if (item.status in statsByStatus) {
        statsByStatus[item.status as keyof typeof statsByStatus] = item.count;
      }
    });

    const totalAttendance = statsData.reduce((sum, item) => sum + item.count, 0);

    return {
      attendance: {
        data: attendanceData,
        totalSize,
        page,
        pageSize,
      },
      stats: {
        totalEmployees: employeeIds.length,
        totalAttendance,
        byStatus: statsByStatus,
        dateRange: {
          from: fromDate,
          to: toDate,
        },
      },
    };
  }
}

export default UnitService;
