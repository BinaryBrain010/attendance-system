import { AppFeature } from "@prisma/client";
import { createFeaturePermission } from "../types/access";
import { prisma } from "../../../../core/database/prisma.client";

const accessModel = prisma.$extends({
  model: {
    $allModels: {
      async getUserGroups(userId: string) {
        try {
          const groups = await prisma.group.findMany({
            where: {
              userGroups: {
                some: {
                  userId: userId,
                  active: true,
                },
              },
            },
          });
          return groups;
        } catch (error) {
          console.error("Error fetching user groups:", error);
          return [];
        }
      },
      async getUserGroupsIds(userId: string): Promise<string[]> {
        try {
          const groups = await prisma.group.findMany({
            where: {
              userGroups: {
                some: {
                  userId: userId,
                  active: true,
                },
              },
            },
            select: {
              id: true,
            },
          });
          return groups.map((group) => group.id);
        } catch (error) {
          console.error("Error fetching user groups:", error);
          return [];
        }
      },

      async getUserRoles(userId: string) {
        try {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: userId,
              active: true,
            },
          });

          if (userRoles.length === 0) {
            return [];
          }

          return userRoles;
        } catch (error) {
          console.error("Error fetching user roles:", error);
          return [];
        }
      },

      async getGroupRoles(groupId: string) {
        try {
          const groupRoles = await prisma.groupRole.findMany({
            where: {
              groupId: groupId,
              active: true,
            },
          });

          if (groupRoles.length === 0) {
            return [];
          }

          return groupRoles;
        } catch (error) {
          console.error("Error fetching group roles:", error);
          return [];
        }
      },

      async getUserRolesIds(userId: string) {
        try {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: userId,
              active: true,
            },
            select: {
              roleId: true,
            },
          });

          return userRoles.map((role) => role.roleId);
        } catch (error) {
          console.error("Error fetching user roles:", error);
          return [];
        }
      },

      async getGroupRolesIds(groupId: string) {
        try {
          const groupRoles = await prisma.groupRole.findMany({
            where: {
              groupId: groupId,
              active: true,
            },
            select: {
              roleId: true,
            },
          });

          return groupRoles.map((role) => role.roleId);
        } catch (error) {
          console.error("Error fetching group roles:", error);
          return [];
        }
      },

      async getRoleIds(userId: string) {
        try {
          const userRoleIds = await this.getUserRolesIds(userId);
          const userGroups = await accessModel.user.getUserGroups(userId);
          let groupRoleIds: string[] = [];

          for (const group of userGroups) {
            const roles = await this.getGroupRolesIds(group.id);
            groupRoleIds = [...groupRoleIds, ...roles];
          }

          return [...userRoleIds, ...groupRoleIds];
        } catch (error) {
          console.error("Error fetching combined role IDs:", error);
          return [];
        }
      },

      async checkUserPermission(
        userId: string,
        featureId: string,
      ) {
        try {
          // Bypass permission checks if userId matches the specified value
          if (
            userId === "58c55d6a-910c-46f8-a422-4604bea6cd15"
          ) {
            // Check if the featureId matches one of the restricted IDs
            if (
            //   featureId === "ca.create.*" ||
            //   featureId === "voucher.create.*" ||
              featureId === "contact.create.*"
            ) {
              return false; // Special case: deny permission
            } else {
              return true;
            }
          }

          if (userId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
            return true;
          }

          const feature: AppFeature | null = await prisma.appFeature.findUnique(
            {
              where: {
                name: featureId,
              },
            }
          );

          if (!feature) {
            return true;
          }

          const userRoles = await accessModel.user.getUserRoles(userId);

          const isAllowedDirectly = await accessModel.user.isFeatureAllowed(
            userId,
            featureId
          );

          if (isAllowedDirectly) {
            return true;
          }

          const userGroups = await accessModel.user.getUserGroups(userId);
          for (const group of userGroups) {
            const isAllowedInGroup = await accessModel.user.isFeatureAllowed(
              group.id,
              featureId
            );
            if (isAllowedInGroup) {
              return true;
            }
          }

          for (const group of userGroups) {
            const groupRoles = await accessModel.user.getGroupRoles(group.id);
            for (const role of groupRoles) {
              const isAllowedForRole = await accessModel.user.isFeatureAllowed(
                role.roleId,
                featureId
              );
              if (isAllowedForRole) {
                return true;
              }
            }
          }

          for (const role of userRoles) {
            if (role) {
              const isAllowedForRole = await accessModel.user.isFeatureAllowed(
                role.roleId,
                featureId
              );
              if (isAllowedForRole) {
                return true;
              }
            }
          }

          return false;
        } catch (error) {
          console.error("Error checking user permission:", error);
          return false;
        }
      },

      async checkUserPermissions(
        userId: string,
        featureIds: string[]
      ): Promise<{ [key: string]: boolean }> {
        const permissionPromises = featureIds.map(async (featureId: string) => {
  
          const permission = await this.checkUserPermission(userId, featureId);
          return { featureId, permission };
        });
      
        const results = await Promise.all(permissionPromises);

        return results.reduce((acc, { featureId, permission }) => {
          acc[featureId] = permission;
          return acc;
        }, {} as { [key: string]: boolean });
      }
,
      async isFeatureAllowed(parentId: string, featureId: string) {
        try {
          if (parentId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
            return true;
          }

          const permission: any = await prisma.featurePermission.findFirst({
            where: {
              parentId: parentId,
              isDeleted: null,
            },
          });

          if (!permission) {
            return false;
          }

          const allowedFeatures: string[] =
            permission.permissions?.allowedFeatures ?? [];

          if (Array.isArray(allowedFeatures)) {
            return allowedFeatures.includes(featureId);
          } else {
            console.error("allowedFeatures is not an array:", allowedFeatures);
            return false;
          }
        } catch (error) {
          console.error("Error checking feature permission:", error);
          return false;
        }
      },
    },
  },
});

export default accessModel;
