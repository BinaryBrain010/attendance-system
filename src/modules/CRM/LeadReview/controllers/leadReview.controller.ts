import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeadReviewService from "../services/leadReview.service";

class LeadReviewController extends BaseController<LeadReviewService> {
  protected service = new LeadReviewService();

  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.create(uid, req.body), res, {
      successMessage: "Lead flagged.", statusCode: 201,
      logActivity: { action: "REVIEW_FLAG", entityType: "Lead", entityId: req.body?.leadId, description: `Lead flagged (${req.body?.colour})`, metadata: { colour: req.body?.colour, targetType: req.body?.targetType ?? "LEAD", sentToMyDay: !!(req.body?.sendToMyDay || req.body?.instruction) } }, req,
    });
  }
  async sendBack(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.sendBack(uid, req.body), res, {
      successMessage: "Sent to the owner's My Day.",
      logActivity: { action: "REVIEW_SENT", entityType: "Lead", entityId: (r: any) => r?.leadId, description: "Review sent to My Day" }, req,
    });
  }
  async forLead(req: Request, res: Response) {
    await this.handleRequest(() => this.service.forLead((req as any).userId, req.body?.leadId), res, { successMessage: "Reviews retrieved." });
  }
  async flagsForLeads(req: Request, res: Response) {
    await this.handleRequest(() => this.service.flagsForLeads((req as any).userId, req.body?.leadIds || []), res, { successMessage: "Flag summary retrieved." });
  }
  async myDay(req: Request, res: Response) {
    await this.handleRequest(() => this.service.myDay((req as any).userId), res, { successMessage: "My Day reviews retrieved." });
  }
  async reply(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.reply(uid, req.body), res, {
      successMessage: "Review marked done.",
      logActivity: { action: "REVIEW_DONE", entityType: "Lead", entityId: (r: any) => r?.leadId, description: "Review marked done" }, req,
    });
  }
  async reopen(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.reopen(uid, req.body), res, {
      successMessage: "Review reopened.",
      logActivity: { action: "REVIEW_REOPEN", entityType: "Lead", entityId: (r: any) => r?.leadId, description: "Review reopened" }, req,
    });
  }
}

export default LeadReviewController;
