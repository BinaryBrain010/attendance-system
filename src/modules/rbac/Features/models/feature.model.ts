import { AppFeature } from "../types/feature";
import prisma from "../../../../core/models/base.model";

const featureModel = prisma.$extends({
    model: {
      appFeature: {
        async getfeatureByName(this: any, name: string): Promise<boolean> {
          const feature = await this.findFirst({
            where: {
              name: name,
            },
          });
  
          if (feature) {
            return true;
          }
          return false;
        },
        
        async gpCount(userId: string, companyId?: string) {
          const count = await prisma.appFeature.count({
            where: {
              isDeleted: null,
            },
          });
          return count;
        },

        async gpGetByParent(this: any, parent: string): Promise<AppFeature[]> {
          const getParentAndChildren = async (
            parent: string
          ): Promise<AppFeature[]> => {
            const children = await this.findMany({
              where: {
                parentFeatureId: parent,
                isDeleted: null,
              },
            });
  
            const parentFeature = await this.findUnique({
              where: {
                name: parent,
                isDeleted: null,
              },
            });
  
            let data: AppFeature[] = [];
  
            if (parentFeature) {
              data.push(parentFeature);
            }
  
            for (const child of children) {
              const grandChildren = await getParentAndChildren(child.name);
              data = data.concat(grandChildren);
            }
  
            return data;
          };
  
          const data = await getParentAndChildren(parent);
  
          const uniqueData = Array.from(
            new Set(data.map((feature) => feature.name))
          ).map((id) => {
            return data.find((feature) => feature.name === id)!;
          });
  
          return uniqueData.map((item) => ({
            ...item,
            parentFeatureId:
              item.parentFeatureId === null ? undefined : item.parentFeatureId,
          }));
        },

        async gpGetHierarchy(this: any): Promise<Record<string, AppFeature[]>[]> {
          const features: AppFeature[] = await this.findMany({
            where: {
              isDeleted: null,
            },
          });

          const normalize = (f: any): AppFeature => ({
            ...f,
            parentFeatureId: f.parentFeatureId === null ? undefined : f.parentFeatureId,
          });

          const normalized = features.map(normalize);

          const byParent = new Map<string | undefined, AppFeature[]>();
          for (const f of normalized) {
            const key = f.parentFeatureId;
            const arr = byParent.get(key) || [];
            arr.push(f);
            byParent.set(key, arr);
          }

          const getDescendants = (parentName: string): AppFeature[] => {
            const directChildren = byParent.get(parentName) || [];
            let all: AppFeature[] = [...directChildren];
            for (const child of directChildren) {
              all = all.concat(getDescendants(child.name));
            }
            return all;
          };

          const topLevelParents = (byParent.get(undefined) || []).sort((a, b) =>
            a.name.localeCompare(b.name)
          );

          const result: Record<string, AppFeature[]> = {};
          for (const parent of topLevelParents) {
            result[parent.name] = [parent, ...getDescendants(parent.name)];
          }

          return [result];
        },
      },
    },
  });

  export default featureModel;
