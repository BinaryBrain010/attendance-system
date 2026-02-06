import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import ShiftService from "../services/shift.service";
import { Shift, ShiftAssignmentPayload, ShiftTimetableBlockPayload, ShiftTimetablePayload } from "../types/shift";

class ShiftController extends BaseController<ShiftService> {
  protected service = new ShiftService();

  async getAll(req: Request, res: Response) {
    const operation = () => this.service.getAllShifts();
    await this.handleRequest(operation, res, { successMessage: "Shifts retrieved successfully!" });
  }

  async get(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getShifts(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Shifts retrieved successfully!" });
  }

  async deleted(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getDeletedShifts(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted shifts retrieved successfully!" });
  }

  async total(req: Request, res: Response) {
    const operation = () => this.service.getTotalShifts();
    await this.handleRequest(operation, res, { successMessage: "Total shifts count retrieved successfully!" });
  }

  async getById(req: Request, res: Response) {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "Shift ID is required" });
    }
    const operation = () => this.service.getShiftById(id as string);
    await this.handleRequest(operation, res, { successMessage: "Shift retrieved successfully!" });
  }

  async create(req: Request, res: Response) {
    const shiftData: Shift = req.body;
    const operation = () => this.service.createShift(shiftData);
    await this.handleRequest(operation, res, {
      successMessage: "Shift created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "Shift",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Shift created: ${shiftData.name}`,
        metadata: {
          name: shiftData.name,
        },
      },
      req,
    });
  }

  async update(req: Request, res: Response) {
    const { id, ...data } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Shift ID is required" });
    }
    const operation = () => this.service.updateShift(id, data);
    await this.handleRequest(operation, res, {
      successMessage: "Shift updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "Shift",
        entityId: id,
        description: `Shift updated: ${data.name || "N/A"}`,
        metadata: {
          changes: data,
          shiftId: id,
        },
      },
      req,
    });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Shift ID is required" });
    }
    const operation = () => this.service.deleteShift(id);
    await this.handleRequest(operation, res, {
      successMessage: "Shift deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "Shift",
        entityId: id,
        description: "Shift deleted",
      },
      req,
    });
  }

  async restore(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Shift ID is required" });
    }
    const operation = () => this.service.restoreShift(id);
    await this.handleRequest(operation, res, {
      successMessage: "Shift restored successfully!",
      logActivity: {
        action: "RESTORE",
        entityType: "Shift",
        entityId: id,
        description: "Shift restored",
      },
      req,
    });
  }

  async search(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }
    const operation = () => this.service.searchShifts(searchTerm, page || 1, pageSize || 10);
    await this.handleRequest(operation, res, { successMessage: "Shifts search completed successfully!" });
  }

  // Assignments
  async assignToEmployee(req: Request, res: Response) {
    const payload: ShiftAssignmentPayload = req.body;
    if (!payload.employeeId || !payload.shiftId || !payload.startDate) {
      return res.status(400).json({ message: "employeeId, shiftId and startDate are required" });
    }

    const operation = () => this.service.assignToEmployee(payload);
    await this.handleRequest(operation, res, {
      successMessage: "Shift assigned to employee successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "ShiftAssignment",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: "Shift assigned to employee",
        metadata: {
          employeeId: payload.employeeId,
          shiftId: payload.shiftId,
          startDate: payload.startDate,
          endDate: payload.endDate || null,
        },
      },
      req,
    });
  }

  async removeAssignment(req: Request, res: Response) {
    const { assignmentId } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ message: "assignmentId is required" });
    }

    const operation = () => this.service.removeAssignment(assignmentId);
    await this.handleRequest(operation, res, {
      successMessage: "Shift assignment removed successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "ShiftAssignment",
        entityId: assignmentId,
        description: "Shift assignment removed",
      },
      req,
    });
  }

  async getAssignedEmployees(req: Request, res: Response) {
    const { shiftId } = req.body;
    if (!shiftId) {
      return res.status(400).json({ message: "shiftId is required" });
    }

    const operation = () => this.service.getAssignedEmployeesOfShift(shiftId);
    await this.handleRequest(operation, res, { successMessage: "Assigned employees retrieved successfully!" });
  }

  async getAssignmentsByEmployee(req: Request, res: Response) {
    const employeeId = (req.body?.employeeId || req.query?.employeeId) as string;
    if (!employeeId) {
      return res.status(400).json({ message: "employeeId is required" });
    }
    const operation = () => this.service.getAssignmentsByEmployeeId(employeeId);
    await this.handleRequest(operation, res, { successMessage: "Employee shift assignments retrieved successfully!" });
  }

  async checkAssignmentConflicts(req: Request, res: Response) {
    const { shiftId, startDate, endDate, employeeIds } = req.body;
    if (!shiftId || !startDate || !employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "shiftId, startDate and employeeIds (array) are required" });
    }
    const operation = () =>
      this.service.checkAssignmentConflicts(
        shiftId,
        new Date(startDate),
        endDate ? new Date(endDate) : null,
        employeeIds
      );
    await this.handleRequest(operation, res, { successMessage: "Conflict check completed!" });
  }

  async assignToEmployees(req: Request, res: Response) {
    const { employeeIds, shiftId, startDate, endDate } = req.body;
    if (!employeeIds || !Array.isArray(employeeIds) || !shiftId || !startDate) {
      return res.status(400).json({ message: "employeeIds (array), shiftId and startDate are required" });
    }
    const operation = () =>
      this.service.assignToEmployees(employeeIds, shiftId, new Date(startDate), endDate ? new Date(endDate) : null);
    await this.handleRequest(operation, res, {
      successMessage: "Shift assignment completed!",
      logActivity: {
        action: "BULK_CREATE",
        entityType: "ShiftAssignment",
        description: "Shift assigned to multiple employees",
        metadata: { employeeIds, shiftId, startDate, endDate: endDate || null },
      },
      req,
    });
  }

  async assignToUnit(req: Request, res: Response) {
    const { unitId, shiftId, startDate, endDate } = req.body;
    if (!unitId || !shiftId || !startDate) {
      return res.status(400).json({ message: "unitId, shiftId and startDate are required" });
    }

    const operation = () => this.service.assignToUnit(unitId, shiftId, new Date(startDate), endDate ? new Date(endDate) : null);
    await this.handleRequest(operation, res, {
      successMessage: "Shift assigned to unit employees successfully!",
      logActivity: {
        action: "BULK_CREATE",
        entityType: "ShiftAssignment",
        description: "Shift assigned to unit employees",
        metadata: {
          unitId,
          shiftId,
          startDate,
          endDate: endDate || null,
        },
      },
      req,
    });
  }

  // Timetables
  async getTimetable(req: Request, res: Response) {
    const { shiftId } = req.body;
    if (!shiftId) {
      return res.status(400).json({ message: "shiftId is required" });
    }

    const operation = () => this.service.getTimetableByShiftId(shiftId);
    await this.handleRequest(operation, res, { successMessage: "Shift timetable retrieved successfully!" });
  }

  async upsertTimetable(req: Request, res: Response) {
    const payload: ShiftTimetablePayload = req.body;
    if (!payload.shiftId || payload.dayOfWeek === undefined || payload.dayOfWeek === null || !payload.startTime || !payload.endTime) {
      return res.status(400).json({ message: "shiftId, dayOfWeek, startTime, endTime are required" });
    }

    const operation = () => this.service.upsertTimetable(payload);
    await this.handleRequest(operation, res, {
      successMessage: "Shift timetable saved successfully!",
      logActivity: {
        action: "UPSERT",
        entityType: "ShiftTimetable",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: "Shift timetable upserted",
        metadata: payload,
      },
      req,
    });
  }

  async deleteTimetable(req: Request, res: Response) {
    const { timetableId } = req.body;
    if (!timetableId) {
      return res.status(400).json({ message: "timetableId is required" });
    }

    const operation = () => this.service.deleteTimetable(timetableId);
    await this.handleRequest(operation, res, {
      successMessage: "Shift timetable deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "ShiftTimetable",
        entityId: timetableId,
        description: "Shift timetable deleted",
      },
      req,
    });
  }

  // Timetable Blocks
  async getTimetableBlocks(req: Request, res: Response) {
    const { shiftId, dayOfWeek } = req.body;
    if (!shiftId) {
      return res.status(400).json({ message: "shiftId is required" });
    }

    const operation = () => this.service.getTimetableBlocks(shiftId, dayOfWeek !== undefined ? Number(dayOfWeek) : undefined);
    await this.handleRequest(operation, res, { successMessage: "Shift timetable blocks retrieved successfully!" });
  }

  async createTimetableBlock(req: Request, res: Response) {
    const payload: ShiftTimetableBlockPayload = req.body;
    if (!payload.shiftId || payload.dayOfWeek === undefined || !payload.startTime || !payload.endTime) {
      return res.status(400).json({ message: "shiftId, dayOfWeek, startTime, endTime are required" });
    }

    const operation = () => this.service.createTimetableBlock(payload);
    await this.handleRequest(operation, res, {
      successMessage: "Shift timetable block created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "ShiftTimetableBlock",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: "Shift timetable block created",
        metadata: payload,
      },
      req,
    });
  }

  async updateTimetableBlock(req: Request, res: Response) {
    const { id, ...payload } = req.body;
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    const operation = () => this.service.updateTimetableBlock(id, payload);
    await this.handleRequest(operation, res, {
      successMessage: "Shift timetable block updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "ShiftTimetableBlock",
        entityId: id,
        description: "Shift timetable block updated",
        metadata: payload,
      },
      req,
    });
  }

  async deleteTimetableBlock(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    const operation = () => this.service.deleteTimetableBlock(id);
    await this.handleRequest(operation, res, {
      successMessage: "Shift timetable block deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "ShiftTimetableBlock",
        entityId: id,
        description: "Shift timetable block deleted",
      },
      req,
    });
  }
}

export default ShiftController;
