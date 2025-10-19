import { Request, Response } from 'express';
import BaseController from '../../../../core/controllers/base.controller';
import GatePassItemService from '../services/gatePassItem.service';
import { GatePassItem } from '../../../../types/schema';

class GatePassItemController extends BaseController<GatePassItemService> {
  protected service = new GatePassItemService();
  protected moduleName: string = "APP";

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

  async getAllGatePassItem(req: Request, res: Response) {
    const operation = () => this.service.getAllGatePassItem();
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    const activityLog = `Fetched all GatePassItems`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getGatePassItem(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getGatePassItem(page,pageSize);
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    const activityLog = `Fetched GatePassItems for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalGatePassItem(req: Request, res: Response) {
    const operation = () => this.service.getTotalGatePassItem();
    const successMessage = 'Total GatePassItem count retrieved successfully!';
    const errorMessage = 'Error retrieving total GatePassItem count:';
    const activityLog = `Fetched total GatePassItems count`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createGatePassItem(req: Request, res: Response) {
    const GatePassItemData: GatePassItem = req.body;
    const operation = () => this.service.createGatePassItem(GatePassItemData);
    const successMessage = 'GatePassItem created successfully!';
    const errorMessage = 'Error creating GatePassItem:';
    const activityLog = `Created GatePassItem for item ID: ${GatePassItemData.itemId}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, GatePassItemData.itemId);
  }

  async updateGatePassItem(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateGatePassItem(id, data);
    const successMessage = 'GatePassItem updated successfully!';
    const errorMessage = 'Error updating GatePassItem:';
    const activityLog = `Updated GatePassItem with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteGatePassItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteGatePassItem(id);
    const successMessage = 'GatePassItem deleted successfully!';
    const errorMessage = 'Error deleting GatePassItem:';
    const activityLog = `Deleted GatePassItem with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getGatePassItemById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassItemById(id);
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    const activityLog = `Fetched GatePassItem with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreGatePassItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreGatePassItem(id);
    const successMessage = 'GatePassItem restored successfully!';
    const errorMessage = 'Error restoring GatePassItem:';
    const activityLog = `Restored GatePassItem with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default GatePassItemController;
