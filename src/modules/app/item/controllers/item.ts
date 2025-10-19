import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import itemService from "../services/item.service";
import { Item } from "../../../../types/schema";

class ItemController extends BaseController<itemService> {
  protected service = new itemService();
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

  async getAllItem(req: Request, res: Response) {
    const operation = () => this.service.getAllItem();
    const successMessage = "Item retrieved successfully!";
    const errorMessage = "Error retrieving Item:";
    const activityLog = `Fetched all items`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getOutOfStockItem(req: Request, res: Response) {
    const operation = () => this.service.getOutOfStockItems();
    const successMessage = "out of stock Item retrieved successfully!";
    const errorMessage = "Error retrieving out of stock Item:";
    const activityLog = `Fetched out of stock items`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getItem(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getItem(page, pageSize);
    const successMessage = "Item retrieved successfully!";
    const errorMessage = "Error retrieving Item:";
    const activityLog = `Fetched items for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getDeletedItem(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedItem(page, pageSize);
    const successMessage = "Item retrieved successfully!";
    const errorMessage = "Error retrieving Item:";
    const activityLog = `Fetched deleted items for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalItem(req: Request, res: Response) {
    const operation = () => this.service.getTotalItem();
    const successMessage = "Total Item count retrieved successfully!";
    const errorMessage = "Error retrieving total Item count:";
    const activityLog = `Fetched total items count`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createItem(req: Request, res: Response) {
    const ItemData: Item = req.body;
    const operation = () => this.service.createItem(ItemData);
    const successMessage = "Item created successfully!";
    const errorMessage = "Error creating Item:";
    const activityLog = `Created item: ${ItemData.name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, ItemData.id);
  }

  async updateItem(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateItem(id, data);
    const successMessage = "Item updated successfully!";
    const errorMessage = "Error updating Item:";
    const activityLog = `Updated item with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteItem(id);
    const successMessage = "Item deleted successfully!";
    const errorMessage = "Error deleting Item:";
    const activityLog = `Deleted item with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async searchItems(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchItems(searchTerm, page, pageSize);
    const successMessage = "Items retrieved successfully!";
    const errorMessage = "Error retrieving Items:";
    const activityLog = `Searched items with term "${searchTerm}" for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getItemById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getItemById(id);
    const successMessage = "Item retrieved successfully!";
    const errorMessage = "Error retrieving Item:";
    const activityLog = `Fetched item with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreItem(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreItem(id);
    const successMessage = "Item restored successfully!";
    const errorMessage = "Error restoring Item:";
    const activityLog = `Restored item with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default ItemController;
