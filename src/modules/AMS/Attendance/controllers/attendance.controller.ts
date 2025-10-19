import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import { Attendance } from "../types/Attendance";
import path from "path";
import AttendanceService from "../services/attendnace.service";
import { AttendanceExcelUtility } from "../../../../excel/attendance";
import { AttendancePDF } from "../../../../pdf/attendance";

class AttendanceController extends BaseController<AttendanceService> {
  protected service = new AttendanceService();
  private excelUtility = new AttendanceExcelUtility();
  private pdfUtility = new AttendancePDF();

  protected moduleName: string = "AMS";

  protected handle(operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string,
    activityLog: string,
    res: Response,
    req: Request,
    entityId?: string
  ) {
    this.handleRequest(operation, successMessage, errorMessage, activityLog, res, req, this.moduleName, entityId);
  }

  async getAllAttendances(req: Request, res: Response) {
    const operation = () => this.service.getAllattendances();
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Fetched all attendances`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getAttendances(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getAttendances(page, pageSize);
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Fetched attendances (page: ${page}, pageSize: ${pageSize})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getEmployeeAttendance(req: Request, res: Response) {
    const { employeeId, from, to } = req.body;
    const operation = () =>
      this.service.getEmployeeAttendance(employeeId, from, to);
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Fetched attendance for employee (id: ${employeeId}, from: ${from}, to: ${to})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }

  async getDated(req: Request, res: Response) {
    const { from, to } = req.body;
    const operation = () => this.service.getDatedAttendance(from, to);
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Fetched attendances by date (from: ${from}, to: ${to})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getDeletedAttendances(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedAttendances(page, pageSize);
    const successMessage = "Deleted Attendances retrieved successfully!";
    const errorMessage = "Error retrieving deleted Attendances:";
    const activityLog = `Fetched deleted attendances (page: ${page}, pageSize: ${pageSize})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchAttendances(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchAttendance(searchTerm, page, pageSize);
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Searched attendances (searchTerm: ${searchTerm}, page: ${page}, pageSize: ${pageSize})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async faceAttendance(req: Request, res: Response) {
    const { image } = req.body;
    const operation = () => this.service.faceAttendance(image);
    const successMessage = "Attendances retrieved successfully!";
    const errorMessage = "Error retrieving Attendances:";
    const activityLog = `Fetched attendance by face recognition`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getSpecificTypeAttendances(req: Request, res: Response) {
    const { type, employeeId } = req.body;
    const operation = () =>
      this.service.getSpecifcAttendances(type, employeeId);
    const successMessage = `Total Attendances count retrieved successfully for type: ${type}!`;
    const errorMessage = `Error retrieving total Attendances count for type: ${type}:`;
    const activityLog = `Fetched attendances for type: ${type}, employeeId: ${employeeId}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }

  async downloadExcelAttendance(req: Request, res: Response) {
    const { from, to, employeeId } = req.body;
    let data: any = [];

    if (employeeId) {
      data = await this.service.getEmployeeAttendance(employeeId, from, to);
    } else {
      // If no employeeId is provided
      if (from || to) {
        // If only dates are provided, get attendance for all employees within date range
        data = await this.service.getDatedAttendance(from, to);
      } else {
        // If neither employeeId nor dates are provided, get all attendance records
        data = await this.service.getAllattendances();
      }
    }

    const result = await this.excelUtility.create(data);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(result.wbout);
  }

  async attendancePdf(req: Request, res: Response) {
    const { from, to, employeeId } = req.body;
    console.log({ from, to, employeeId });
    try {
      let data: any = [];

      if (employeeId) {
        data = await this.service.getEmployeeAttendance(employeeId, from, to);
      } else {
        // If no employeeId is provided
        if (from || to) {
          // If only dates are provided, get attendance for all employees within date range
          data = await this.service.getDatedAttendance(from, to);
        } else {
          // If neither employeeId nor dates are provided, get all attendance records
          data = await this.service.getAllattendances();
        }
      }


      const pdfDoc = this.pdfUtility.generateAttendancePDF(data);

      // Format current date as YYYY-MM-DD
      const currentDate = new Date()
        .toLocaleDateString("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .split("-")
        .join("-");

      pdfDoc.getBuffer((buffer: Buffer) => {
        if (buffer) {
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=Attendance-Report-${currentDate}.pdf`,
            "Content-Length": buffer.length,
          });
          res.end(buffer);
        } else {
          res.status(500).json({ error: "Error generating PDF buffer" });
        }
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async getTotalAttendances(req: Request, res: Response) {
    const operation = () => this.service.getTotalAttendances();
    const successMessage = "Total Attendances count retrieved successfully!";
    const errorMessage = "Error retrieving total Attendances count:";
    const activityLog = `Fetched total attendances count`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createAttendance(req: Request, res: Response) {
    const AttendanceData: Attendance = req.body;

    const operation = () => this.service.createAttendance(AttendanceData);
    const successMessage = "Attendance created successfully!";
    const errorMessage = "Error creating Attendance:";
    const activityLog = `Created attendance (employeeId: ${AttendanceData?.employeeId || ''}, date: ${AttendanceData?.date || ''})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, AttendanceData?.employeeId);
  }

  async checkAttendance(req: Request, res: Response) {
    const { employeeId, status, date } = req.body;
    try {
      const result = await this.service.checkAttendance(
        employeeId,
        status,
        date
      );
      return res.status(201).json({
        message: result.message,
        success: result.success,
        status: result.status,
      });
    } catch (error) {
      console.error("Error creating attendance:", error);
      return res.status(500).json({ message: "Error creating attendance." });
    }
  }

  async markAttendance(req: Request, res: Response) {
    const attendanceData: Attendance = req.body;

    try {
      const result = await this.service.markAttendance(attendanceData);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      return res
        .status(201)
        .json({ message: result.message, data: result.data });
    } catch (error) {
      console.error("Error creating attendance:", error);
      return res.status(500).json({ message: "Error creating attendance." });
    }
  }

  async updateAttendance(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateAttendance(id, data);
    const successMessage = "Attendance updated successfully!";
    const errorMessage = "Error updating Attendance:";
    const activityLog = `Updated attendance (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteAttendance(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteAttendance(id);
    const successMessage = "Attendance deleted successfully!";
    const errorMessage = "Error deleting Attendance:";
    const activityLog = `Deleted attendance (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getAttendanceById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getAttendanceById(id);
    const successMessage = "Attendance retrieved successfully!";
    const errorMessage = "Error retrieving Attendance:";
    const activityLog = `Fetched attendance by id (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreAttendance(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreAttendance(id);
    const successMessage = "Attendance restored successfully!";
    const errorMessage = "Error restoring Attendance:";
    const activityLog = `Restored attendance (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async importAttendance(req: Request, res: Response) {
    const { employeeId, month } = req.body;
    const file = req.file?.buffer;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    if (!employeeId || !month) {
      return res
        .status(400)
        .json({ message: "employeeId and month are required." });
    }

    const operation = () =>
      this.service.importAttendance(employeeId, month, file);
    const successMessage = "Attendance imported successfully!";
    const errorMessage = "Error importing Attendance:";
    const activityLog = `Imported attendance for employee (id: ${employeeId}, month: ${month})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }
}

export default AttendanceController;
