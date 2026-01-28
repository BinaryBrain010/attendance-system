import prisma from "../../../../core/models/base.model";
import unitEmployeeModel from "../models/unitEmployee.model";
import { UnitEmployee } from "../types/unit";

class UnitEmployeeService {
  async getEmployeesByUnitId(unitId: string) {
    return await unitEmployeeModel.unitEmployee.getEmployeesByUnitId(unitId);
  }

  async getUnitsByEmployeeId(employeeId: string) {
    return await unitEmployeeModel.unitEmployee.getUnitsByEmployeeId(employeeId);
  }

  async getUnitEmployeeByUnitAndEmployee(unitId: string, employeeId: string) {
    return await unitEmployeeModel.unitEmployee.getUnitEmployeeByUnitAndEmployee(unitId, employeeId);
  }

  async assignEmployeesToUnit(unitId: string, employeeIds: string[]): Promise<any> {
    // Remove existing assignments first (soft delete)
    await prisma.unitEmployee.updateMany({
      where: {
        unitId: unitId,
        isDeleted: null,
      },
      data: {
        isDeleted: new Date(),
      },
    });

    // Create new assignments
    const assignments = employeeIds.map((employeeId) => ({
      unitId: unitId,
      employeeId: employeeId,
      createdAt: new Date(),
    }));

    // Use upsert to handle duplicates
    const createdAssignments = await Promise.all(
      assignments.map((assignment) =>
        prisma.unitEmployee.upsert({
          where: {
            unitId_employeeId: {
              unitId: assignment.unitId,
              employeeId: assignment.employeeId,
            },
          },
          create: assignment,
          update: {
            isDeleted: null,
            updatedAt: new Date(),
          },
        })
      )
    );

    return createdAssignments;
  }

  async addEmployeesToUnit(unitId: string, employeeIds: string[]): Promise<any> {
    const assignments = employeeIds.map((employeeId) => ({
      unitId: unitId,
      employeeId: employeeId,
      createdAt: new Date(),
    }));

    // Use upsert to handle duplicates
    const createdAssignments = await Promise.all(
      assignments.map((assignment) =>
        prisma.unitEmployee.upsert({
          where: {
            unitId_employeeId: {
              unitId: assignment.unitId,
              employeeId: assignment.employeeId,
            },
          },
          create: assignment,
          update: {
            isDeleted: null,
            updatedAt: new Date(),
          },
        })
      )
    );

    return createdAssignments;
  }

  async removeEmployeesFromUnit(unitId: string, employeeIds: string[]): Promise<void> {
    await prisma.unitEmployee.updateMany({
      where: {
        unitId: unitId,
        employeeId: {
          in: employeeIds,
        },
        isDeleted: null,
      },
      data: {
        isDeleted: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async removeEmployeeFromUnit(unitId: string, employeeId: string): Promise<void> {
    await prisma.unitEmployee.updateMany({
      where: {
        unitId: unitId,
        employeeId: employeeId,
        isDeleted: null,
      },
      data: {
        isDeleted: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export default UnitEmployeeService;
