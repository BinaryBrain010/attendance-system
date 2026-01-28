import featureModel from "../models/feature.model";
import { AppFeature } from "../types/feature";
import { paginatedData } from "../../../../types/paginatedData";

class AppFeatureService {
  async getAllAppFeatures(): Promise<AppFeature[]> {
    return await featureModel.appFeature.gpFindMany();
  }

  async getAppFeatures(page: number, pageSize: number): Promise<paginatedData> {
    return await featureModel.appFeature.gpPgFindMany(page, pageSize);
  }

  async createAppFeature(
    featureData: AppFeature | AppFeature[]
  ): Promise<AppFeature | AppFeature[]> {
    return await featureModel.appFeature.gpCreate(featureData);
  }

  async updateAppFeature(
    featureId: string,
    featureData: AppFeature
  ): Promise<AppFeature | null> {
    return await featureModel.appFeature.gpUpdateByName(
      featureId,
      featureData
    );
  }

  async deleteAppFeature(featureId: string): Promise<void> {
    await featureModel.appFeature.gpSoftDelete(featureId);
  }
  async getAppFeatureByParent(parent: string) {
    return await featureModel.appFeature.gpGetByParent(parent);
    // return await featureModel.appFeature.actGetChildFeatures();
  }

  async getAppFeatureHierarchy(): Promise<Record<string, AppFeature[]>[]> {
    return await featureModel.appFeature.gpGetHierarchy();
  }

  async restoreAppFeature(featureId: string): Promise<void> {
    return await featureModel.appFeature.gpRestore(featureId);
  }

  async getById(featureId: string,userId:string): Promise<AppFeature[]> {
    return await featureModel.appFeature.gpFindById(featureId);
  }

  async alreadyExist(name: string): Promise<boolean> {
    return await featureModel.appFeature.getfeatureByName(name);
  }

  async totalFeatures(userId:string): Promise<number> {
    return await featureModel.appFeature.gpCount("58c55d6a-910c-46f8-a422-4604bea6cd15");
  }
}

export default AppFeatureService;
