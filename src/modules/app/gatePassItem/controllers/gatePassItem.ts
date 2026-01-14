import { Request, Response } from 'express';
import BaseController from '../../../../core/controllers/base.controller';
import GatePassItemService from '../services/gatePassItem.service';
import { GatePassItem } from '../../../../types/schema';

class GatePassItemController extends BaseController<GatePassItemService> {
  protected service = new GatePassItemService();

  async getAllGatePassItem(req: Request, res: Response) {
    const operation = () => this.service.getAllGatePassItem();
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePassItem(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getGatePassItem(page,pageSize);
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalGatePassItem(req: Request, res: Response) {
    const operation = () => this.service.getTotalGatePassItem();
    const successMessage = 'Total GatePassItem count retrieved successfully!';
    const errorMessage = 'Error retrieving total GatePassItem count:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async createGatePassItem(req: Request, res: Response) {
    const GatePassItemData: GatePassItem = req.body;
    const operation = () => this.service.createGatePassItem(GatePassItemData);
    const successMessage = 'GatePassItem created successfully!';
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "GatePassItem",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `GatePassItem created for gate pass: ${GatePassItemData.gatePassId || 'N/A'}`,
        metadata: {
          gatePassId: GatePassItemData.gatePassId,
          itemId: GatePassItemData.itemId,
          quantity: GatePassItemData.quantity
        }
      },
      req
    });
  }

  async updateGatePassItem(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateGatePassItem(id, data);
    const successMessage = 'GatePassItem updated successfully!';
    const errorMessage = 'Error updating GatePassItem:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteGatePassItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteGatePassItem(id);
    const successMessage = 'GatePassItem deleted successfully!';
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "GatePassItem",
        entityId: id,
        description: "GatePassItem deleted"
      },
      req
    });
  }

  async getGatePassItemById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassItemById(id);
    const successMessage = 'GatePassItem retrieved successfully!';
    const errorMessage = 'Error retrieving GatePassItem:';
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreGatePassItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreGatePassItem(id);
    const successMessage = 'GatePassItem restored successfully!';
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "GatePassItem",
        entityId: id,
        description: "GatePassItem restored"
      },
      req
    });
  }
}

export default GatePassItemController;
