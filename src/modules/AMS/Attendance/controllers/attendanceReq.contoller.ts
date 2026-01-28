import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AttendanceReqService from "../services/attendanceReq.service";
import { AttendanceRequest } from "../types/AttendanceRequest";

class AttendanceReqController extends BaseController<AttendanceReqService> {
  protected service = new AttendanceReqService();

  async getAllAttendanceRequests(req: Request, res: Response) {
    const operation = () => this.service.getAllAttendanceRequests();
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async getAttendanceRequests(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getAttendanceRequests(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async createAttendanceRequest(req: Request, res: Response) {
    const attendanceRequestData: AttendanceRequest = req.body;
    const operation = () => this.service.createAttendanceRequest(attendanceRequestData);
    await this.handleRequest(operation, res, { 
      successMessage: "Attendance request created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "AttendanceRequest",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Attendance request created for employee ${attendanceRequestData.employeeId}`,
        metadata: {
          employeeId: attendanceRequestData.employeeId,
          attendanceId: attendanceRequestData.attendanceId,
          status: attendanceRequestData.status,
          reason: attendanceRequestData.reason
        }
      },
      req
    });
  }

  async updateAttendanceRequest(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateAttendanceRequest(id, data);
    await this.handleRequest(operation, res, { 
      successMessage: "Attendance request updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "AttendanceRequest",
        entityId: id,
        description: `Attendance request updated`,
        metadata: {
          changes: data,
          requestId: id
        }
      },
      req
    });
  }

  async deleteAttendanceRequest(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteAttendanceRequest(id);
    await this.handleRequest(operation, res, { 
      successMessage: "Attendance request deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "AttendanceRequest",
        entityId: id,
        description: "Attendance request deleted"
      },
      req
    });
  }

  async restoreAttendanceRequest(req: Request, res: Response) {
    const { requestId } = req.body;
    const operation = () => this.service.restoreAttendanceRequest(requestId);
    await this.handleRequest(operation, res, { successMessage: "Attendance request restored successfully!" });
  }

  async getAttendanceRequestById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getAttendanceRequestById(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance request retrieved successfully!" });
  }

  async getAttendanceRequestsByEmployeeId(req: Request, res: Response) {
    const { employeeId } = req.body;
    const operation = () => this.service.getAttendanceRequestsByEmployeeId(employeeId);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests for the employee retrieved successfully!" });
  }

  async getDeletedAttendanceRequests(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedAttendanceRequests(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted attendance requests retrieved successfully!" });
  }

  async searchAttendanceRequests(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () => this.service.searchAttendanceRequests(searchTerm, page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async getTotalAttendanceRequests(req: Request, res: Response) {
    const operation = () => this.service.getTotalAttendanceRequests();
    await this.handleRequest(operation, res, { successMessage: "Total attendance requests count retrieved successfully!" });
  }

  async updateAttendanceRequestStatus(req: Request, res: Response) {
    const { id, status } = req.body;
    const userId = (req as Request & { userId?: string }).userId;
    
    // Check if user has permission to approve attendance requests
    const accessModel = (await import("../../../rbac/Access/models/access.model")).default;
    let hasPermission = false;
    if (userId) {
      try {
        hasPermission = await accessModel.user.checkUserPermission(userId, "attendance.request.approve.*");
      } catch (error) {
        console.error("Error checking permission:", error);
        hasPermission = false;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have permission to approve attendance requests." 
      });
    }

    const operation = () => this.service.updateAttendanceRequestStatus(id, status, userId);
    await this.handleRequest(operation, res, { 
      successMessage: "Attendance request status updated successfully!",
      logActivity: {
        action: status === "APPROVED" ? "APPROVE" : status === "REJECTED" ? "REJECT" : "UPDATE",
        entityType: "AttendanceRequest",
        entityId: id,
        description: `Attendance request ${status.toLowerCase()}`,
        metadata: {
          requestId: id,
          status,
          updatedBy: userId
        }
      },
      req
    });
  }

  async bulkUpdateAttendanceRequestStatus(req: Request, res: Response) {
    const { requestIds, status } = req.body;
    const userId = (req as Request & { userId?: string }).userId;
    
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "requestIds array is required and must not be empty",
        statusCode: 400
      });
    }

    if (!status || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status is required and must be APPROVED, REJECTED, or PENDING",
        statusCode: 400
      });
    }
    
    // Check if user has permission to approve attendance requests
    const accessModel = (await import("../../../rbac/Access/models/access.model")).default;
    let hasPermission = false;
    if (userId) {
      try {
        hasPermission = await accessModel.user.checkUserPermission(userId, "attendance.request.approve.*");
      } catch (error) {
        console.error("Error checking permission:", error);
        hasPermission = false;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have permission to approve attendance requests.",
        statusCode: 403
      });
    }

    const operation = () => this.service.bulkUpdateAttendanceRequestStatus(requestIds, status, userId);
    await this.handleRequest(operation, res, { 
      successMessage: `Bulk ${status.toLowerCase()} operation completed!`,
      logActivity: {
        action: status === "APPROVED" ? "BULK_APPROVE" : status === "REJECTED" ? "BULK_REJECT" : "BULK_UPDATE",
        entityType: "AttendanceRequest",
        entityId: (result: any) => requestIds[0] || null, // Log first ID as representative
        description: `Bulk ${status.toLowerCase()} for ${requestIds.length} attendance request(s)`,
        metadata: {
          requestIds,
          status,
          updatedBy: userId,
          count: requestIds.length
        }
      },
      req
    });
  }
}

export default AttendanceReqController;
