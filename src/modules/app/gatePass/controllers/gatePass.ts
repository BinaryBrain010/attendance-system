import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import GatePassService from "../services/gatePass.service";
import { GatePass } from "../../../../types/schema";
import { GatePassPDF } from "../../../../pdf/gatePass";
import { DetailedGatePass } from "../../../../types/paginatedData";
import { CreateGatePassItem } from "../../../../types/schema";
class GatePassController extends BaseController<GatePassService> {
  protected service = new GatePassService();
  private pdfUtility: GatePassPDF = new GatePassPDF();
  protected moduleName: string = "APP";

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

  async getAllGatePass(req: Request, res: Response) {
    const operation = () => this.service.getAllGatePass();
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched all gate passes`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotal(req: Request, res: Response) {
    const operation = () => this.service.getTotal();
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched total gate passes`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getGatePass(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getGatePass(page, pageSize);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate passes for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getDeletedGatePass(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedGatePass(page, pageSize);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched deleted gate passes for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getDatedGatePass(req: Request, res: Response) {
    const { page, pageSize, from, to } = req.body;
    const operation = () =>
      this.service.getDateFiltered(page, pageSize, from, to);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate passes from ${from} to ${to} for page ${page} with size ${pageSize}`; 
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getStatusGatePass(req: Request, res: Response) {
    const { page, pageSize, status } = req.body;
    const operation = () =>
      this.service.getStatusFilterd(page, pageSize, status);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate passes with status ${status} for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalGatePass(req: Request, res: Response) {
    const operation = () => this.service.getTotalGatePass();
    const successMessage = "Total GatePass count retrieved successfully!";
    const errorMessage = "Error retrieving total GatePass count:";
    const activityLog = `Fetched total gate passes`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createGatePass(req: Request, res: Response) {
    const { GatePass, GatePassItem } = req.body;
    const operation = () => this.service.createGatePass(GatePass, GatePassItem);
    const successMessage = "GatePass created successfully!";
    const errorMessage = "Error creating GatePass:";
    const activityLog = `Created a new GatePass`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async gatePassReport(req: Request, res: Response) {
    const operation = () => this.service.getGatePassesReport();
    const successMessage = "GatePass report created successfully!";
    const errorMessage = "Error creating GatePass report:";
    const activityLog = `Created a GatePass report`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async gatePassPDF(req: Request, res: any) {
    const { id } = req.body;

    try {
      const data: DetailedGatePass = await this.service.getGatePassById(id);
      const pdfDoc = this.pdfUtility.generateGatePassPDF(data);

      pdfDoc.getBuffer((buffer: Buffer) => {
        if (buffer) {
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${encodeURIComponent(
              data.customername
            )}.pdf`,
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

  async updateGatePass(req: Request, res: Response) {
    const { id, GatePass, GatePassItem } = req.body;
    const operation = () => this.service.updateGatePass(id, GatePass,GatePassItem);
    const successMessage = "GatePass updated successfully!";
    const errorMessage = "Error updating GatePass:";
    const activityLog = `Updated GatePass with ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteGatePass(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteGatePass(id);
    const successMessage = "GatePass deleted successfully!";
    const errorMessage = "Error deleting GatePass:";
    const activityLog = `Deleted GatePass with ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getGatePassById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassById(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate pass with ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getGatePassByCustomerId(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassByCustomer(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate pass by customer ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getGatePassByItemId(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassByItem(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    const activityLog = `Fetched gate pass by item ID : ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreGatePass(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreGatePass(id);
    const successMessage = "GatePass restored successfully!";
    const errorMessage = "Error restoring GatePass:";
    const activityLog = `Restored GatePass with ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async approveGatePass(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.approveGatePass(id);
    const successMessage = "GatePass approved successfully!";
    const errorMessage = "Error approving GatePass:";
    const activityLog = `Approved GatePass with ID ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default GatePassController;
