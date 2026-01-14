import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import UnitEmployeeService from "../services/unitEmployee.service";

class UnitEmployeeController extends BaseController<UnitEmployeeService> {
  protected service = new UnitEmployeeService();

  async getEmployeesByUnitId(req: Request, res: Response) {
    const { unitId } = req.body;
    if (!unitId) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    const operation = () => this.service.getEmployeesByUnitId(unitId);
    await this.handleRequest(operation, res, { successMessage: "Employees retrieved successfully!" });
  }

  async getUnitsByEmployeeId(req: Request, res: Response) {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }
    const operation = () => this.service.getUnitsByEmployeeId(employeeId);
    await this.handleRequest(operation, res, { successMessage: "Units retrieved successfully!" });
  }

  async assignEmployeesToUnit(req: Request, res: Response) {
    const { unitId, employeeIds } = req.body;
    if (!unitId) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "Employee IDs array is required" });
    }
    const operation = () => this.service.assignEmployeesToUnit(unitId, employeeIds);
    await this.handleRequest(operation, res, { successMessage: "Employees assigned to unit successfully!" });
  }

  async addEmployeesToUnit(req: Request, res: Response) {
    const { unitId, employeeIds } = req.body;
    if (!unitId) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "Employee IDs array is required" });
    }
    const operation = () => this.service.addEmployeesToUnit(unitId, employeeIds);
    await this.handleRequest(operation, res, { successMessage: "Employees added to unit successfully!" });
  }

  async removeEmployeesFromUnit(req: Request, res: Response) {
    const { unitId, employeeIds } = req.body;
    if (!unitId) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "Employee IDs array is required" });
    }
    const operation = () => this.service.removeEmployeesFromUnit(unitId, employeeIds);
    await this.handleRequest(operation, res, { successMessage: "Employees removed from unit successfully!" });
  }

  async removeEmployeeFromUnit(req: Request, res: Response) {
    const { unitId, employeeId } = req.body;
    if (!unitId) {
      return res.status(400).json({ message: "Unit ID is required" });
    }
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }
    const operation = () => this.service.removeEmployeeFromUnit(unitId, employeeId);
    await this.handleRequest(operation, res, { successMessage: "Employee removed from unit successfully!" });
  }
}

export default UnitEmployeeController;
