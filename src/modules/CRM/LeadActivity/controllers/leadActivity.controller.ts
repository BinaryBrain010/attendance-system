import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeadActivityService from "../services/leadActivity.service";

class LeadActivityController extends BaseController<LeadActivityService> {
  protected service = new LeadActivityService();

  async byLead(req: Request, res: Response) {
    const { leadId } = req.body;
    await this.handleRequest(() => this.service.byLead((req as any).userId, leadId), res, { successMessage: "Activities retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.create(uid, req.body), res, {
      successMessage: "Activity logged successfully!", statusCode: 201,
      logActivity: { action: "ACTIVITY", entityType: "Lead", entityId: req.body?.leadId, description: `Activity: ${req.body?.type ?? ""}`, metadata: { type: req.body?.type, outcome: req.body?.outcome } }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update((req as any).userId, id, rest), res, { successMessage: "Activity updated successfully!" });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove((req as any).userId, id), res, { successMessage: "Activity deleted successfully!" });
  }
}

export default LeadActivityController;
