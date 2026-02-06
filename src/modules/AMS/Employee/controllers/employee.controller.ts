import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import EmployeeService from "../services/employee.service";
import { Employee } from "../types/employee";
import path from "path";
import { EmployeePDF } from "../../../../pdf/employee";
import { EmployeeExcelUtility } from "../../../../excel/employee";
class EmployeeController extends BaseController<EmployeeService> {
  protected service = new EmployeeService();
  private pdfUtility: EmployeePDF = new EmployeePDF();
  private excelUtility = new EmployeeExcelUtility();

  async getAllEmployees(req: Request, res: Response) {
    const light = req.query.light === 'true' || req.query.light === '1';
    if (light) {
      const operation = () => this.service.getFilterEmployees();
      await this.handleRequest(operation, res, { successMessage: "Employees retrieved successfully!" });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const filter = req.query.filter as string;
    const search = req.query.search as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const dateField = (req.query.dateField as string) || 'joiningDate'; // joiningDate, createdAt, or updatedAt
    const userId = (req as Request & { userId?: string }).userId;

    const operation = async () => {
      return await this.service.getEmployeesWithPagination(
        page,
        pageSize,
        sortBy,
        sortOrder,
        filter,
        search,
        from,
        to,
        dateField,
        userId
      );
    };

    await this.handleRequest(operation, res, { successMessage: "Employees retrieved successfully!" });
  }

  async deleteFiles(req: Request, res: Response) {
    const { employeeId, fileName } = req.body;

    if (!employeeId || !fileName) {
      return res
        .status(400)
        .json({ message: "Employee ID and file name are required" });
    }

    let operation = async () => {
      await this.service.deleteFiles(employeeId, fileName);
    };

    await this.handleRequest(operation, res, { 
      successMessage: "File deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "EmployeeFile",
        entityId: employeeId,
        description: `File deleted: ${fileName}`,
        metadata: {
          employeeId,
          fileName
        }
      },
      req
    });
  }

  async getEmployeeExcel(req: Request, res: Response): Promise<void> {
    const data = await this.service.getAllEmployees();
    const result = await this.excelUtility.create(data);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(result.wbout); // Ensure this is binary data (e.g., a Buffer or equivalent)
  }

 async getEmployeeByUserId(req: Request, res: Response) {
    const { userId } = req.body;
    const operation = () => this.service.getEmployeeByUserId(userId);
    await this.handleRequest(operation, res, { successMessage: "Files retrieved successfully!" });
  }

  async getEmployeeCard(req: Request, res: Response) {
    const { id } = req.body;
    try {
      const data: Employee | null = await this.service.getEmployeeById(id);
      if (data) {
        const pdfDoc = this.pdfUtility.generateEmployeePDF(data);

        pdfDoc.getBuffer((buffer: Buffer) => {
          if (buffer) {
            res.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=${encodeURIComponent(
                data.name
              )}.pdf`,
              "Content-Length": buffer.length,
            });
            res.end(buffer);
          } else {
            res.status(500).json({ error: "Error generating PDF buffer" });
          }
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async getFiles(req: Request, res: Response) {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    let operation = async () => {
      return await this.service.getFiles(employeeId);
    };

    await this.handleRequest(operation, res, { successMessage: "Files retrieved successfully!" });
  }

  async updateFiles(req: Request, res: Response) {
    const { employeeId, employeeName } = req.body;

    if (!employeeId || !employeeName) {
      return res
        .status(400)
        .json({ message: "Employee ID and Name are required" });
    }

    try {
      let files: any = req.files as Express.Multer.File[]; // Array of uploaded files
      // console.log(files.files);
      files = files.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Get existing file paths from the employee
      const employee: any = await this.service.getEmployeeById(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const existingFilePaths = employee.filePaths || [];

      // Create new file paths
      const newFilePaths = files.map((file: any) => {
        // Extract the relative path for the structured folder
        const relativePath = path.relative(
          path.join(__dirname, "..", "..", "..", "..", "assets"),
          file.path
        );

        // Ensure forward slashes in the path
        const normalizedPath = relativePath.replace(/\\+/g, "/");

        return normalizedPath;
      });

      // Update the employee with the new file paths
      const updatedFilePaths = [...existingFilePaths, ...newFilePaths];
      await this.service.updateFilePaths(employeeId, updatedFilePaths);

      // Log activity
      try {
        const { logActivityFromRequest } = await import('../../../ActivityLog/helper/activityLog.helper');
        await logActivityFromRequest(
          req,
          "UPDATE",
          "EmployeeFile",
          employeeId,
          `Files uploaded: ${newFilePaths.length} file(s)`,
          {
            employeeId,
            filesCount: newFilePaths.length,
            fileNames: newFilePaths
          }
        );
      } catch (logError) {
        console.error("Error logging activity:", logError);
      }

      return res
        .status(200)
        .json({ message: "Files uploaded and employee updated successfully" });
    } catch (error) {
      console.error("Error uploading files for employee:", error);
      return res.status(500).json({ message: "Error uploading files" });
    }
  }

  async uploadFiles(req: Request, res: Response) {
    const employeeId = req.body.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: "employee ID is required" });
    }
  }

  async getEmployees(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getEmployees(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Employees retrieved successfully!" });
  }

  async getDeletedEmployees(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedEmployees(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted employees retrieved successfully!" });
  }

  async searchEmployees(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchEmployee(searchTerm, page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Employees retrieved successfully!" });
  }

  async getTotalEmployees(req: Request, res: Response) {
    const operation = () => this.service.getTotalEmployees();
    await this.handleRequest(operation, res, { successMessage: "Total employees count retrieved successfully!" });
  }

  async createEmployee(req: Request, res: Response) {
    const employeeData: Employee = req.body;
    const userId = (req as Request & { userId?: string }).userId;

    const operation = () => this.service.createEmployee({ ...employeeData, createdByUserId: userId } as Employee & { createdByUserId?: string });
    await this.handleRequest(operation, res, { 
      successMessage: "Employee created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "Employee",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Employee created: ${employeeData.name} ${employeeData.surname}`,
        metadata: {
          employeeCode: employeeData.code,
          name: employeeData.name,
          surname: employeeData.surname
        }
      },
      req
    });
  }

  async updateEmployee(req: Request, res: Response) {
    const { id, data } = req.body;
    const userId = (req as Request & { userId?: string }).userId;

    const operation = () => this.service.updateEmployee(id, { ...data, updatedByUserId: userId });
    await this.handleRequest(operation, res, { 
      successMessage: "Employee updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "Employee",
        entityId: id,
        description: `Employee updated: ${data.name || 'N/A'} ${data.surname || ''}`,
        metadata: {
          changes: data,
          employeeId: id
        }
      },
      req
    });
  }

  async deleteEmployee(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteEmployee(id);
    await this.handleRequest(operation, res, { successMessage: "Employee deleted successfully!" });
  }

  async getEmployeeById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getEmployeeById(id);
    await this.handleRequest(operation, res, { successMessage: "Employee retrieved successfully!" });
  }

  async getEmployeeByCode(req: Request, res: Response) {
    const { code } = req.body;
    const operation = () => this.service.getEmployeeByCode(code);
    await this.handleRequest(operation, res, { successMessage: "Employee retrieved successfully!" });
  }

  async getEmployeeLinkedUser(req: Request, res: Response) {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: "Employee ID is required" 
      });
    }

    const operation = () => this.service.getEmployeeLinkedUser(id);
    await this.handleRequest(operation, res, { successMessage: "Employee linked user retrieved successfully!" });
  }

  async restoreEmployee(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreEmployee(id);
    await this.handleRequest(operation, res, { 
      successMessage: "Employee restored successfully!",
      logActivity: {
        action: "RESTORE",
        entityType: "Employee",
        entityId: id,
        description: "Employee restored"
      },
      req
    });
  }

  async getEmployeesForFaceRecognition(req: Request, res: Response) {
    const operation = () => this.service.getEmployeesForFaceRecognition();
    await this.handleRequest(operation, res, { successMessage: "Employees for face recognition retrieved successfully!" });
  }

  async getHistoryById(req: Request, res: Response) {
    const { id, filter, date } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    // Convert filter to boolean if it's a string
    const filterBool = filter === true || filter === "true";
    
    const operation = () => this.service.getHistoryById(id, filterBool, date);
    await this.handleRequest(operation, res, { successMessage: "Employee history retrieved successfully!" });
  }

  async getEmployeeStats(req: Request, res: Response) {
    const { employeeId, from, to } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const operation = () => this.service.getEmployeeStats(employeeId, from, to);
    await this.handleRequest(operation, res, { successMessage: "Employee statistics retrieved successfully!" });
  }
}

export default EmployeeController;
