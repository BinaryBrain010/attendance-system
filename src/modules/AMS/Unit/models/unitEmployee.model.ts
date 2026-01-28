import prisma from "../../../../core/models/base.model";

const unitEmployeeModel = prisma.$extends({
  model: {
    unitEmployee: {
      async getEmployeesByUnitId(unitId: string) {
        const unitEmployees = await prisma.unitEmployee.findMany({
          where: {
            unitId: unitId,
            isDeleted: null,
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
                designation: true,
                department: true,
                status: true,
                image: true,
              },
            },
          },
          orderBy: {
            employee: {
              name: 'asc',
            },
          },
        });

        return unitEmployees;
      },

      async getUnitsByEmployeeId(employeeId: string) {
        const unitEmployees = await prisma.unitEmployee.findMany({
          where: {
            employeeId: employeeId,
            isDeleted: null,
          },
          include: {
            unit: {
              select: {
                id: true,
                name: true,
                type: true,
                description: true,
                address: true,
              },
            },
          },
          orderBy: {
            unit: {
              name: 'asc',
            },
          },
        });

        return unitEmployees;
      },

      async getUnitEmployeeByUnitAndEmployee(unitId: string, employeeId: string) {
        const unitEmployee = await prisma.unitEmployee.findFirst({
          where: {
            unitId: unitId,
            employeeId: employeeId,
            isDeleted: null,
          },
          include: {
            unit: true,
            employee: {
              select: {
                id: true,
                name: true,
                surname: true,
                code: true,
              },
            },
          },
        });

        return unitEmployee;
      },
    },
  },
});

export default unitEmployeeModel;
