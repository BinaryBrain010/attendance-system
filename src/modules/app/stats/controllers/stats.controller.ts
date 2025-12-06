import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import StatsService from "../services/stats.service";

class StatsController extends BaseController<StatsService> {
  protected service = new StatsService();

  async getDashboardStats(req: Request, res: Response) {
    const operation = () => this.service.getDashboardStats();
    const successMessage = "Dashboard stats retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePassStats(req: Request, res: Response) {
    const operation = () => this.service.getGatePassStats();
    const successMessage = "Gate pass stats retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getCustomerStats(req: Request, res: Response) {
    const operation = () => this.service.getCustomerStats();
    const successMessage = "Customer stats retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getItemStats(req: Request, res: Response) {
    const operation = () => this.service.getItemStats();
    const successMessage = "Item stats retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getStatsByDateRange(req: Request, res: Response) {
    const { from, to } = req.body;
    
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "From and to dates are required",
        statusCode: 400,
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
        statusCode: 400,
      });
    }

    const operation = () => this.service.getStatsByDateRange(fromDate, toDate);
    const successMessage = "Stats by date range retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getWidgetData(req: Request, res: Response) {
    const operation = () => this.service.getWidgetData();
    const successMessage = "Widget data retrieved successfully!";
    await this.handleRequest(operation, res, { successMessage });
  }
}

export default StatsController;

