import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import DailyReportService from "../services/dailyReport.service";

const uid = (req: Request) => (req as any).userId as string;

class DailyReportController extends BaseController<DailyReportService> {
  protected service = new DailyReportService();

  async submit(req: Request, res: Response) {
    await this.handleRequest(() => this.service.submit(uid(req), req.body), res, {
      successMessage: "Daily report saved!", logActivity: { action: "UPSERT", entityType: "DailyReport", entityId: (r: any) => r?.id, description: "Daily report submitted" }, req,
    });
  }
  async myToday(req: Request, res: Response) {
    await this.handleRequest(() => this.service.myToday(uid(req), req.body?.date), res, { successMessage: "Report retrieved!" });
  }
  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body;
    await this.handleRequest(() => this.service.get(uid(req), page, pageSize, filters), res, { successMessage: "Reports retrieved!" });
  }
  async compliance(req: Request, res: Response) {
    await this.handleRequest(() => this.service.compliance(uid(req), req.body?.date), res, { successMessage: "Compliance retrieved!" });
  }
  async addComment(req: Request, res: Response) {
    const { id, body } = req.body;
    await this.handleRequest(() => this.service.addComment(uid(req), id, body), res, { successMessage: "Comment added!", statusCode: 201 });
  }
}

export default DailyReportController;
