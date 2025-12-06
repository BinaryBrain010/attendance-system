import accessModel from "../models/access.model";
import featurePermissionModel from "../../Features/models/featurePermission.model";
import { ParentType } from "@prisma/client";

class AccessService {
  async getUserGroup(id: string): Promise<any> {
    return await accessModel.user.getUserGroups(id);
  }

  async getUserRole(id: string): Promise<any> {
    return await accessModel.user.getUserRoles(id);
  }

  async getPermission(id: string, feature: string): Promise<boolean> {
    return await accessModel.user.isFeatureAllowed(id, feature);
  }

  async checkPermission(id: string, feature: string): Promise<boolean> {
    return await accessModel.user.checkUserPermission(id, feature);
  }

  async checkPermissions(id: string, features: string[]): Promise<any> {
    return await accessModel.user.checkUserPermissions(id, features);
  }

  async getAllowedFeaturesForUser(userId: string): Promise<string[]> {
    try {
      // Special admin user - return all features (or handle separately)
      if (userId === "58c55d6a-910c-46f8-a422-4604bea6cd15") {
        // For admin, you might want to return all features or a special marker
        // For now, we'll still aggregate permissions normally
      }

      const allowedFeaturesSet = new Set<string>();

      // 1. Get user's direct permissions
      const userPermissions = await featurePermissionModel.featurePermission.gpGetAllowedFeatures(
        ParentType.User,
        userId
      );
      if (userPermissions && !Array.isArray(userPermissions) && userPermissions.allowedFeatures) {
        userPermissions.allowedFeatures.forEach((feature: string) => {
          allowedFeaturesSet.add(feature);
        });
      }

      // 2. Get user's groups and their permissions
      const userGroups = await accessModel.user.getUserGroups(userId);
      for (const group of userGroups) {
        const groupPermissions = await featurePermissionModel.featurePermission.gpGetAllowedFeatures(
          ParentType.Group,
          group.id
        );
        if (groupPermissions && !Array.isArray(groupPermissions) && groupPermissions.allowedFeatures) {
          groupPermissions.allowedFeatures.forEach((feature: string) => {
            allowedFeaturesSet.add(feature);
          });
        }
      }

      // 3. Get user's direct roles and their permissions
      const userRoles = await accessModel.user.getUserRoles(userId);
      for (const role of userRoles) {
        const rolePermissions = await featurePermissionModel.featurePermission.gpGetAllowedFeatures(
          ParentType.Role,
          role.roleId
        );
        if (rolePermissions && !Array.isArray(rolePermissions) && rolePermissions.allowedFeatures) {
          rolePermissions.allowedFeatures.forEach((feature: string) => {
            allowedFeaturesSet.add(feature);
          });
        }
      }

      // 4. Get roles from groups and their permissions
      for (const group of userGroups) {
        const groupRoles = await accessModel.user.getGroupRoles(group.id);
        for (const groupRole of groupRoles) {
          const rolePermissions = await featurePermissionModel.featurePermission.gpGetAllowedFeatures(
            ParentType.Role,
            groupRole.roleId
          );
          if (rolePermissions && !Array.isArray(rolePermissions) && rolePermissions.allowedFeatures) {
            rolePermissions.allowedFeatures.forEach((feature: string) => {
              allowedFeaturesSet.add(feature);
            });
          }
        }
      }

      return Array.from(allowedFeaturesSet).sort();
    } catch (error) {
      console.error("Error getting allowed features for user:", error);
      throw error;
    }
  }
}

export default AccessService;
