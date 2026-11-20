import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import { AppError } from "../../../../core/errors/app.error";
import { getAccessibleEmployeeIds } from "../../../AMS/Unit/helper/unitAccess.helper";
import StorageService from "../services/storage.service";

class StorageController extends BaseController<StorageService> {
  protected service = new StorageService();

  /** One employee's breakdown (employee page). Unit scoping applies as on the employee itself. */
  async employee(req: Request, res: Response) {
    await this.handleRequest(async () => {
      const employeeId = req.body?.employeeId;
      const scope = await getAccessibleEmployeeIds((req as any).userId);
      if (scope !== null && !scope.includes(employeeId)) throw new AppError(403, "This employee is outside your units.");
      return this.service.employee(employeeId);
    }, res, { req });
  }

  /** Every employee sorted by size, with system totals (Administration > Storage). */
  async list(req: Request, res: Response) {
    await this.handleRequest(() => this.service.list(req.body || {}), res, { req });
  }
}

export default StorageController;
