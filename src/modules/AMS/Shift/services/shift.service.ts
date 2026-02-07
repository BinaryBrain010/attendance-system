import prisma from "../../../../core/models/base.model";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import shiftModel from "../models/shift.model";
import { paginatedData } from "../../../../types/paginatedData";
import { Shift, ShiftAssignmentPayload, ShiftTimetableBlockPayload, ShiftTimetablePayload } from "../types/shift";

class ShiftService {
  private normalizeShiftCreateData(input: any) {
    const data = { ...input };

    if (data.startTime && !(data.startTime instanceof Date)) {
      data.startTime = new Date(data.startTime);
    }
    if (data.endTime && !(data.endTime instanceof Date)) {
      data.endTime = new Date(data.endTime);
    }

    return data;
  }

  private async ensureDefaultTimetableForShift(shiftId: string, startTime: Date, endTime: Date): Promise<void> {
    const shiftTimetableClient = (prisma as any).shiftTimetable;
    if (!shiftId || !startTime || !endTime) {
      return;
    }

    const days = [1, 2, 3, 4, 5, 6];

    // Prefer Prisma Client if available
    if (shiftTimetableClient?.createMany) {
      const data = days.map((dayOfWeek) => ({
        shiftId,
        dayOfWeek,
        startTime,
        endTime,
        createdAt: new Date(),
      }));

      await shiftTimetableClient.createMany({
        data,
        skipDuplicates: true,
      });
      return;
    }

    // Fallback: raw SQL insert (works even if ShiftTimetable model isn't generated in Prisma Client)
    // Generate UUIDs in Node to avoid requiring pgcrypto (gen_random_uuid)
    const values = days.map((dayOfWeek) =>
      Prisma.sql`(${randomUUID()}, ${shiftId}, ${dayOfWeek}, ${startTime}, ${endTime}, NOW())`
    );

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "ShiftTimetable" ("id", "shiftId", "dayOfWeek", "startTime", "endTime", "createdAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("shiftId", "dayOfWeek") DO NOTHING;
      `
    );
  }
  async getAllShifts(): Promise<any[]> {
    return await shiftModel.shift.gpFindMany();
  }

  async getShifts(page: number, pageSize: number): Promise<paginatedData> {
    return await shiftModel.shift.gpPgFindMany(page, pageSize);
  }

  async getDeletedShifts(page: number, pageSize: number): Promise<paginatedData> {
    return await shiftModel.shift.gpPgFindDeletedMany(page, pageSize);
  }

  async getShiftById(id: string): Promise<any> {
    return await shiftModel.shift.gpFindById(id);
  }

  async getTotalShifts(): Promise<number> {
    return await shiftModel.shift.gpCount();
  }

  async searchShifts(searchTerm: string | string[], page: number, pageSize: number): Promise<paginatedData> {
    return await shiftModel.shift.gpSearch(searchTerm, page, pageSize);
  }

  async createShift(shiftData: Shift | Shift[]): Promise<any> {
    if (Array.isArray(shiftData)) {
      return await Promise.all(
        shiftData.map((s: any) => {
          const { isActive, ...data } = s;
          const normalized = this.normalizeShiftCreateData(data);

          return prisma.shift.gpCreate(normalized as any).then(async (created: any) => {
            const createdId = Array.isArray(created) ? created?.[0]?.id : created?.id;
            if (createdId && normalized.startTime && normalized.endTime) {
              await this.ensureDefaultTimetableForShift(createdId, normalized.startTime, normalized.endTime);
            }
            return created;
          });
        })
      );
    }
    const { isActive, ...data } = shiftData as any;

    const normalized = this.normalizeShiftCreateData(data);
    const created: any = await prisma.shift.gpCreate(normalized as any);
    const createdId = Array.isArray(created) ? created?.[0]?.id : created?.id;
    if (createdId && normalized.startTime && normalized.endTime) {
      await this.ensureDefaultTimetableForShift(createdId, normalized.startTime, normalized.endTime);
    }
    return created;
  }

  async updateShift(id: string, shiftData: Partial<Shift>): Promise<any> {
    const { isActive, ...data } = shiftData as any;
    return await prisma.shift.gpUpdate(id, data);
  }

  async deleteShift(id: string): Promise<void> {
    await prisma.shift.gpSoftDelete(id);
  }

  async restoreShift(id: string): Promise<void> {
    await prisma.shift.gpRestore(id);
  }

  private timeToMinutes(d: Date): number {
    return d.getHours() * 60 + d.getMinutes();
  }

  private dateRangeOverlap(
    startA: Date,
    endA: Date | null,
    startB: Date,
    endB: Date | null
  ): boolean {
    const aEnd = endA || new Date("9999-12-31");
    const bEnd = endB || new Date("9999-12-31");
    return startA < bEnd && startB < aEnd;
  }

  private timeOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    let mA1 = this.timeToMinutes(startA);
    let mA2 = this.timeToMinutes(endA);
    let mB1 = this.timeToMinutes(startB);
    let mB2 = this.timeToMinutes(endB);
    if (mA2 <= mA1) mA2 += 24 * 60;
    if (mB2 <= mB1) mB2 += 24 * 60;
    return mA1 < mB2 && mB1 < mA2;
  }

  async checkAssignmentConflicts(
    shiftId: string,
    startDate: Date,
    endDate: Date | null,
    employeeIds: string[]
  ): Promise<{ conflictingEmployeeIds: string[]; details: { employeeId: string; shiftName: string }[] }> {
    const newShift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!newShift) return { conflictingEmployeeIds: [], details: [] };

    const conflictingEmployeeIds: string[] = [];
    const details: { employeeId: string; shiftName: string }[] = [];

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        isDeleted: null,
        shiftId: { not: shiftId },
      },
      include: { shift: true },
    });

    for (const a of assignments) {
      const assignEnd = a.endDate || new Date("9999-12-31");
      if (!this.dateRangeOverlap(startDate, endDate, a.startDate, a.endDate)) continue;
      if (!this.timeOverlap(newShift.startTime, newShift.endTime, a.shift.startTime, a.shift.endTime)) continue;
      if (!conflictingEmployeeIds.includes(a.employeeId)) {
        conflictingEmployeeIds.push(a.employeeId);
        details.push({ employeeId: a.employeeId, shiftName: a.shift.name });
      }
    }

    return { conflictingEmployeeIds, details };
  }

  async assignToEmployees(
    employeeIds: string[],
    shiftId: string,
    startDate: Date,
    endDate: Date | null
  ): Promise<{ assigned: string[]; skipped: { employeeId: string; reason: string }[] }> {
    const { conflictingEmployeeIds, details } = await this.checkAssignmentConflicts(
      shiftId,
      startDate,
      endDate,
      employeeIds
    );
    const toAssign = employeeIds.filter((id) => !conflictingEmployeeIds.includes(id));
    const assigned: string[] = [];
    const skipped: { employeeId: string; reason: string }[] = conflictingEmployeeIds.map((employeeId) => {
      const d = details.find((x) => x.employeeId === employeeId);
      return { employeeId, reason: d ? `Conflicts with shift: ${d.shiftName}` : "Conflict with existing shift" };
    });

    for (const employeeId of toAssign) {
      await this.assignToEmployee({ employeeId, shiftId, startDate, endDate });
      assigned.push(employeeId);
    }

    return { assigned, skipped };
  }

  // Assignments
  async assignToEmployee(payload: ShiftAssignmentPayload) {
    const startDate = payload.startDate instanceof Date ? payload.startDate : new Date(payload.startDate);
    const endDate = payload.endDate ? (payload.endDate instanceof Date ? payload.endDate : new Date(payload.endDate)) : null;

    const { conflictingEmployeeIds, details } = await this.checkAssignmentConflicts(
      payload.shiftId,
      startDate,
      endDate,
      [payload.employeeId]
    );
    if (conflictingEmployeeIds.length > 0) {
      const d = details[0];
      throw new Error(d ? `Employee has conflicting shift "${d.shiftName}" for this date range` : "Employee has conflicting shift for this date range");
    }

    return await prisma.shiftAssignment.upsert({
      where: {
        employeeId_shiftId_startDate: {
          employeeId: payload.employeeId,
          shiftId: payload.shiftId,
          startDate,
        },
      },
      create: {
        employeeId: payload.employeeId,
        shiftId: payload.shiftId,
        startDate,
        endDate,
        createdAt: new Date(),
      },
      update: {
        endDate,
        isDeleted: null,
        updatedAt: new Date(),
      },
    });
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    await shiftModel.shiftAssignment.softDeleteById(assignmentId);
  }

  async getAssignedEmployeesOfShift(shiftId: string) {
    return await shiftModel.shiftAssignment.getAssignedEmployeesByShiftId(shiftId);
  }

  async getAssignmentsByEmployeeId(employeeId: string): Promise<any[]> {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { employeeId, isDeleted: null },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            description: true,
          },
        },
      },
      orderBy: [{ startDate: "desc" }],
    });

    const result = await Promise.all(
      assignments.map(async (a) => {
        const timetableBlocks = await this.getTimetableBlocks(a.shiftId);
        const timetable = await this.getTimetableByShiftId(a.shiftId);
        return {
          id: a.id,
          startDate: a.startDate,
          endDate: a.endDate,
          shift: a.shift,
          timetableBlocks: timetableBlocks || [],
          timetable: timetable || [],
        };
      })
    );
    return result;
  }

  async assignToUnit(unitId: string, shiftId: string, startDate: Date, endDate?: Date | null) {
    const unitEmployees = await prisma.unitEmployee.findMany({
      where: {
        unitId,
        isDeleted: null,
      },
      select: { employeeId: true },
    });

    const employeeIds = unitEmployees.map((ue) => ue.employeeId);
    const { assigned, skipped } = await this.assignToEmployees(employeeIds, shiftId, startDate, endDate ?? null);

    return { assignedCount: assigned.length, skippedCount: skipped.length, assigned, skipped };
  }

  // Timetables
  async getTimetableByShiftId(shiftId: string) {
    const shiftTimetableClient = (prisma as any).shiftTimetable;
    if (shiftTimetableClient?.findMany) {
      return await shiftTimetableClient.findMany({
        where: { shiftId, isDeleted: null },
        orderBy: { dayOfWeek: "asc" },
      });
    }

    // Fallback: raw SQL read
    const rows: any[] = await prisma.$queryRaw(
      Prisma.sql`
        SELECT "id", "shiftId", "dayOfWeek", "startTime", "endTime", "createdAt", "updatedAt", "isDeleted"
        FROM "ShiftTimetable"
        WHERE "shiftId" = ${shiftId} AND "isDeleted" IS NULL
        ORDER BY "dayOfWeek" ASC;
      `
    );
    return rows;
  }

  async upsertTimetable(payload: ShiftTimetablePayload) {
    const startTime = payload.startTime instanceof Date ? payload.startTime : new Date(payload.startTime);
    const endTime = payload.endTime instanceof Date ? payload.endTime : new Date(payload.endTime);

    const shiftTimetableClient = (prisma as any).shiftTimetable;
    if (!shiftTimetableClient?.upsert) {
      throw new Error("ShiftTimetable model is not available in Prisma Client. Run prisma migrate/generate.");
    }

    return await shiftTimetableClient.upsert({
      where: {
        shiftId_dayOfWeek: {
          shiftId: payload.shiftId,
          dayOfWeek: payload.dayOfWeek,
        },
      },
      create: {
        shiftId: payload.shiftId,
        dayOfWeek: payload.dayOfWeek,
        startTime,
        endTime,
        createdAt: new Date(),
      },
      update: {
        startTime,
        endTime,
        isDeleted: null,
        updatedAt: new Date(),
      },
    });
  }

  async deleteTimetable(timetableId: string): Promise<void> {
    const shiftTimetableClient = (prisma as any).shiftTimetable;
    if (!shiftTimetableClient?.update) {
      throw new Error("ShiftTimetable model is not available in Prisma Client. Run prisma migrate/generate.");
    }

    await shiftTimetableClient.update({
      where: { id: timetableId },
      data: { isDeleted: new Date(), updatedAt: new Date() },
    });
  }

  // Timetable Blocks (multiple segments per day)
  async getTimetableBlocks(shiftId: string, dayOfWeek?: number) {
    const shiftTimetableBlockClient = (prisma as any).shiftTimetableBlock;
    if (shiftTimetableBlockClient?.findMany) {
      return await shiftTimetableBlockClient.findMany({
        where: {
          shiftId,
          ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
          isDeleted: null,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    }

    const rows: any[] = await prisma.$queryRaw(
      Prisma.sql`
        SELECT "id", "shiftId", "dayOfWeek", "startTime", "endTime", "type", "customType", "label", "createdAt", "updatedAt", "isDeleted"
        FROM "ShiftTimetableBlock"
        WHERE "shiftId" = ${shiftId}
          AND "isDeleted" IS NULL
          AND (${dayOfWeek !== undefined ? Prisma.sql`"dayOfWeek" = ${dayOfWeek}` : Prisma.sql`TRUE`})
        ORDER BY "dayOfWeek" ASC, "startTime" ASC;
      `
    );
    return rows;
  }

  async createTimetableBlock(payload: ShiftTimetableBlockPayload) {
    const startTime = payload.startTime instanceof Date ? payload.startTime : new Date(payload.startTime);
    const endTime = payload.endTime instanceof Date ? payload.endTime : new Date(payload.endTime);
    const type = payload.type || "WORK";
    const customType = payload.customType || null;
    const label = payload.label || null;

    const shiftTimetableBlockClient = (prisma as any).shiftTimetableBlock;
    if (shiftTimetableBlockClient?.create) {
      return await shiftTimetableBlockClient.create({
        data: {
          shiftId: payload.shiftId,
          dayOfWeek: payload.dayOfWeek,
          startTime,
          endTime,
          type,
          customType,
          label,
          createdAt: new Date(),
        },
      });
    }

    const id = randomUUID();
    const rows: any[] = await prisma.$queryRaw(
      Prisma.sql`
        INSERT INTO "ShiftTimetableBlock" ("id", "shiftId", "dayOfWeek", "startTime", "endTime", "type", "customType", "label", "createdAt")
        VALUES (${id}, ${payload.shiftId}, ${payload.dayOfWeek}, ${startTime}, ${endTime}, ${type}::"ShiftTimetableBlockType", ${customType}, ${label}, NOW())
        RETURNING "id", "shiftId", "dayOfWeek", "startTime", "endTime", "type", "customType", "label", "createdAt", "updatedAt", "isDeleted";
      `
    );
    return rows?.[0];
  }

  async updateTimetableBlock(id: string, payload: Partial<ShiftTimetableBlockPayload>) {
    const data: any = { ...payload };
    if (data.startTime && !(data.startTime instanceof Date)) data.startTime = new Date(data.startTime);
    if (data.endTime && !(data.endTime instanceof Date)) data.endTime = new Date(data.endTime);

    const shiftTimetableBlockClient = (prisma as any).shiftTimetableBlock;
    if (shiftTimetableBlockClient?.update) {
      return await shiftTimetableBlockClient.update({
        where: { id },
        data: {
          ...(data.shiftId !== undefined ? { shiftId: data.shiftId } : {}),
          ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek } : {}),
          ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
          ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.customType !== undefined ? { customType: data.customType } : {}),
          ...(data.label !== undefined ? { label: data.label } : {}),
          isDeleted: null,
          updatedAt: new Date(),
        },
      });
    }

    const rows: any[] = await prisma.$queryRaw(
      Prisma.sql`
        UPDATE "ShiftTimetableBlock"
        SET
          "shiftId" = COALESCE(${data.shiftId}, "shiftId"),
          "dayOfWeek" = COALESCE(${data.dayOfWeek}, "dayOfWeek"),
          "startTime" = COALESCE(${data.startTime}, "startTime"),
          "endTime" = COALESCE(${data.endTime}, "endTime"),
          "type" = COALESCE(${data.type ? Prisma.sql`${data.type}::"ShiftTimetableBlockType"` : Prisma.sql`NULL`}, "type"),
          "customType" = COALESCE(${data.customType}, "customType"),
          "label" = COALESCE(${data.label}, "label"),
          "isDeleted" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${id}
        RETURNING "id", "shiftId", "dayOfWeek", "startTime", "endTime", "type", "customType", "label", "createdAt", "updatedAt", "isDeleted";
      `
    );
    return rows?.[0];
  }

  async deleteTimetableBlock(id: string): Promise<void> {
    const shiftTimetableBlockClient = (prisma as any).shiftTimetableBlock;
    if (shiftTimetableBlockClient?.update) {
      await shiftTimetableBlockClient.update({
        where: { id },
        data: { isDeleted: new Date(), updatedAt: new Date() },
      });
      return;
    }

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ShiftTimetableBlock"
        SET "isDeleted" = NOW(), "updatedAt" = NOW()
        WHERE "id" = ${id};
      `
    );
  }
}

export default ShiftService;
