import bcrypt from "bcrypt";
import prisma from "../../../../core/models/base.model";
import { Prisma } from "@prisma/client";
import { User, UserData } from "../types/user";
import blacklistTokenModel from "../../Token/models/token.model";
import { blackListedTokens } from "../../Token/types/token";
import accessModel from "../../Access/models/access.model";
import { AppError, InternalServerError, ValidationError } from "../../../../core/errors/app.error";

import { create } from "domain";
const userModel = prisma.$extends({
  model: {
    user: {
      async gpSoftDelete(this: any, id: string) {
        const existingItem = await this.findUnique({ where: { id } });
        if (existingItem.isDeleted === null) {
          await this.update({
            where: { id },
            data: { isDeleted: new Date() },
          });
        }

        await prisma.loggedInUsers.deleteMany({
          where: {
            userId: id,
          },
        });

        await prisma.userGroup.deleteMany({
          where: {
            userId: id,
          },
        });

        await prisma.userRole.deleteMany({
          where: {
            userId: id,
          },
        });

        // await prisma.widgetUserConfiguration.deleteMany({
        //   where: {
        //     userId: id,
        //   },
        // });

        // await prisma.companyUsers.deleteMany({
        //   where: {
        //     userId: id,
        //   },
        // });
      },
      //   async changeDefaultCompany(id: string, companyId: string) {
      //     await prisma.user.update({
      //       where: { id },
      //       data: { defaultCompanyId: companyId, updatedAt: new Date() },
      //     });
      //   },

      async gpFindUnique(this: any, username: any) {
        const user = await this.findUnique({
          where: {
            isDeleted: null,
            username: username,
          },
        });
        return user;
      },

      async gpRemoveLoggedInUser(this: any, userId: string, token: string) {
        if (token === "") {
          const users = await prisma.loggedInUsers.findMany({
            where: {
              userId: userId,
            },
          });

          await prisma.loggedInUsers.deleteMany({
            where: {
              userId: userId,
            },
          });

          for (const user of users) {
            await blacklistTokenModel.blacklistToken.gpCreate({
              userId,
              token: user.token || "",
              rememberMe: user.rememberMe || false,
            });
          }

          return users;
        } else {
          const data = await prisma.loggedInUsers.findFirst({
            where: {
              userId: userId,
              token: token,
            },
          });

          // console.log("fetched data");
          if (data) {
            await prisma.loggedInUsers.delete({
              where: {
                userId: userId,
                token: token,
              },
            });

            console.log("deleted");
            await blacklistTokenModel.blacklistToken.gpCreate({
              userId: userId,
              token: token,
              rememberMe: data.rememberMe,
            });
          }
        }
      },

      async gpFindMany(this: any) {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        const data = await this.findMany({
          where: {
            isDeleted: null,
            id: {
              not: excludedId,
            },
          },
        });

        return data;
      },

      async gpCount(this: any, userId: string) {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        const roleIds: string[] = await accessModel.group.getRoleIds(userId);
        const groupIds: string[] = await accessModel.role.getUserGroupsIds(
          userId
        );
        if (userId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
          const count = await this.count({
            where: {
              isDeleted: null,
              id: {
                not: excludedId,
              },
            },
          });
          return count;
        }

        // if (companyId) {
        //   const count = await this.count({
        //     where: {
        //       isDeleted: null,
        //       companyId: companyId,
        //       id: {
        //         not: excludedId,
        //       },
        //       OR: [
        //         {
        //           readAccess: {
        //             equals: Prisma.DbNull,
        //           },
        //         },
        //         {
        //           readAccess: {
        //             path: ["user"],
        //             array_contains: userId,
        //           },
        //         },
        //         {
        //           OR: roleIds.map((roleId) => ({
        //             readAccess: {
        //               path: ["role"],
        //               array_contains: roleId,
        //             },
        //           })),
        //         },
        //         {
        //           OR: groupIds.map((groupId) => ({
        //             readAccess: {
        //               path: ["group"],
        //               array_contains: groupId,
        //             },
        //           })),
        //         },
        //       ],
        //     },
        //   });
        //   return count;
        // }

        const count = await this.count({
          where: {
            isDeleted: null,
            id: {
              not: excludedId,
            },
            // OR: [
            //   {
            //     readAccess: {
            //       equals: Prisma.DbNull,
            //     },
            //   },
            //   {
            //     readAccess: {
            //       path: ["user"],
            //       array_contains: userId,
            //     },
            //   },
            //   {
            //     OR: roleIds.map((roleId) => ({
            //       readAccess: {
            //         path: ["role"],
            //         array_contains: roleId,
            //       },
            //     })),
            //   },
            //   {
            //     OR: groupIds.map((groupId) => ({
            //       readAccess: {
            //         path: ["group"],
            //         array_contains: groupId,
            //       },
            //     })),
            //   },
            // ],
          },
        });
        return count;
      },
      async detailedUser(id: string) {
        if (id === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
          return null;
        }
        const data: UserData[] = await prisma.$queryRaw(Prisma.sql`SELECT 
    "User".username,
    ARRAY(
        SELECT DISTINCT "R"."name" 
        FROM "UserRole" AS "UR" 
        LEFT JOIN "Role" AS "R" 
        ON "UR"."roleId" = "R".id 
        WHERE "UR"."userId" = "User".id 
          AND "UR"."isDeleted" IS NULL 
          AND "R"."isDeleted" IS NULL
    ) AS "userRole",
    ARRAY(
        SELECT DISTINCT "G"."name" 
        FROM "UserGroup" AS "UG" 
        LEFT JOIN "Group" AS "G" 
        ON "UG"."groupId" = "G".id 
        WHERE "UG"."userId" = "User".id 
          AND "UG"."isDeleted" IS NULL 
          AND "G"."isDeleted" IS NULL
    ) AS "userGroup"
FROM "User"
WHERE "User".id = ${id}
  AND "User"."isDeleted" IS NULL;
      `);

        const userData: UserData = {
          id: data[0].id,
          username: data[0].username,
          //   defaultCompanyId: data[0].defaultCompanyId,
          password: "",
          userRole: data[0].userRole,
          userGroup: data[0].userGroup,
          //   companyUser: data[0].companyUser,
        };

        return userData;
      },
      async gpPgFindMany(
        this: any,
        page: number,
        pageSize: number,
        userId: string
        // companyId?: string
      ) {
        const skip = (page - 1) * pageSize;
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        // const roleIds: string[] = rbacModel.user.getUserGroups(userId);
        const roleIds: string[] = await accessModel.group.getRoleIds(userId);
        const groupIds: string[] = await accessModel.role.getUserGroupsIds(
          userId
        );

        // console.log(userId);
        // console.log(roleIds);
        // console.log(groupIds);
        if (userId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
          const data = await this.findMany({
            where: {
              isDeleted: null,
              id: {
                not: excludedId,
              },
            },
            take: pageSize,
            skip: skip,
            orderBy: {
              createdAt: "asc",
            },
          });

          const totalSize = await this.count({
            where: {
              isDeleted: null,
              id: {
                not: excludedId,
              },
            },
          });

          return { data, totalSize };
        }

        // const accessCondition = {
        //   OR: [
        //     {
        //       readAccess: {
        //         equals: Prisma.DbNull,
        //       },
        //     },

        //     {
        //       readAccess: {
        //         path: ["user"],
        //         array_contains: userId,
        //       },
        //     },
        //     {
        //       OR: roleIds.map((roleId) => ({
        //         readAccess: {
        //           path: ["role"],
        //           array_contains: roleId,
        //         },
        //       })),
        //     },
        //     {
        //       OR: groupIds.map((groupId) => ({
        //         readAccess: {
        //           path: ["group"],
        //           array_contains: groupId,
        //         },
        //       })),
        //     },
        //   ],
        // };

        const combinedCondition = {
          AND: [{ isDeleted: null }],
        };

        // if (companyId) {
        //   const combinedCondition = {
        //     AND: [{ isDeleted: null, companyId: companyId }, accessCondition],
        //   };
        //   const data = await this.findMany({
        //     where: {
        //       ...combinedCondition,
        //       id: {
        //         not: excludedId,
        //       },
        //     },
        //     take: pageSize,
        //     skip: skip,
        //     orderBy: {
        //       createdAt: "asc",
        //     },
        //   });

        //   const totalSize = await this.count({
        //     where: {
        //       ...combinedCondition,
        //       id: {
        //         not: excludedId,
        //       },
        //     },
        //   });

        //   return { data, totalSize };
        // }

        const data = await this.findMany({
          where: {
            ...combinedCondition,
            id: {
              not: excludedId,
            },
          },
          take: pageSize,
          skip: skip,
          orderBy: {
            createdAt: "asc",
          },
        });

        const totalSize = await this.count({
          where: {
            ...combinedCondition,
            id: {
              not: excludedId,
            },
          },
        });

        return { data, totalSize };
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
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        
        // Build where clause
        const where: any = {
          isDeleted: null,
          id: {
            not: excludedId,
          },
        };

        // Check if filter is "true" for limited field selection
        const isFilterMode = filter === "true";

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
                OR: [{ username: { contains: term, mode: 'insensitive' } }],
              });
            });
          }
        }

        // Validate and set sortBy field
        const validSortFields = [
          'username',
          'createdAt',
          'updatedAt',
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
              username: true,
            }
          : {
              id: true,
              username: true,
              createdAt: true,
              updatedAt: true,
              employeeId: true,
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

        return { data, totalSize };
      },

      async gpNonAssociatedUsers() {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        const data = prisma.user.findMany({
          where: {
            isDeleted: null,
            employeeId: null,
            id: {
              not: excludedId,
            },
          },
        });

        return data;
      },
      async gpSearch(
        this: any,
        searchTerm: string | string[],
        columns: string[],
        pageNumber: number = 1,
        pageSize: number = 10
        // userId: string
      ) {
        const excludedId = "58c55d6a-910c-46f8-a422-4604bea6cd15";
        // const roleIds: string[] = rbacModel.user.getUserGroups(userId);
        // const roleIds: string[] = await accessModel.group.getRoleIds(userId);
        // const groupIds: string[] = await accessModel.role.getUserGroupsIds(
        //   userId
        // );
        const searchTermsArray = Array.isArray(searchTerm)
          ? searchTerm
          : [searchTerm];
        let mainCondition = {};

        for (let i = 0; i < searchTermsArray.length; i++) {
          const term = searchTermsArray[i];
          const condition = {
            OR: columns.map((column) => ({
              [column]: {
                mode: "insensitive",
                contains: term,
              },
            })),
          };

          if (i === 0) {
            mainCondition = condition;
          } else {
            mainCondition = {
              AND: [mainCondition, condition],
            };
          }
        }

        const offset = (pageNumber - 1) * pageSize;
        // if (userId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
        //   const [data, totalSize] = await Promise.all([
        //     this.findMany({
        //       where: {
        //         isDeleted: null,
        //         id: {
        //           not: excludedId,
        //         },
        //         ...mainCondition,
        //       },
        //       skip: offset,
        //       take: pageSize,
        //     }),
        //     this.count({
        //       where: {
        //         isDeleted: null,
        //         id: {
        //           not: excludedId,
        //         },
        //         ...mainCondition,
        //       },
        //     }),
        //   ]);

        //   return { data, totalSize };
        // }

        // const accessCondition = {
        //   OR: [
        //     {
        //       readAccess: {
        //         equals: Prisma.DbNull,
        //       },
        //     },
        //     {
        //       readAccess: {
        //         path: ["user"],
        //         array_contains: userId,
        //       },
        //     },
        //     {
        //       OR: roleIds.map((roleId) => ({
        //         readAccess: {
        //           path: ["role"],
        //           array_contains: roleId,
        //         },
        //       })),
        //     },
        //     {
        //       OR: groupIds.map((groupId) => ({
        //         readAccess: {
        //           path: ["group"],
        //           array_contains: groupId,
        //         },
        //       })),
        //     },
        //   ],
        // };

        const combinedCondition = {
          AND: [
            {
              isDeleted: null,
              id: {
                not: excludedId,
              },
            },
            // accessCondition,
            mainCondition,
          ],
        };

        const [data, totalSize] = await Promise.all([
          this.findMany({
            where: {
              ...combinedCondition,
              id: {
                not: excludedId,
              },
            },

            skip: offset,
            take: pageSize,
          }),
          this.count({
            where: {
              ...combinedCondition,
              id: {
                not: excludedId,
              },
            },
          }),
        ]);

        return { data, totalSize };
      },

      // async actFindById(this: any, id: string) {
      //   const data = await this.findUnique({
      //     where: {
      //       id: id,
      //       isDeleted: null,
      //     },
      //     select: {
      //       id: true,
      //       username: true,
      //     },
      //   });

      //   return data;
      // },
      // async actFindById(this: any, id: string): Promise<UserData> {
      //   const userData = await this.findUnique({
      //     where: {
      //       id: id,
      //       isDeleted: null,
      //     },
      //     select: {
      //       id: true,
      //       username: true,
      //       userRoles: {
      //         select: {
      //           id: true,
      //           name: true,
      //         },
      //       },
      //       userGroups: {
      //         select: {
      //           id: true,
      //           name: true,
      //         },
      //       },
      //     },
      //   });

      //   // Extract role IDs and names from userRoles
      //   const userRoleIds: string[] = userData.userRoles.map(
      //     (role: any) => role.id
      //   );
      //   const userRoleNames: string[] = userData.userRoles.map(
      //     (role: any) => role.name
      //   );

      //   // Extract group IDs and names from userGroups
      //   const userGroupIds: string[] = userData.userGroups.map(
      //     (group: any) => group.id
      //   );
      //   const userGroupNames: string[] = userData.userGroups.map(
      //     (group: any) => group.name
      //   );

      //   return {
      //     id: userData.id,
      //     username: userData.username,
      //     password: "", // Return an empty string for password for security reasons
      //     userRole: userRoleIds, // Return array of role IDs
      //     // roleName: userRoleNames, // Return array of role names
      //     userGroup: userGroupIds, // Return array of group IDs
      //     // groupName: userGroupNames, // Return array of group names
      //   };
      // },

      async gpCreate(this: any, data: UserData) {
        if (data.username === "" || data.password === "") {
          return "User not created";
        }

        // const rules: BusinessRule[] =
        //   await businessRuleModel.businessRule.actFindByFeatureId(
        //     "user.create.*"
        //   );

        // const readAccess = rules[0].operation.readAccess;
        // const writeAccess = rules[0].operation.writeAccess;

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const newData: User = {
          username: data.username,
          password: hashedPassword,
          //   defaultCompanyId: data.companyUser[0],
          // readAccess: { ...readAccess },
          // writeAccess:{...writeAccess},
          createdAt: new Date(),
        };

        if (data?.id) {
          newData.id = data.id;
        }

        const createdUser = await this.create({
          data: newData,
        });

        if (data.userRole.length > 0) {
          for (const roleId of data.userRole) {
            const role = await prisma.role.findUnique({
              where: { id: roleId },
            });
            if (role) {
              const userRole = { userId: createdUser.id, roleId, active: true };
              await prisma.userRole.gpCreate(userRole);
            } else {
              return "Role does not exist";
            }
          }
        }

        if (data.userGroup.length > 0) {
          for (const groupId of data.userGroup) {
            const group = await prisma.group.findUnique({
              where: { id: groupId },
            });
            if (group) {
              const userGroup = {
                userId: createdUser.id,
                groupId,
                active: true,
              };
              await prisma.userGroup.gpCreate(userGroup);
            } else {
              return "Group does not exist";
            }
          }
        }

        // if (data.companyUser.length > 0) {
        //   for (const companyId of data.companyUser) {
        //     const company = await prisma.company.findUnique({
        //       where: { id: companyId },
        //     });
        //     if (company) {
        //       const userCompany = {
        //         userId: createdUser.id,
        //         companyId,
        //         active: true,
        //       };
        //       await prisma.companyUsers.actCreate(userCompany);
        //     } else {
        //       return "Company does not exist";
        //     }
        //   }
        // }

        return createdUser;
      },

      async getLoggedInUser(this: any, id: string) {
        const user = await userModel.user.findFirst({
          where: {
            id: id,
          },
        });
        return user?.username;
      },

      async checkPreviousPassowrd(this: any, id: string, password: string) {
        const user = await prisma.user.gpFindById(id);

        if (bcrypt.compareSync(password, user.password)) {
          return true;
        }

        return false;
      },

      async changePassowrd(this: any, id: string, password: string) {
        const user = await userModel.user.gpFindById(id);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newData = {
          username: user.username,
          password: hashedPassword,
        };

        const updated = await prisma.user.gpUpdate(id, newData);
        return updated;
      },

      async gpUpdate(this: any, id: string, data: UserData) {
        if (data.username === "") {
          throw new ValidationError("Username is required");
        }
        try {
          const user = await userModel.user.findFirst({
            where: {
              id: id,
            },
          });

          if (!user) {
            throw new ValidationError("User not found");
          }

          let newData: any = {
            username: data.username,
            password: user?.password,
            updatedAt: new Date(),
          };

          const updatedUser = await this.update({
            where: { id: id },
            data: newData,
          });

          // Update user roles
          await prisma.userRole.deleteMany({
            where: { userId: id },
          });

          for (const roleId of data.userRole) {
            const role = await prisma.role.findUnique({
              where: { id: roleId },
            });
            if (role) {
              const userRole = { userId: id, roleId, active: true };
              await prisma.userRole.create({
                data: userRole,
              });
            } else {
              throw new ValidationError("Role does not exist");
            }
          }

          // Update user groups
          await prisma.userGroup.deleteMany({
            where: { userId: id },
          });

          for (const groupId of data.userGroup) {
            const group = await prisma.group.findUnique({
              where: { id: groupId },
            });
            if (group) {
              const userGroup = {
                userId: id,
                groupId,
                active: true,
              };
              await prisma.userGroup.create({
                data: userGroup,
              });
            } else {
              throw new ValidationError("Group does not exist");
            }
          }

          //   await prisma.companyUsers.deleteMany({
          //     where: { userId: id },
          //   });

          //   if (data.companyUser.length > 0) {
          //     for (const companyId of data.companyUser) {
          //       const company = await prisma.company.findUnique({
          //         where: { id: companyId },
          //       });
          //       if (company) {
          //         const userCompany = {
          //           userId: updatedUser.id,
          //           companyId,
          //           active: true,
          //         };
          //         await prisma.companyUsers.create({
          //           data: userCompany,
          //         });
          //       } else {
          //         return "Company does not exist";
          //       }
          //     }
          //   }

          return updatedUser;
        } catch (error) {
          console.error("Error updating user:", error);

          if (error instanceof AppError) {
            throw error;
          }

          throw new InternalServerError("Error updating user");
        }
      },

      async gpFindById(this: any, id: string): Promise<UserData> {
        const data: UserData[] =
          await prisma.$queryRaw(Prisma.sql`SELECT "User".username,  
          ARRAY(SELECT DISTINCT "R"."name" FROM "UserRole" AS "UR" LEFT JOIN "Role" AS "R" ON "UR"."roleId" = "R".id WHERE "UR"."userId" = "User".id) AS "userRole", 
          ARRAY(SELECT DISTINCT "G"."name" FROM "UserGroup" AS "UG" LEFT JOIN "Group" AS "G" ON "UG"."groupId" = "G".id WHERE "UG"."userId" = "User".id) AS "userGroup"
		  FROM "User"
   WHERE "User".id =${id};
        `);

        const userData: UserData = {
          id: data[0].id,
          username: data[0].username,
          //   defaultCompanyId: data[0].defaultCompanyId,
          password: "",
          userRole: data[0].userRole,
          userGroup: data[0].userGroup,
          //   companyUser: data[0].companyUser,
        };

        return userData;
      },

      // async actCreate(this: any, createdData: any) {
      //   const { password, ...userData } = createdData;

      //   const hashedPassword = await bcrypt.hash(password, 10);
      //   const newData = {
      //     ...userData,
      //     password: hashedPassword,
      //     createdAt: new Date(),
      //   };

      //   const createdItem = await this.create({
      //     data: newData,
      //   });

      //   return createdItem;
      // },
    },
  },
});

export default userModel;
