import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AppFeatureService from "../service/feature.service";
import { AppFeature } from "../types/feature";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class AppFeatureController extends BaseController<AppFeatureService> {
  protected service = new AppFeatureService();

  async getAllAppFeatures(req: Request, res: Response) {
    let operation = () => this.service.getAllAppFeatures();
    let successMessage = "App features retrieved successfully!";
    let errorMessage = "Error retrieving app features:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalAppFeatures(req: Request, res: Response) {
    const id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let operation = () => this.service.totalFeatures(id);
      let successMessage = "App features retrieved successfully!";
      let errorMessage = "Error retrieving app features:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async createAppFeature(req: Request, res: Response) {
    let featureData: AppFeature = req.body;
    let operation = () => this.service.createAppFeature(featureData);
    let successMessage = "Feature created successfully!";
    let errorMessage = "Error creating feature:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateAppFeature(req: Request, res: Response) {
    let { id, data } = req.body;

    let operation = () => this.service.updateAppFeature(id, data);
    let successMessage = "Feature updated successfully!";
    let errorMessage = "Error updating feature:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteAppFeature(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteAppFeature(id);
    let successMessage = "Feature deleted successfully!";
    let errorMessage = "Error deleting feature:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getAppFeatureByParent(req: Request, res: Response) {
    let { parent } = req.body;
    let operation = () => this.service.getAppFeatureByParent(parent);
    let successMessage = "Feature fetched successfully!";
    let errorMessage = "Error fetching feature:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreAppFeature(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreAppFeature(id);
    let successMessage = "Feature restored successfully!";
    let errorMessage = "Error restoring feature:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getAppFeatureById(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id, userId);
      let successMessage = "Feature retrieved successfully!";
      let errorMessage = "Error retrieving feature:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }
}

export default AppFeatureController;
