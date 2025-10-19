import { Request, Response } from 'express';
import BaseController from '../../../../core/controllers/base.controller';
import FeaturePermissionService from '../service/featurePermission.service';
import { createFeaturePermission, FeaturePermission } from '../types/feature';
import AuthHelper from '../../../../Auth/helper/auth.helper';

class FeaturePermissionController extends BaseController<FeaturePermissionService> {
  protected service = new FeaturePermissionService();
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

  async getAllFeaturePermissions(req: Request, res: Response) {
    let operation = () => this.service.getAllFeaturePermissions();
    let successMessage = 'Feature permissions retrieved successfully!';
    let errorMessage = 'Error retrieving feature permissions:';
     let activityLog = `Fetched all feature permissions`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createFeaturePermission(req: Request, res: Response) {
    let permissionData: createFeaturePermission= req.body;
    let operation = () => this.service.createFeaturePermission(permissionData);
    let successMessage = 'Permission created successfully!';
    let errorMessage = 'Error creating permission:';

    // no feature id available in featurePermissionModel.model
    //  let activityLog = `Created feature permission for feature ID: ${permissionData.featureId}`;
    let activityLog = `Created feature permission`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateFeaturePermission(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateFeaturePermission(id, data);
    let successMessage = 'Permission updated successfully!';
    let errorMessage = 'Error updating permission:';
     let activityLog = `Updated feature permission with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getAllowedFeatures(req: Request, res: Response) {
    let {parentType,parentId} = req.body;

    let operation = () => this.service.gpGetAllowedFeatures(parentId,parentType);
    let successMessage = 'Permission getting allowed successfully!';
    let errorMessage = 'Error allowed features permission:';
     let activityLog = `Fetched allowed features for parentType: ${parentType}, parentId: ${parentId}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, parentId);
  }

  async deleteFeaturePermission(req: Request, res: Response) {
    let {id} = req.body;
    let operation = () => this.service.deleteFeaturePermission(id);
    let successMessage = 'Permission deleted successfully!';
    let errorMessage = 'Error deleting permission:';
     let activityLog = `Deleted feature permission with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreFeaturePermission(req: Request, res: Response) {
    let {id} = req.body;
    let operation = () => this.service.restoreFeaturePermission(id);
    let successMessage = 'Permission restored successfully!';
    let errorMessage = 'Error restoring permission:';
     let activityLog = `Restored feature permission with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getFeaturePermissionById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
    let {id} = req.body;
    let operation = () => this.service.getById(id);
    let successMessage = 'Feature permission retrieved successfully!';
    let errorMessage = 'Error retrieving feature permission:';
     let activityLog = `Fetched feature permission with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  // }
}
}

export default FeaturePermissionController;
