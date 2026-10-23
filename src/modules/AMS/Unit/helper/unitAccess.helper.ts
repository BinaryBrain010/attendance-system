import prisma from "../../../../core/models/base.model";
import accessModel from "../../../rbac/Access/models/access.model";
import unitEmployeeModel from "../models/unitEmployee.model";

/**
 * Gets employee IDs that a user can access based on their unit membership.
 * If user has supervisor permission (employee.read.all.* or attendance.read.all.*), returns null (access all).
 * Otherwise, returns array of employee IDs from user's units.
 *
 * @param userId - User ID
 * @param permissionType - "employee" for employee.read.all.* or "attendance" for attendance.read.all.*
 * @returns Array of employee IDs or null if supervisor
 */
/**
 * Units a user can access (for records scoped by unit, e.g. Frontdesk visitors).
 * Returns null when the user holds `viewAllPermission` (see all units), otherwise the unit IDs the
 * user belongs to or manages. Empty array = no unit access.
 */
export async function getAccessibleUnitIds(
  userId: string | undefined,
  viewAllPermission: string
): Promise<string[] | null> {
  if (!userId) return [];
  try {
    const hasViewAll = await accessModel.user.checkUserPermission(userId, viewAllPermission);
    if (hasViewAll) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId, isDeleted: null },
      select: { employeeId: true },
    });
    if (!user || !user.employeeId) return [];
    const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getUnitsByEmployeeId(user.employeeId);
    const managedUnits = await prisma.unit.findMany({
      where: { attendanceManagerId: user.employeeId, isDeleted: null },
      select: { id: true },
    });
    const ids = [
      ...new Set([
        ...unitEmployees.map((ue: any) => ue.unitId),
        ...managedUnits.map((u: any) => u.id),
      ]),
    ];
    return ids as string[];
  } catch (error) {
    console.error("Error getting accessible unit IDs:", error);
    return [];
  }
}

export const AMS_VIEW_ALL = "ams.viewAll.unit.*";

export async function getAccessibleEmployeeIds(
  userId: string | undefined,
  _permissionType?: "employee" | "attendance"
): Promise<string[] | null> {
  // No user => no access.
  if (!userId) {
    return [];
  }

  try {
    // HOTFIX 2026-10-23: a single AMS-wide bypass. Holders of `ams.viewAll.unit` (and god, which
    // checkUserPermission bypasses) see everyone. Everyone else is scoped to their accessible units
    // (units they are assigned to + units they manage); with NO unit they see only THEMSELVES
    // (never "all" — this is attendance data). The returned array always includes the user's own
    // employee record so a manager/employee can see themself.
    if (await accessModel.user.checkUserPermission(userId, AMS_VIEW_ALL)) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, isDeleted: null },
      select: { employeeId: true },
    });
    const ownEmployeeId = user?.employeeId ?? null;

    if (!ownEmployeeId) {
      // No linked employee and not viewAll: nothing is theirs.
      return [];
    }

    const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getUnitsByEmployeeId(ownEmployeeId);
    const managedUnits = await prisma.unit.findMany({
      where: { attendanceManagerId: ownEmployeeId, isDeleted: null },
      select: { id: true },
    });
    const allUnitIds = [
      ...new Set<string>([
        ...unitEmployees.map((ue: any) => ue.unitId),
        ...managedUnits.map((u: any) => u.id),
      ]),
    ];

    // No unit at all: see only self.
    if (allUnitIds.length === 0) {
      return [ownEmployeeId];
    }

    const ids = new Set<string>([ownEmployeeId]);
    for (const unitId of allUnitIds) {
      const employeesInUnit = await (unitEmployeeModel as any).unitEmployee.getEmployeesByUnitId(unitId);
      employeesInUnit.forEach((ue: any) => { if (ue.employeeId) ids.add(ue.employeeId); });
    }
    return Array.from(ids);
  } catch (error) {
    console.error("Error getting accessible employee IDs:", error);
    return [];
  }
}

/** HOTFIX: true if `userId` may access `employeeId`'s records (unit scope). Used to 403 detail/overview
 *  endpoints for an employee outside the caller's units. */
export async function canAccessEmployee(userId: string | undefined, employeeId: string): Promise<boolean> {
  const ids = await getAccessibleEmployeeIds(userId);
  if (ids === null) return true; // viewAll / god
  return ids.includes(employeeId);
}
