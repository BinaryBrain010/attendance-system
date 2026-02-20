import { Prisma, Company } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";

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

// Helper function to generate username from employee name and surname
function generateUsername(name: string, surname: string): string {
  // Convert to lowercase, replace spaces with underscores
  const firstName = name.toLowerCase().trim().replace(/\s+/g, '_');
  const lastName = surname.toLowerCase().trim().replace(/\s+/g, '_');
  return `${firstName}_${lastName}@phw`;
}

// Helper function to create user for employee
async function createUserForEmployee(employeeId: string, name: string, surname: string, contactNo: string): Promise<any> {
  try {
    // Generate username
    const username = generateUsername(name, surname);
    
    // Check if username already exists (handle duplicates)
    let finalUsername = username;
    let counter = 1;
    while (true) {
      const existingUser = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      
      if (!existingUser) {
        break; // Username is available
      }
      
      // If username exists, append number
      const baseUsername = username.replace('@phw', '');
      finalUsername = `${baseUsername}${counter}@phw`;
      counter++;
    }
    
    // Hash password (use contactNo as password)
    const hashedPassword = await bcrypt.hash(contactNo, 10);
    
    // Create user
    const createdUser = await prisma.user.create({
      data: {
        username: finalUsername,
        password: hashedPassword,
        employeeId: employeeId,
        createdAt: new Date(),
      },
    });
    
    return createdUser;
  } catch (error: any) {
    console.error(`Error creating user for employee ${employeeId}:`, error);
    throw error;
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
              notIn: ["RESIGNED", "FIRE"],
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

          // Check if the file exists and delete it (ignore missing file)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          } else {
            console.warn(`File not found on the server: ${filePath}`);
          }

          // Remove the file path from the Employee's filePaths array in the database
          const updatedFilePaths = (employee.filePaths || []).filter(
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
        const data = await prisma.employee.findFirst({
          where: {
            id: id,
            isDeleted: null,
          },
          select: {
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
          },
        });

        if (!data) {
          return null;
        }
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

      async gpGetLinkedUser(this: any, employeeId: string): Promise<any> {
        const user = await prisma.user.findUnique({
          where: {
            employeeId: employeeId,
            isDeleted: null,
          },
          select: {
            id: true,
            username: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!user) {
          return null;
        }

        return user;
      },
      async gpUpdate(updateId: string, data: any) {
        const { userId, updatedByUserId, updatedByName, ...remainingData } = data;

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

        // If company changes, update code prefix while keeping sequence number
        if (remainingData.company && remainingData.company !== currentEmployee.company) {
          const newPrefix = companyPrefixMap[remainingData.company as Company];
          if (newPrefix && currentEmployee.code) {
            const match = currentEmployee.code.match(/^(SOL|PWH|OK)-(\d+)$/);
            if (match) {
              updateData.code = `${newPrefix}-${match[2]}`;
            }
          }
        }

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

        // If userId is provided, handle user association
        if (userId) {
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

          // Associate the new userId with the employee
          const newUser = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (newUser) {
            await prisma.user.update({
              where: { id: userId },
              data: { employeeId: updateId },
            });
          } else {
            // If the new userId doesn't exist, optionally handle this case (e.g., throw an error)
            throw new Error(`User with ID ${userId} does not exist.`);
          }
        } else {
          // If no userId provided, check if user exists - if not, create one automatically
          if (!currentUser) {
            try {
              // Get updated employee data to create user
              const updatedEmployee = await prisma.employee.findUnique({
                where: { id: updateId },
              }) as any;

              if (updatedEmployee && updatedEmployee.name && updatedEmployee.surname && updatedEmployee.contactNo) {
                await createUserForEmployee(
                  updateId,
                  updatedEmployee.name,
                  updatedEmployee.surname,
                  updatedEmployee.contactNo
                );
              }
            } catch (err: any) {
              console.error(`Error auto-creating user for employee ${updateId}:`, err);
              // Don't throw error, just log it - employee update should still succeed
            }
          }
        }

        return updatedData;
      },

      async gpCreate(data: any) {
        const { userId, code, createdByUserId, ...remainingData } = data;
        
        // Always generate code automatically if company and joiningDate are provided
        // Ignore any provided code unless it's explicitly a valid format (SOL-*, PWH-*, OK-*)
        let employeeCode = code;
        let needsCodeGeneration = false;
        
        // Check if code should be auto-generated
        // Generate if: no code provided, or code doesn't match expected pattern, or company/joiningDate are provided
        const isValidCodeFormat = code && /^(SOL|PWH|OK)-\d+$/.test(code);
        
        if (remainingData.company && remainingData.joiningDate) {
          if (!isValidCodeFormat) {
            needsCodeGeneration = true;
            // Use temporary code to avoid unique constraint issues
            // We'll update it with the correct code after creation
            employeeCode = `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          }
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
          // Ensure joiningDate is a proper Date object
          const joiningDate = remainingData.joiningDate instanceof Date 
            ? remainingData.joiningDate 
            : new Date(remainingData.joiningDate);
          
          console.log(`[Employee Creation] Generating code for company: ${remainingData.company}, joiningDate: ${joiningDate.toISOString()}`);
          
          const finalCode = await this.generateEmployeeCode(
            remainingData.company,
            joiningDate,
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

        // Automatically create user for employee if not provided
        if (!userId) {
          try {
            const employee = createdData[0];
            if (employee.name && employee.surname && employee.contactNo) {
              await createUserForEmployee(
                employee.id,
                employee.name,
                employee.surname,
                employee.contactNo
              );
            }
          } catch (err: any) {
            console.error(`Error auto-creating user for employee ${createdData[0].id}:`, err);
            // Don't throw error, just log it - employee creation should still succeed
          }
        } else {
          // If userId is provided, associate existing user with employee
          try {
            const userData = await prisma.user.gpFindById(userId);
            const newUserData = { ...userData, employeeId: createdData[0].id };
            await prisma.user.gpUpdate(userId, newUserData);
          } catch (err: any) {
            console.error(`Error associating user ${userId} with employee:`, err);
          }
        }

        return createdData;
      },

      /**
       * Generate employee code based on company and sequential increment
       * Finds the maximum existing sequence number and increments it
       * This ensures continuous sequential numbering regardless of joining date
       */
      async generateEmployeeCode(
        company: Company,
        joiningDate: Date,
        employeeId: string
      ): Promise<string> {
        // Get all employees to find the maximum sequence number
        const employees = await prisma.employee.findMany({
          where: {
            isDeleted: null,
          },
          select: {
            id: true,
            code: true,
          },
        });

        // Extract sequence numbers from existing codes
        // Codes are in format: PREFIX-NUMBER (e.g., SOL-154, PWH-2, OK-3)
        let maxSequence = 0;
        const codePattern = /^(SOL|PWH|OK)-(\d+)$/;
        
        for (const employee of employees) {
          if (employee.code) {
            const match = employee.code.match(codePattern);
            if (match) {
              const sequence = parseInt(match[2], 10);
              if (sequence > maxSequence) {
                maxSequence = sequence;
              }
            }
          }
        }

        // Increment to get the next sequence number
        const nextSequence = maxSequence + 1;

        // Get the company prefix
        const prefix = companyPrefixMap[company];
        if (!prefix) {
          throw new Error(`Invalid company: ${company}. Valid companies are: SOLARMAX, POWERHIGHWAY, OKASHASMART`);
        }

        const generatedCode = `${prefix}-${nextSequence}`;
        console.log(`[Employee Code Generation] Max existing sequence: ${maxSequence}, New code: ${generatedCode} for ${company} employee`);
        
        // Return code in format: PREFIX-SEQUENCE (e.g., SOL-155, PWH-156, OK-157)
        return generatedCode;
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
        search?: string,
        from?: string,
        to?: string,
        dateField?: string,
        userId?: string
      ) {
        const skip = (page - 1) * pageSize;
        
        // Build where clause
        const where: any = {
          isDeleted: null,
        };

        // Apply unit-based access control if userId is provided
        if (userId) {
          const { getAccessibleEmployeeIds } = await import('../../Unit/helper/unitAccess.helper');
          const accessibleEmployeeIds = await getAccessibleEmployeeIds(userId, 'employee');
          
          // If null, user has supervisor permission (access all)
          // If empty array, user has no access
          // If array with IDs, filter by those IDs
          if (accessibleEmployeeIds !== null) {
            if (accessibleEmployeeIds.length === 0) {
              // User has no access, return empty result
              return { data: [], totalSize: 0 };
            }
            where.id = { in: accessibleEmployeeIds };
          }
        }

        // Check if filter is "true" for limited field selection (e.g. dropdowns)
        const isFilterMode = filter === "true";

        // In filter mode, exclude resigned/fired so only assignable employees are returned
        if (isFilterMode) {
          where.status = { notIn: ["RESIGNED", "FIRE"] };
        } else if (filter) {
          // Explicit status filter (e.g. ACTIVE, RESIGNED)
          where.status = filter;
        }

        // Add search filter if provided (multi-term sequential filtering)
        if (search) {
          const searchTerms = search
            .trim()
            .split(/\s+/)
            .filter((term) => term.length > 0);

          if (searchTerms.length > 0) {
            where.AND = where.AND || [];
            searchTerms.forEach((term) => {
              where.AND.push({
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { surname: { contains: term, mode: 'insensitive' } },
                  { code: { contains: term, mode: 'insensitive' } },
                  { designation: { contains: term, mode: 'insensitive' } },
                  { department: { contains: term, mode: 'insensitive' } },
                ],
              });
            });
          }
        }

        // Add date range filter if provided
        // Valid dateField values: joiningDate, createdAt, updatedAt
        const validDateFields = ['joiningDate', 'createdAt', 'updatedAt'];
        const selectedDateField: string = (dateField && validDateFields.includes(dateField)) 
          ? dateField 
          : 'joiningDate';
        
        if (from || to) {
          const dateFilter: any = {};
          
          if (from) {
            const fromDate = new Date(from);
            // Set to start of day (00:00:00)
            fromDate.setHours(0, 0, 0, 0);
            dateFilter.gte = fromDate;
          }
          
          if (to) {
            const toDate = new Date(to);
            // Set to end of day (23:59:59.999)
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
          }
          
          if (Object.keys(dateFilter).length > 0) {
            where[selectedDateField] = dateFilter;
          }
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

        // Select clause - limited fields if filter=true, otherwise summary fields
        const select = isFilterMode
          ? {
              id: true,
              name: true,
              surname: true,
              code: true,
            }
          : {
              id: true,
              code: true,
              name: true,
              surname: true,
              designation: true,
              department: true,
              address: true,
              contactNo: true,
              company: true,
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

        const includeUpdatedByName = !isFilterMode && (select as any).updatedBy;
        if (!includeUpdatedByName) {
          return { data, totalSize };
        }

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
