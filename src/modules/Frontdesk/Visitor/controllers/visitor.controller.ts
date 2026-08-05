import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import VisitorService from "../services/visitor.service";
import { Visitor } from "../types/visitor";

class VisitorController extends BaseController<VisitorService> {
  protected service = new VisitorService();

  /** Resolve the acting user id: prefer an explicit body value, fall back to the JWT-derived id. */
  private actingUserId(req: Request, bodyValue?: string): string | undefined {
    return bodyValue || (req as Request & { userId?: string }).userId;
  }

  async getAllVisitors(req: Request, res: Response) {
    const operation = () => this.service.getAllVisitors();
    await this.handleRequest(operation, res, { successMessage: "Visitors retrieved successfully!" });
  }

  async getVisitors(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getVisitors(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Visitors retrieved successfully!" });
  }

  async getDeletedVisitors(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getDeletedVisitors(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted visitors retrieved successfully!" });
  }

  async getVisitorById(req: Request, res: Response) {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    const operation = () => this.service.getVisitorById(id as string);
    await this.handleRequest(operation, res, { successMessage: "Visitor retrieved successfully!" });
  }

  async getTotalVisitors(req: Request, res: Response) {
    const operation = () => this.service.getTotalVisitors();
    await this.handleRequest(operation, res, { successMessage: "Total visitors count retrieved successfully!" });
  }

  async createVisitor(req: Request, res: Response) {
    const visitorData: Visitor & { createdByUserId?: string } = req.body;
    visitorData.createdByUserId = this.actingUserId(req, visitorData.createdByUserId);
    if (!visitorData.name) {
      return res.status(400).json({ message: "Visitor name is required" });
    }
    const operation = () => this.service.createVisitor(visitorData);
    await this.handleRequest(operation, res, {
      successMessage: "Visitor created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "Visitor",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Visitor created: ${visitorData.name || "N/A"}`,
        metadata: {
          name: visitorData.name,
          purpose: visitorData.purpose,
          referredToText: visitorData.referredToText,
        },
      },
      req,
    });
  }

  async updateVisitor(req: Request, res: Response) {
    const { id, ...data } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    (data as any).updatedByUserId = this.actingUserId(req, (data as any).updatedByUserId);
    const operation = () => this.service.updateVisitor(id, data);
    await this.handleRequest(operation, res, {
      successMessage: "Visitor updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "Visitor",
        entityId: id,
        description: `Visitor updated: ${data.name || "N/A"}`,
        metadata: { changes: data, visitorId: id },
      },
      req,
    });
  }

  async checkOutVisitor(req: Request, res: Response) {
    const { id, timeOut } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    const updatedByUserId = this.actingUserId(req, req.body.updatedByUserId);
    const operation = () => this.service.checkOutVisitor(id, timeOut, updatedByUserId);
    await this.handleRequest(operation, res, {
      successMessage: "Visitor checked out successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "Visitor",
        entityId: id,
        description: "Visitor checked out",
        metadata: { visitorId: id, timeOut },
      },
      req,
    });
  }

  async deleteVisitor(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    const operation = () => this.service.deleteVisitor(id);
    await this.handleRequest(operation, res, {
      successMessage: "Visitor deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "Visitor",
        entityId: id,
        description: "Visitor deleted",
      },
      req,
    });
  }

  async restoreVisitor(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    const operation = () => this.service.restoreVisitor(id);
    await this.handleRequest(operation, res, {
      successMessage: "Visitor restored successfully!",
      logActivity: {
        action: "RESTORE",
        entityType: "Visitor",
        entityId: id,
        description: "Visitor restored",
      },
      req,
    });
  }

  async searchVisitors(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }
    const operation = () => this.service.searchVisitors(searchTerm, page || 1, pageSize || 10);
    await this.handleRequest(operation, res, { successMessage: "Visitors search completed successfully!" });
  }

  async getStats(req: Request, res: Response) {
    const { from, to } = req.body;
    const operation = () => this.service.getStats(from, to);
    await this.handleRequest(operation, res, { successMessage: "Visitor stats retrieved successfully!" });
  }

  async getPersonHistory(req: Request, res: Response) {
    const { phone, name, cnic } = req.body;
    if (!phone && !name && !cnic) {
      return res.status(400).json({ message: "phone, cnic or name is required" });
    }
    const operation = () => this.service.getPersonHistory({ phone, name, cnic });
    await this.handleRequest(operation, res, { successMessage: "Visitor history retrieved successfully!" });
  }

  async lookupPerson(req: Request, res: Response) {
    const { phone, name, cnic } = req.body;
    if (!phone && !name && !cnic) {
      return res.status(400).json({ message: "phone, cnic or name is required" });
    }
    const operation = () => this.service.lookupPerson({ phone, name, cnic });
    await this.handleRequest(operation, res, { successMessage: "Lookup completed" });
  }

  async suggestPersons(req: Request, res: Response) {
    const { term, limit } = req.body;
    const operation = () => this.service.suggestPersons(term || "", limit);
    await this.handleRequest(operation, res, { successMessage: "Suggestions retrieved" });
  }

  async getFiltered(req: Request, res: Response) {
    const { from, to, outcome, purchased, page, pageSize } = req.body;
    const operation = () =>
      this.service.getFiltered({ from, to, outcome, purchased }, page || 1, pageSize || 10);
    await this.handleRequest(operation, res, { successMessage: "Filtered visitors retrieved successfully!" });
  }

  async getPresent(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getPresent(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Present visitors retrieved successfully!" });
  }

  async getHistoryById(req: Request, res: Response) {
    const { id, filter, date } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Visitor ID is required" });
    }
    const filterBool = filter === true || filter === "true";
    const operation = () => this.service.getHistoryById(id, filterBool, date);
    await this.handleRequest(operation, res, { successMessage: "Visitor history retrieved successfully!" });
  }

  // ---- Excel ----

  async downloadExcel(req: Request, res: Response) {
    try {
      const { from, to, outcome, purchased } = req.body || {};
      const result = await this.service.generateExcel({ from, to, outcome, purchased });
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.send(result.wbout);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async downloadTemplate(req: Request, res: Response) {
    try {
      const result = await this.service.generateTemplate();
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.send(result.wbout);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async importVisitors(req: Request, res: Response) {
    const file = req.file?.buffer;
    if (!file) {
      return res.status(400).json({ message: "Excel file is required" });
    }
    const mode = (req.body?.mode as string) || "template";
    const createdByUserId = this.actingUserId(req, req.body?.createdByUserId);

    const operation = () =>
      mode === "reception"
        ? this.service.importReceptionWorkbook(file, createdByUserId)
        : this.service.importVisitors(file, createdByUserId);

    await this.handleRequest(operation, res, {
      successMessage: "Visitors imported successfully!",
      logActivity: {
        action: "IMPORT",
        entityType: "Visitor",
        description: (result: any) => `Imported ${result?.created ?? 0} visitors (${mode})`,
        metadata: (result: any) => ({ mode, ...result }),
      },
      req,
    });
  }
}

export default VisitorController;
