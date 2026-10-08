import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import SalesAgentService from "../services/salesAgent.service";

class SalesAgentController extends BaseController<SalesAgentService> {
  protected service = new SalesAgentService();

  async getAll(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.getAll(), res, { successMessage: "Agents retrieved successfully!" });
  }
  async get(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.get(page, pageSize), res, { successMessage: "Agents retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById(id), res, { successMessage: "Agent retrieved successfully!" });
  }
  async me(req: Request, res: Response) {
    await this.handleRequest(() => this.service.me((req as any).userId), res, { successMessage: "Agent profile retrieved successfully!" });
  }
  async total(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.total(), res, { successMessage: "Total agents retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Agent created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesAgent", entityId: (r: any) => r?.[0]?.id, description: `Agent created: ${req.body?.agentCode ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Agent updated successfully!",
      logActivity: { action: "UPDATE", entityType: "SalesAgent", entityId: id, description: "Agent updated" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Agent deleted successfully!",
      logActivity: { action: "DELETE", entityType: "SalesAgent", entityId: id, description: "Agent deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Agent restored successfully!",
      logActivity: { action: "RESTORE", entityType: "SalesAgent", entityId: id, description: "Agent restored" }, req,
    });
  }
  async search(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    await this.handleRequest(() => this.service.search(searchTerm, page, pageSize), res, { successMessage: "Agents retrieved successfully!" });
  }
}

export default SalesAgentController;
