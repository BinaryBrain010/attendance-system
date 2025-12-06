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

  async getAllGatePass(req: Request, res: Response) {
    const operation = () => this.service.getAllGatePass();
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotal(req: Request, res: Response) {
    const operation = () => this.service.getTotal();
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePass(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getGatePass(page, pageSize);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDeletedGatePass(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedGatePass(page, pageSize);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDatedGatePass(req: Request, res: Response) {
    const { page, pageSize, from, to } = req.body;
    const operation = () =>
      this.service.getDateFiltered(page, pageSize, from, to);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getStatusGatePass(req: Request, res: Response) {
    const { page, pageSize, status } = req.body;
    const operation = () =>
      this.service.getStatusFilterd(page, pageSize, status);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalGatePass(req: Request, res: Response) {
    const operation = () => this.service.getTotalGatePass();
    const successMessage = "Total GatePass count retrieved successfully!";
    const errorMessage = "Error retrieving total GatePass count:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createGatePass(req: Request, res: Response) {
    const { GatePass, GatePassItem } = req.body;
    const operation = () => this.service.createGatePass(GatePass, GatePassItem);
    const successMessage = "GatePass created successfully!";
    const errorMessage = "Error creating GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async gatePassReport(req: Request, res: Response) {
    const operation = () => this.service.getGatePassesReport();
    const successMessage = "GatePass report created successfully!";
    const errorMessage = "Error creating GatePass report:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async gatePassPDF(req: Request, res: any) {
    const { id } = req.body;

    try {
      const data: DetailedGatePass = await this.service.getGatePassById(id);
      const pdfBuffer = await this.pdfUtility.generateGatePassPDF(data);

      if (pdfBuffer) {
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${encodeURIComponent(
            data.customername
          )}.pdf`,
          "Content-Length": pdfBuffer.length,
        });
        res.end(pdfBuffer);
      } else {
        res.status(500).json({ error: "Error generating PDF buffer" });
      }
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
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteGatePass(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteGatePass(id);
    const successMessage = "GatePass deleted successfully!";
    const errorMessage = "Error deleting GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePassById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassById(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePassByCustomerId(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassByCustomer(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGatePassByItemId(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getGatePassByItem(id);
    const successMessage = "GatePass retrieved successfully!";
    const errorMessage = "Error retrieving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreGatePass(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreGatePass(id);
    const successMessage = "GatePass restored successfully!";
    const errorMessage = "Error restoring GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async approveGatePass(req: Request, res: Response) {
    const { id, signature } = req.body;
    const operation = () => this.service.approveGatePass(id, signature);
    const successMessage = "GatePass approved successfully!";
    const errorMessage = "Error approving GatePass:";
    await this.handleRequest(operation, res, { successMessage });
  }
}

export default GatePassController;
