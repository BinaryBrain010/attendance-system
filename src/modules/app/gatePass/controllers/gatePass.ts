import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import GatePassService from "../services/gatePass.service";
import { GatePass } from "../../../../types/schema";
import { GatePassPDF } from "../../../../pdf/gatePass";
import { pdfContentDisposition } from "../../../../core/http/pdfHeaders";
import { DetailedGatePass } from "../../../../types/paginatedData";
import { CreateGatePassItem } from "../../../../types/schema";
import GatePassWorkflowService, { TransitionAction } from "../services/gatePassWorkflow.service";
class GatePassController extends BaseController<GatePassService> {
  protected service = new GatePassService();
  private workflow = new GatePassWorkflowService();
  private pdfUtility: GatePassPDF = new GatePassPDF();

  // ----- Admin web: filtered list + detail + status history -----
  async webList(req: Request, res: Response) {
    const operation = () => this.service.webList(req.body || {});
    await this.handleRequest(operation, res, { successMessage: "Gate passes retrieved successfully!" });
  }

  async webDetail(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.webDetail(id);
    await this.handleRequest(operation, res, { successMessage: "Gate pass retrieved successfully!" });
  }

  async statusHistory(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.workflow.history(id);
    await this.handleRequest(operation, res, { successMessage: "Status history retrieved successfully!" });
  }

  // ----- Status transitions (reject / dispatch / return / cancel) -----
  private async runTransition(action: TransitionAction, req: Request, res: Response) {
    const { id, reason, close } = req.body;
    const operation = () => this.workflow.transition(action, id, { reason, close });
    await this.handleRequest(operation, res, {
      successMessage: `Gate pass ${action} applied.`,
      logActivity: {
        action: "STATUS_CHANGE",
        entityType: "GatePass",
        entityId: id,
        description: `GatePass ${action}${reason ? `: ${reason}` : ""}`,
        metadata: { action, reason: reason ?? null, close: !!close },
      },
      req,
    });
  }
  async rejectGatePass(req: Request, res: Response) { await this.runTransition("reject", req, res); }
  async dispatchGatePass(req: Request, res: Response) { await this.runTransition("dispatch", req, res); }
  async returnGatePass(req: Request, res: Response) { await this.runTransition("return", req, res); }
  async cancelGatePass(req: Request, res: Response) { await this.runTransition("cancel", req, res); }

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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "GatePass",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `GatePass created for customer: ${GatePass?.customerId || 'N/A'}`,
        metadata: {
          customerId: GatePass?.customerId,
          itemsCount: Array.isArray(GatePassItem) ? GatePassItem.length : (GatePassItem ? 1 : 0)
        }
      },
      req
    });
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
        const fname = `GatePass-${(data as any).voucherNo || data.customername || id}_${new Date().toISOString().slice(0, 10)}.pdf`;
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": pdfContentDisposition(req as any, fname),
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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "GatePass",
        entityId: id,
        description: `GatePass updated`,
        metadata: {
          changes: GatePass,
          itemsCount: Array.isArray(GatePassItem) ? GatePassItem.length : (GatePassItem ? 1 : 0),
          gatePassId: id
        }
      },
      req
    });
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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "GatePass",
        entityId: id,
        description: "GatePass restored"
      },
      req
    });
  }

  async approveGatePass(req: Request, res: Response) {
    const { id, signature } = req.body;
    const userId = (req as Request & { userId?: string }).userId;
    const operation = () => this.service.approveGatePass(id, signature);
    await this.handleRequest(operation, res, { 
      successMessage: "GatePass approved successfully!",
      logActivity: {
        action: "APPROVE",
        entityType: "GatePass",
        entityId: id,
        description: "GatePass approved",
        metadata: {
          gatePassId: id,
          hasSignature: !!signature,
          approvedBy: userId
        }
      },
      req
    });
  }
}

export default GatePassController;
