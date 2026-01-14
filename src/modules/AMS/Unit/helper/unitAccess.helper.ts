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
export async function getAccessibleEmployeeIds(
  userId: string | undefined,
  permissionType: "employee" | "attendance"
): Promise<string[] | null> {
  // If no userId provided, return empty array (no access)
  if (!userId) {
    return [];
  }

  try {
    // Check if user has supervisor permission
    const supervisorPermission =
      permissionType === "employee"
        ? "employee.read.all.*"
        : "attendance.read.all.*";
    const hasSupervisorPermission = await accessModel.user.checkUserPermission(
      userId,
      supervisorPermission
    );

    // If user has supervisor permission, return null (access all employees)
    if (hasSupervisorPermission) {
      return null;
    }

    // Get employee ID from user
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        isDeleted: null,
      },
      select: {
        employeeId: true,
      },
    });

    // If user doesn't have an employee linked, return empty array (no access)
    if (!user || !user.employeeId) {
      return [];
    }

    // Get units where employee is assigned (via UnitEmployee)
    const unitEmployees =
      await (unitEmployeeModel as any).unitEmployee.getUnitsByEmployeeId(
        user.employeeId
      );

    // Get units where employee is the attendance manager (via attendanceManagerId)
    // @ts-expect-error - Prisma Client needs to be regenerated after schema changes
    const managedUnits = await prisma.unit.findMany({
      where: {
        attendanceManagerId: user.employeeId,
        isDeleted: null,
      },
      select: {
        id: true,
      },
    });

    // Combine unit IDs from both sources
    const unitIdsFromAssignments = unitEmployees.map((ue: any) => ue.unitId);
    const unitIdsFromManagement = managedUnits.map((unit: any) => unit.id);
    const allUnitIds = [...new Set([...unitIdsFromAssignments, ...unitIdsFromManagement])];

    // If employee is not part of any units and not managing any units, return empty array (no access)
    if (allUnitIds.length === 0) {
      return [];
    }

    // Get all employee IDs from these units
    const allEmployeeIds = new Set<string>();

    // Get employees from each unit
    for (const unitId of allUnitIds) {
      const employeesInUnit =
        await (unitEmployeeModel as any).unitEmployee.getEmployeesByUnitId(unitId);
      employeesInUnit.forEach((ue: any) => {
        if (ue.employeeId) {
          allEmployeeIds.add(ue.employeeId);
        }
      });
    }

    return Array.from(allEmployeeIds);
  } catch (error) {
    console.error("Error getting accessible employee IDs:", error);
    // On error, return empty array (no access) for security
    return [];
  }
}
