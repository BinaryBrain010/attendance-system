import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeadService from "../services/lead.service";
import LeadImportService from "../services/leadImport.service";
import { sendTableExport, EXPORT_CAP, type ExportCol } from "../../../../core/export/tableExport";

// Same column order as the lead list (ID, Date, Customer, Phone/WhatsApp, City, Channel, Products,
// Agent, Stage, Priority, Est. value, Next follow-up, Last contacted).
const LEAD_EXPORT_COLS: ExportCol[] = [
  { key: "leadNo", header: "ID" }, { key: "createdAt", header: "Date" }, { key: "customerName", header: "Customer" },
  { key: "phone", header: "Phone" }, { key: "whatsapp", header: "WhatsApp" }, { key: "city", header: "City" },
  { key: "channel", header: "Channel" }, { key: "productsText", header: "Products" }, { key: "agentCode", header: "Agent" },
  { key: "stage", header: "Stage" }, { key: "priority", header: "Priority" }, { key: "estimatedValue", header: "Est. value" },
  { key: "nextFollowUpAt", header: "Next follow-up" }, { key: "lastContactAt", header: "Last contacted" },
];

class LeadController extends BaseController<LeadService> {
  protected service = new LeadService();
  private importer = new LeadImportService();

  /** Server-side export of ALL leads matching the current filters + sort (capped at EXPORT_CAP). */
  async export(req: Request, res: Response) {
    const { format, ...filters } = req.body || {};
    const rows = await this.service.exportRows((req as any).userId, filters);
    const capped = rows.length > EXPORT_CAP;
    await sendTableExport(res, {
      rows: capped ? rows.slice(0, EXPORT_CAP) : rows,
      columns: LEAD_EXPORT_COLS, format: format === "csv" ? "csv" : "excel", filename: "leads", capped,
    });
  }

  /** Import a lead register CSV. dryRun defaults TRUE — pass dryRun=false to persist. */
  async importCsv(req: Request, res: Response) {
    const file = (req as any).file;
    const csv = file?.buffer?.toString("utf8") ?? req.body?.csv;
    const name = file?.originalname ?? req.body?.name ?? "upload.csv";
    const dryRun = !(String(req.query.dryRun ?? req.body?.dryRun) === "false");
    await this.handleRequest(async () => {
      if (!csv) throw Object.assign(new Error("No CSV provided (file field 'file' or body.csv)"), { statusCode: 400 });
      return this.importer.run([{ name, csv }], dryRun);
    }, res, {
      successMessage: dryRun ? "Lead import dry-run complete" : "Leads imported",
      logActivity: dryRun ? (undefined as any) : { action: "IMPORT", entityType: "Lead", description: `Lead import from ${name}` },
      req,
    });
  }

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Leads retrieved successfully!" });
  }
  async filtered(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Leads retrieved successfully!" });
  }
  async total(req: Request, res: Response) {
    await this.handleRequest(() => this.service.total((req as any).userId, req.body || {}), res, { successMessage: "Total leads retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById((req as any).userId, id), res, { successMessage: "Lead retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    const data = { ...req.body, createdBy: uid };
    await this.handleRequest(() => this.service.create(uid, data), res, {
      successMessage: "Lead created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Lead", entityId: (r: any) => r?.[0]?.id, description: `Lead created: ${req.body?.customerName ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid, id, { ...rest, updatedBy: uid }), res, {
      successMessage: "Lead updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Lead", entityId: id, description: "Lead updated" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove((req as any).userId, id), res, {
      successMessage: "Lead deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Lead", entityId: id, description: "Lead deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore((req as any).userId, id), res, {
      successMessage: "Lead restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Lead", entityId: id, description: "Lead restored" }, req,
    });
  }

  async transition(req: Request, res: Response) {
    // Part B: a stage change always carries its activity; the combined operation lives in
    // LeadService.logActivity (quick actions, board drag, stage chips all post here).
    const { id, to, reason, type, outcome, notes, nextFollowUpAt, quotationId } = req.body;
    await this.handleRequest(
      () => this.service.logActivity((req as any).userId, { leadId: id, toStage: to, reason: reason ?? null, type, outcome, notes, nextFollowUpAt, quotationId }),
      res,
      {
        successMessage: "Lead stage changed successfully!",
        logActivity: { action: "STAGE_CHANGE", entityType: "Lead", entityId: id, description: (r: any) => `Stage ${r?.from} -> ${r?.to}`, metadata: (r: any) => ({ from: r?.from, to: r?.to, reason: reason ?? null, activity: type, outcome }) }, req,
      },
    );
  }

  async assign(req: Request, res: Response) {
    const { id, agentId } = req.body;
    await this.handleRequest(() => this.service.assign((req as any).userId, id, agentId ?? null), res, {
      successMessage: "Lead reassigned successfully!",
      logActivity: { action: "ASSIGN", entityType: "Lead", entityId: id, description: `Lead reassigned`, metadata: { agentId } }, req,
    });
  }

  async transfer(req: Request, res: Response) {
    const { id, agentId, reason } = req.body;
    // The transfer itself logs the timeline entry (with the reason) inside the service.
    await this.handleRequest(() => this.service.transfer((req as any).userId, id, agentId, reason), res, {
      successMessage: "Lead transferred successfully!",
    });
  }

  async mentionables(req: Request, res: Response) {
    await this.handleRequest(() => this.service.mentionables((req as any).userId), res, { successMessage: "Mentionable users retrieved!" });
  }

  async fromVisitor(req: Request, res: Response) {
    const { visitorId } = req.body;
    await this.handleRequest(() => this.service.fromVisitor((req as any).userId, visitorId), res, {
      successMessage: "Lead created from visitor successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Lead", entityId: (r: any) => r?.[0]?.id, description: `Lead from visitor ${visitorId}`, metadata: { visitorId } }, req,
    });
  }

  async timeline(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.timeline((req as any).userId, id), res, { successMessage: "Lead timeline retrieved successfully!" });
  }
}

export default LeadController;
