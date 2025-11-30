import { Request, Response } from 'express';
import BaseController from '../../../../core/controllers/base.controller';
import FeaturePermissionService from '../service/featurePermission.service';
import { createFeaturePermission, FeaturePermission } from '../types/feature';
import AuthHelper from '../../../../Auth/helper/auth.helper';

class FeaturePermissionController extends BaseController<FeaturePermissionService> {
  protected service = new FeaturePermissionService();

  async getAllFeaturePermissions(req: Request, res: Response) {
    let operation = () => this.service.getAllFeaturePermissions();
    let successMessage = 'Feature permissions retrieved successfully!';
    let errorMessage = 'Error retrieving feature permissions:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async createFeaturePermission(req: Request, res: Response) {
    let permissionData: createFeaturePermission= req.body;
    let operation = () => this.service.createFeaturePermission(permissionData);
    let successMessage = 'Permission created successfully!';
    let errorMessage = 'Error creating permission:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateFeaturePermission(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateFeaturePermission(id, data);
    let successMessage = 'Permission updated successfully!';
    let errorMessage = 'Error updating permission:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async getAllowedFeatures(req: Request, res: Response) {
    let {parentType,parentId} = req.body;

    let operation = () => this.service.gpGetAllowedFeatures(parentId,parentType);
    let successMessage = 'Permission getting allowed successfully!';
    let errorMessage = 'Error allowed features permission:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteFeaturePermission(req: Request, res: Response) {
    let {id} = req.body;
    let operation = () => this.service.deleteFeaturePermission(id);
    let successMessage = 'Permission deleted successfully!';
    let errorMessage = 'Error deleting permission:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreFeaturePermission(req: Request, res: Response) {
    let {id} = req.body;
    let operation = () => this.service.restoreFeaturePermission(id);
    let successMessage = 'Permission restored successfully!';
    let errorMessage = 'Error restoring permission:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async getFeaturePermissionById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
    let {id} = req.body;
    let operation = () => this.service.getById(id);
    let successMessage = 'Feature permission retrieved successfully!';
    let errorMessage = 'Error retrieving feature permission:';
    await this.handleRequest(operation, res, { successMessage });
  // }
}
}

export default FeaturePermissionController;
