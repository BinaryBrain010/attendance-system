import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import UnitService from "../services/unit.service";
import { Unit } from "../types/unit";

class UnitController extends BaseController<UnitService> {
  protected service = new UnitService();

  async getAllUnits(req: Request, res: Response) {
    const operation = () => this.service.getAllUnits();
    await this.handleRequest(operation, res, { successMessage: "Units retrieved successfully!" });
  }

  async getUnits(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getUnits(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Units retrieved successfully!" });
  }

  async getDeletedUnits(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getDeletedUnits(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted units retrieved successfully!" });
  }

  async createUnit(req: Request, res: Response) {
    const unitData: Unit & { createdByUserId?: string } = req.body;
    const operation = () => this.service.createUnit(unitData);
    await this.handleRequest(operation, res, { successMessage: "Unit created successfully!" });
  }

  async updateUnit(req: Request, res: Response) {
    const { id, ...data } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    const operation = () => this.service.updateUnit(id, data);
    await this.handleRequest(operation, res, { successMessage: "Unit updated successfully!" });
  }

  async deleteUnit(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    const operation = () => this.service.deleteUnit(id);
    await this.handleRequest(operation, res, { successMessage: "Unit deleted successfully!" });
  }

  async restoreUnit(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    const operation = () => this.service.restoreUnit(id);
    await this.handleRequest(operation, res, { successMessage: "Unit restored successfully!" });
  }

  async getUnitById(req: Request, res: Response) {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    const operation = () => this.service.getUnitById(id as string);
    await this.handleRequest(operation, res, { successMessage: "Unit retrieved successfully!" });
  }

  async getTotalUnits(req: Request, res: Response) {
    const operation = () => this.service.getTotalUnits();
    await this.handleRequest(operation, res, { successMessage: "Total units count retrieved successfully!" });
  }

  async searchUnits(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }
    const pageNum = page || 1;
    const pageSizeNum = pageSize || 10;
    const operation = () => this.service.searchUnits(searchTerm, pageNum, pageSizeNum);
    await this.handleRequest(operation, res, { successMessage: "Units search completed successfully!" });
  }

  async getHistoryById(req: Request, res: Response) {
    const { id, filter, date } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: "Unit ID is required" });
    }

    const filterBool = filter === true || filter === "true";
    
    const operation = () => this.service.getHistoryById(id, filterBool, date);
    await this.handleRequest(operation, res, { successMessage: "Unit history retrieved successfully!" });
  }
}

export default UnitController;
