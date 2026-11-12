import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import HrPolicyService from "../services/hrPolicy.service";

const uid = (req: Request) => (req as any).userId as string | undefined;

class HrPolicyController extends BaseController<HrPolicyService> {
  protected service = new HrPolicyService();

  // Settings
  async getSettings(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.getSettings(), res, { successMessage: "HR settings retrieved!" });
  }
  async updateSettings(req: Request, res: Response) {
    await this.handleRequest(() => this.service.updateSettings(req.body || {}), res, { successMessage: "HR settings updated!" });
  }

  // Rules
  async listRules(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.listRules(), res, { successMessage: "Policy rules retrieved!" });
  }
  async upsertRule(req: Request, res: Response) {
    await this.handleRequest(() => this.service.upsertRule(req.body || {}), res, { successMessage: "Policy rule saved!" });
  }
  async removeRule(req: Request, res: Response) {
    await this.handleRequest(() => this.service.removeRule(req.body?.id), res, { successMessage: "Policy rule removed!" });
  }

  // Entitlement
  async previewEntitlement(req: Request, res: Response) {
    const { employeeId, year } = req.body || {};
    await this.handleRequest(() => this.service.previewEntitlement(employeeId, Number(year) || new Date().getFullYear()), res, { successMessage: "Entitlement computed!" });
  }
  async applyEntitlement(req: Request, res: Response) {
    const { employeeId, year } = req.body || {};
    await this.handleRequest(() => this.service.applyEntitlement(employeeId, Number(year) || new Date().getFullYear()), res, { successMessage: "Entitlement applied!" });
  }
  async adjustEntitlement(req: Request, res: Response) {
    const { employeeId, year, days, reason } = req.body || {};
    await this.handleRequest(() => this.service.manualAdjustEntitlement(employeeId, Number(year) || new Date().getFullYear(), Number(days), reason, uid(req)), res, { successMessage: "Entitlement adjusted!" });
  }

  // Probation
  async probationDue(req: Request, res: Response) {
    const within = req.body?.withinDays != null ? Number(req.body.withinDays) : 7;
    await this.handleRequest(() => this.service.probationDue(uid(req), within), res, { successMessage: "Probation list retrieved!" });
  }
  async probationHistory(req: Request, res: Response) {
    await this.handleRequest(() => this.service.probationHistory(req.body?.employeeId), res, { successMessage: "Probation history retrieved!" });
  }
  async probationDecide(req: Request, res: Response) {
    const { employeeId, decision, newEndDate, reason } = req.body || {};
    await this.handleRequest(() => this.service.decide(uid(req), employeeId, decision, { newEndDate, reason }), res, { successMessage: "Decision recorded!" });
  }
}

export default HrPolicyController;
