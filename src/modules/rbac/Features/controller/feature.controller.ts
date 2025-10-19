import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AppFeatureService from "../service/feature.service";
import { AppFeature } from "../types/feature";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class AppFeatureController extends BaseController<AppFeatureService> {
  protected service = new AppFeatureService();
  protected moduleName: string = "RBAC";

  protected handle(operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string,
    activityLog: string,
    res: Response,
    req: Request,
    entityId?: string
  ) {
    this.handleRequest(operation, successMessage, errorMessage, activityLog, res, req, this.moduleName, entityId);
  }

  async getAllAppFeatures(req: Request, res: Response) {
    let operation = () => this.service.getAllAppFeatures();
    let successMessage = "App features retrieved successfully!";
    let errorMessage = "Error retrieving app features:";
     let activityLog = `Fetched all app features`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalAppFeatures(req: Request, res: Response) {
    const id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let operation = () => this.service.totalFeatures(id);
      let successMessage = "App features retrieved successfully!";
      let errorMessage = "Error retrieving app features:";
        let activityLog = `Fetched total app features count`;
        this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
  }

  async createAppFeature(req: Request, res: Response) {
    let featureData: AppFeature = req.body;
    let operation = () => this.service.createAppFeature(featureData);
    let successMessage = "Feature created successfully!";
    let errorMessage = "Error creating feature:";
     let activityLog = `Created app feature: ${featureData.name}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateAppFeature(req: Request, res: Response) {
    let { id, data } = req.body;

    let operation = () => this.service.updateAppFeature(id, data);
    let successMessage = "Feature updated successfully!";
    let errorMessage = "Error updating feature:";
    let activityLog = `Updated app feature with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteAppFeature(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteAppFeature(id);
    let successMessage = "Feature deleted successfully!";
    let errorMessage = "Error deleting feature:";
    let activityLog = `Deleted app feature with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getAppFeatureByParent(req: Request, res: Response) {
    let { parent } = req.body;
    let operation = () => this.service.getAppFeatureByParent(parent);
    let successMessage = "Feature fetched successfully!";
    let errorMessage = "Error fetching feature:";
    let activityLog = `Fetched app features by parent: ${parent}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async restoreAppFeature(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreAppFeature(id);
    let successMessage = "Feature restored successfully!";
    let errorMessage = "Error restoring feature:";
    let activityLog = `Restored app feature with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getAppFeatureById(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id, userId);
      let successMessage = "Feature retrieved successfully!";
      let errorMessage = "Error retrieving feature:";
      let activityLog = `Fetched app feature with ID: ${id}`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }
}

export default AppFeatureController;
