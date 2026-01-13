import { Prisma, Company } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import path from "path";
import fs from "fs";

// Company prefix mapping for employee codes
const companyPrefixMap: Record<Company, string> = {
  SOLARMAX: "SOL",
  POWERHIGHWAY: "PWH",
  OKASHASMART: "OK",
};

// Admin user ID constant
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// Helper function to get username from userId
async function getUpdatedByName(updatedBy: string | null): Promise<string | null> {
  if (!updatedBy) {
    return null;
  }
  
  if (updatedBy === ADMIN_USER_ID) {
    return "Admin";
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { username: true },
    });
    
    return user?.username || null;
  } catch (error) {
    console.error(`Error fetching username for userId ${updatedBy}:`, error);
    return null;
  }
}

const employeeModel = prisma.$extends({
  model: {
    employee: {
      async gpFindFilterMany(this: any) {
        const data = await this.findMany({
          where: {
            isDeleted: null,
            status: {
              not: "RESIGNED",
            },
          },
          select: {
            id: true,
            code: true,
            surname: true,
            name: true,
          },
        });

        return data;
      },

      async gpFindByCode(this: any, code: string) {
        const data = await prisma.employee.findUnique({
          where: {
            code: code,
            isDeleted: null,
          },
          select: {
            id: true,
            code: true,
            surname: true,
            name: true,
          },
        });

        return data;
      },

      async gpFindEmployeeByUserId(this: any, userId: string) {
        const data = await prisma.user.findUnique({
          where: {
            id: userId,
            isDeleted: null,
          },
        });

        if (data?.employeeId) {
          const employee = await prisma.employee.gpFindById(data?.employeeId);

          return employee;
        }

        return null;
      },
      async gpFindByUserId(this: any, userId: string) {
        const data = await prisma.user.findUnique({
          where: {
            id: userId,
            isDeleted: null,
          },
          select: {
            employeeId: true,
          },
        });

        if (data?.employeeId) {
          const employee = await prisma.employee.gpFindById(data?.employeeId);

          return employee;
        }

        return null;
      },

      async gpSoftDelete(id: string) {
        await prisma.employee.gpSoftDelete(id);

        const user = await prisma.user.findUnique({
          where: {
            isDeleted: null,
            employeeId: id,
          },
        });

        if (user) {
          const newUser = { ...user, employeeId: null };
          await prisma.user.gpUpdate(user?.id, newUser);
        }
      },

      async updateFilePaths(employeeId: string, filePaths: string[]) {
        try {
          await prisma.employee.update({
            where: { id: employeeId },
            data: { filePaths },
          });
        } catch (error) {
          console.error("Error updating employee file paths:", error);
          throw error;
        }
      },

      async deleteFiles(employeeId: string, fileName: string) {
        try {
          // Define the directory structure based on the employeeId
          const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
          });

          if (!employee) {
            throw new Error("Employee not found");
          }

          const uploadDir = path.join(
            __dirname,
            "..",
            "..",
            "..",
            "..",
            "assets",
            "uploads",
            `${employeeId.slice(-4)}-${employee.name.replace(/ /g, "_")}`
          );

          // Construct the full file path
          const filePath = path.join(uploadDir, fileName);

          // Check if the file exists and delete it
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          } else {
            throw new Error("File not found on the server");
          }

          // Remove the file path from the Employee's filePaths array in the database
          const updatedFilePaths = employee.filePaths.filter(
            (fp: string) => !fp.endsWith(fileName)
          );

          await prisma.employee.update({
            where: { id: employeeId },
            data: { filePaths: updatedFilePaths },
          });

          return "File deleted successfully";
        } catch (error) {
          console.error("Error deleting file:", error);
          throw error;
        }
      },
      async getFiles(employeeId: string) {
        try {
          // Fetch the Employee from the database
          const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { filePaths: true },
          });

          if (!employee) {
            throw new Error("Employee not found");
          }

          const filePaths = employee.filePaths;

          // Prepare file details for response
          const files = filePaths.map((filePath) => ({
            fileName: path.basename(filePath),
            filePath: filePath.replace(/\\/g, "/"), // Normalize path for response
          }));

          return files;
        } catch (error) {
          console.error("Error fetching files:", error);
          throw error;
        }
      },
      async gpFindById(id: string) {
        const data = await prisma.employee.gpFindById(id);
        const user = await prisma.user.findUnique({
          where: {
            employeeId: id,
          },
        });

        // Get the username of the person who updated this employee
        const updatedByName = await getUpdatedByName(data?.updatedBy || null);

        if (user) {
          const finalData = {
            ...data,
            userId: user.id,
            username: user.username,
            updatedByName: updatedByName,
          };
          return finalData;
        }

        const finalData = {
          ...data,
          userId: null,
          username: null,
          updatedByName: updatedByName,
        };

        return finalData;
      },
      async gpUpdate(updateId: string, data: any) {
        const { userId, updatedByUserId, ...remainingData } = data;

        // Get current state before update for audit trail
        const currentEmployee = await prisma.employee.findUnique({
          where: { id: updateId },
        }) as any;

        if (!currentEmployee) {
          throw new Error(`Employee with ID ${updateId} not found.`);
        }

        // Prepare previous update record
        const previousUpdate = {
          data: {
            name: currentEmployee.name,
            surname: currentEmployee.surname,
            address: currentEmployee.address,
            dob: currentEmployee.dob,
            cnic: currentEmployee.cnic,
            joiningDate: currentEmployee.joiningDate,
            bloodGroup: currentEmployee.bloodGroup,
            contactNo: currentEmployee.contactNo,
            emergencyContactNo: currentEmployee.emergencyContactNo,
            designation: currentEmployee.designation,
            department: currentEmployee.department,
            martialStatus: currentEmployee.martialStatus,
            noOfChildrens: currentEmployee.noOfChildrens,
            filePaths: currentEmployee.filePaths,
            notes: currentEmployee.notes,
            status: currentEmployee.status,
            resignationDate: currentEmployee.resignationDate,
            company: currentEmployee.company,
            image: currentEmployee.image,
            code: currentEmployee.code,
          },
          updatedBy: currentEmployee.updatedBy || null,
          updatedAt: currentEmployee.updatedAt || new Date(),
        };

        // Get existing previousUpdates array or initialize empty array
        const existingPreviousUpdates = (currentEmployee.previousUpdates as any[]) || [];

        // Add current state to previousUpdates and keep only last 3
        const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

        // Prepare update data with audit trail
        const updateData: any = {
          ...remainingData,
          updatedAt: new Date(),
          updatedBy: updatedByUserId || null,
          previousUpdates: updatedPreviousUpdates,
        };

        // Update the employee data
        const updatedData = await prisma.employee.update({
          where: { id: updateId },
          data: updateData as any,
        });

        // Fetch the current user associated with the employee
        const currentUser = await prisma.user.findUnique({
          where: {
            employeeId: updateId,
          },
        });

        if (currentUser) {
          // If the `userId` matches the current user's ID, no need to update the user association
          if (currentUser.id === userId) {
            return updatedData;
          }

          // Otherwise, remove the `employeeId` from the current user
          await prisma.user.update({
            where: { id: currentUser.id },
            data: { employeeId: null }, // Remove the employee association
          });
        }

        if (userId) {
          // Associate the new userId with the employee
          const newUser = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (newUser) {
            const newUserData = { ...newUser, employeeId: updateId };
            await prisma.user.update({
              where: { id: userId },
              data: newUserData,
            });
          } else {
            // If the new userId doesn't exist, optionally handle this case (e.g., throw an error)
            throw new Error(`User with ID ${userId} does not exist.`);
          }
        }

        return updatedData;
      },

      async gpCreate(data: any) {
        const { userId, code, createdByUserId, ...remainingData } = data;
        
        // If code is not provided, generate it automatically
        let employeeCode = code;
        let needsCodeGeneration = false;
        
        if (!employeeCode && remainingData.company && remainingData.joiningDate) {
          needsCodeGeneration = true;
          // Use temporary code to avoid unique constraint issues
          // We'll update it with the correct code after creation
          employeeCode = `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        }

        // Create employee with provided or temporary code and audit trail
        const employeeData = {
          ...remainingData,
          code: employeeCode,
          createdBy: createdByUserId || null,
          previousUpdates: [],
        };
        
        const createdData = await prisma.employee.gpCreate(employeeData);

        // If code needs to be auto-generated, calculate and update it
        if (needsCodeGeneration && remainingData.company && remainingData.joiningDate) {
          const finalCode = await this.generateEmployeeCode(
            remainingData.company,
            remainingData.joiningDate,
            createdData[0].id
          );
          
          // Update with final code (preserve audit trail)
          const currentEmployee = await prisma.employee.findUnique({
            where: { id: createdData[0].id },
          }) as any;
          
          await prisma.employee.update({
            where: { id: createdData[0].id },
            data: { 
              code: finalCode,
              previousUpdates: currentEmployee?.previousUpdates || [],
            } as any,
          });
          createdData[0].code = finalCode;
        }

        if (userId) {
          try {
            const userData = await prisma.user.gpFindById(userId);
            const newUserData = { ...userData, employeeId: createdData[0].id };
            await prisma.user.gpUpdate(userId, newUserData);
          } catch (err: any) {
            console.log(userId);
          }
        }

        return createdData;
      },

      /**
       * Generate employee code based on company and joining date sequence
       * Follows the same convention as updateEmployeeCodes.ts
       * Sequence numbers are assigned globally based on joining date across all companies
       */
      async generateEmployeeCode(
        company: Company,
        joiningDate: Date,
        employeeId: string
      ): Promise<string> {
        // Get all employees ordered by joining date (oldest first), then by id
        // This includes the newly created employee
        const employees = await prisma.employee.findMany({
          where: {
            isDeleted: null,
          },
          orderBy: [
            {
              joiningDate: "asc",
            },
            {
              id: "asc",
            },
          ],
          select: {
            id: true,
            joiningDate: true,
          },
        });

        // Find the position of this employee in the sorted list
        let position = 0;
        for (let i = 0; i < employees.length; i++) {
          if (employees[i].id === employeeId) {
            position = i + 1;
            break;
          }
        }

        // If employee not found (shouldn't happen), use length + 1
        if (position === 0) {
          position = employees.length;
        }

        const prefix = companyPrefixMap[company];
        return `${prefix}-${position}`;
      },
      async gpFindMany(this: any, args?: any) {
        return await this.findMany(args);
      },

      async gpPgFindManyWithSortAndFilter(
        this: any,
        page: number,
        pageSize: number,
        sortBy: string,
        sortOrder: 'asc' | 'desc',
        filter?: string,
        search?: string
      ) {
        const skip = (page - 1) * pageSize;
        
        // Build where clause
        const where: any = {
          isDeleted: null,
        };

        // Check if filter is "true" for limited field selection
        const isFilterMode = filter === "true";

        // Add status filter if provided and not in filter mode
        if (filter && !isFilterMode) {
          where.status = filter;
        }

        // Add search filter if provided
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { surname: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { designation: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
          ];
        }

        // Validate and set sortBy field
        const validSortFields = [
          'name',
          'surname',
          'code',
          'designation',
          'department',
          'createdAt',
          'updatedAt',
          'joiningDate',
          'status',
        ];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const order = sortOrder === 'asc' ? 'asc' : 'desc';

        // Build orderBy clause
        const orderBy: any = {};
        orderBy[sortField] = order;

        // Select clause - limited fields if filter=true, otherwise full fields
        const select = isFilterMode
          ? {
              id: true,
              name: true,
              surname: true,
              code: true,
            }
          : {
              id: true,
              name: true,
              surname: true,
              address: true,
              joiningDate: true,
              bloodGroup: true,
              dob: true,
              cnic: true,
              contactNo: true,
              emergencyContactNo: true,
              designation: true,
              department: true,
              martialStatus: true,
              noOfChildrens: true,
              filePaths: true,
              notes: true,
              company: true,
              image: true,
              code: true,
              status: true,
              resignationDate: true,
              createdAt: true,
              updatedAt: true,
              updatedBy: true,
              // faceDescriptor is excluded by not including it in select
            };

        // Execute query with pagination, sorting, and filtering
        const [data, totalSize] = await Promise.all([
          this.findMany({
            where,
            select,
            take: pageSize,
            skip: skip,
            orderBy,
          }),
          this.count({
            where,
          }),
        ]);

        // Fetch usernames for all updatedBy fields
        const dataWithUpdatedByName = await Promise.all(
          data.map(async (employee: any) => {
            const updatedByName = await getUpdatedByName(employee.updatedBy || null);
            return {
              ...employee,
              updatedByName: updatedByName,
            };
          })
        );

        return { data: dataWithUpdatedByName, totalSize };
      },

      async getHistoryById(this: any, employeeId: string, filter?: boolean, date?: string) {
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            previousUpdates: true,
          },
        });

        if (!employee) {
          throw new Error(`Employee with ID ${employeeId} not found.`);
        }

        const previousUpdates = (employee.previousUpdates as any[]) || [];

        // Add updatedByName to each update record
        const previousUpdatesWithNames = await Promise.all(
          previousUpdates.map(async (update: any) => {
            const updatedByName = await getUpdatedByName(update.updatedBy || null);
            return {
              ...update,
              updatedByName: updatedByName,
            };
          })
        );

        // If filter is not true, return complete previousUpdates array with names
        if (!filter) {
          return previousUpdatesWithNames;
        }

        // If filter is true and date is provided, return record for that specific date
        if (filter && date) {
          const targetDate = new Date(date);
          // Normalize dates to compare only date part (ignore time)
          const targetDateStr = targetDate.toISOString().split('T')[0];
          
          const record = previousUpdatesWithNames.find((update: any) => {
            if (!update.updatedAt) return false;
            const updateDate = new Date(update.updatedAt);
            const updateDateStr = updateDate.toISOString().split('T')[0];
            return updateDateStr === targetDateStr;
          });

          return record || null;
        }

        // If filter is true but no date provided, return array of dates
        const dates = previousUpdatesWithNames
          .map((update: any) => update.updatedAt)
          .filter((date: any) => date !== null && date !== undefined);

        return dates;
      },
    },
  },
});
export default employeeModel;
