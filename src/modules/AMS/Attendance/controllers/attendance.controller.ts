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

  async getAllAttendances(req: Request, res: Response) {
    const operation = () => this.service.getAllattendances();
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async getAttendances(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getAttendances(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async getEmployeeAttendance(req: Request, res: Response) {
    const { employeeId, from, to } = req.body;
    const operation = () =>
      this.service.getEmployeeAttendance(employeeId, from, to);
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async getDated(req: Request, res: Response) {
    const { from, to } = req.body;
    const operation = () => this.service.getDatedAttendance(from, to);
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async getDeletedAttendances(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedAttendances(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted Attendances retrieved successfully!" });
  }

  async searchAttendances(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchAttendance(searchTerm, page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async faceAttendance(req: Request, res: Response) {
    const { image } = req.body;
    const operation = () => this.service.faceAttendance(image);
    await this.handleRequest(operation, res, { successMessage: "Attendances retrieved successfully!" });
  }

  async getSpecificTypeAttendances(req: Request, res: Response) {
    const { type, employeeId } = req.body;
    const operation = () =>
      this.service.getSpecifcAttendances(type, employeeId);
    await this.handleRequest(operation, res, { successMessage: `Total Attendances count retrieved successfully for type: ${type}!` });
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
    await this.handleRequest(operation, res, { successMessage: "Total Attendances count retrieved successfully!" });
  }

  async createAttendance(req: Request, res: Response) {
    const AttendanceData: Attendance = req.body;

    const operation = () => this.service.createAttendance(AttendanceData);
    await this.handleRequest(operation, res, { successMessage: "Attendance created successfully!" });
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
    await this.handleRequest(operation, res, { successMessage: "Attendance updated successfully!" });
  }

  async deleteAttendance(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteAttendance(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance deleted successfully!" });
  }

  async getAttendanceById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getAttendanceById(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance retrieved successfully!" });
  }

  async restoreAttendance(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreAttendance(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance restored successfully!" });
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
    await this.handleRequest(operation, res, { successMessage: "Attendance imported successfully!" });
  }
}

export default AttendanceController;
