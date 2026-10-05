import { ParentType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  createFeaturePermission,
  FeaturePermission} from "../types/feature"
import prisma from "../../../../core/models/base.model";

const featurePermissionModel = prisma.$extends({
  model: {
    featurePermission: {
      async gpCreate(this: any, permissionData: createFeaturePermission) {
        const newPermission = await prisma.featurePermission.create({
          data: {
            parentType: permissionData.parentType,
            parentId: permissionData.parentId,
            permissions: {
              allowedFeatures: permissionData.allowedFeatures,
            },
            createdAt: new Date(),
          },
        });
        return newPermission;
      },

      async gpGetAllowedFeatures(
        this: any,
        parentType: ParentType,
        parentId: string
      ) {
        try {
          // Only active (not soft-deleted) permission rows, and union the allowed features
          // across ALL active rows for this parent (not just the first), so revoking a
          // permission actually removes it and multiple rows are honoured.
          const rows: {id:string, allowedFeatures: string[] }[] = await prisma.$queryRaw(
            Prisma.sql`SELECT id, COALESCE(permissions->'allowedFeatures', '[]'::jsonb) AS "allowedFeatures"
            FROM public."FeaturePermission"
            WHERE "parentId" = ${parentId} AND "parentType" = ${parentType}::"ParentType" AND "isDeleted" IS NULL`
          );

          if (!rows || rows.length === 0) {
            return [];
          }
          const merged = new Set<string>();
          for (const row of rows) {
            const arr = Array.isArray(row.allowedFeatures) ? row.allowedFeatures : [];
            for (const f of arr) merged.add(f);
          }
          return { id: rows[0].id, allowedFeatures: Array.from(merged) };
        } catch (error) {
          console.error("Error fetching allowed features:", error);
          throw error;
        }
      }
,      

      async gpUpdate(
        this: any,
        id: string,
        permissionData: createFeaturePermission
      ) {
        const updatedItem = await this.update({
          where: { id: id },
          data: {
            parentType: permissionData.parentType,
            parentId: permissionData.parentId,
            permissions: {
              allowedFeatures: permissionData.allowedFeatures,
            },
            updatedAt: new Date(),
          },
        });
      },
    },
  },
});

export default featurePermissionModel;
