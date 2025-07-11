import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";
import path from "path";
import fs from "fs";

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

        if (user) {
          const finalData = {
            ...data,
            userId: user.id,
            username: user.username,
          };
          return finalData;
        }

        const finalData = {
          ...data,
          userId: null,
          username: null,
        };

        return finalData;
      },
      async gpUpdate(updateId: string, data: any) {
        const { userId, ...remainingData } = data;

        // Update the employee data
        const updatedData = await prisma.employee.update({
          where: { id: updateId },
          data: remainingData,
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
        // console.log(data);
        const { userId, ...remainingData } = data;
        // console.log(remainingData);
        const createdData = await prisma.employee.gpCreate(remainingData);

        if (userId) {
          try {
            const data = prisma.user.gpFindById(userId);
            const newUserData = { ...data, employeeId: createdData[0].id };
            prisma.user.gpUpdate(userId, newUserData);
          } catch (err: any) {
            console.log(userId);
          }
        }

        return createdData;
      },
      async gpFindMany(this: any, args?: any) {
        return await this.findMany(args);
      },
    },
  },
});
export default employeeModel;
