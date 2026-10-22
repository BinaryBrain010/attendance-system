import visitorModel from "../models/visitor.model";
import { Visitor } from "../types/visitor";
import { paginatedData } from "../../../../types/paginatedData";
import { VisitorExcelUtility } from "../../../../excel/visitor";
import prisma from "../../../../core/models/base.model";
import { getAccessibleUnitIds } from "../../../AMS/Unit/helper/unitAccess.helper";
import { notify } from "../../../Work/shared/workHelpers";

// 6c: holders of this feature see visitors from every unit; everyone else is scoped to their units.
const VISITOR_VIEW_ALL = "visitor.viewAll.unit.*";

class VisitorService {
  private excelUtility = new VisitorExcelUtility();

  /** 6c: unit ids the user may see (null = all units). */
  private async unitScope(userId?: string): Promise<string[] | null> {
    return await getAccessibleUnitIds(userId, VISITOR_VIEW_ALL);
  }

  /** 6c: the unit a new visitor defaults to — the creating user's first unit (else null). */
  private async defaultUnitForUser(userId?: string): Promise<string | null> {
    if (!userId) return null;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId, isDeleted: null }, select: { employeeId: true } });
      if (!user?.employeeId) return null;
      const ue = await prisma.unitEmployee.findFirst({
        where: { employeeId: user.employeeId, isDeleted: null },
        select: { unitId: true },
      });
      return ue?.unitId ?? null;
    } catch { return null; }
  }

  async getAllVisitors(): Promise<Visitor[]> {
    return await visitorModel.visitor.gpFindMany();
  }

  async getVisitors(page: number, pageSize: number, userId?: string): Promise<paginatedData> {
    const unitIds = await this.unitScope(userId);
    return await visitorModel.visitor.gpPgFindMany(page, pageSize, unitIds);
  }

  async getDeletedVisitors(page: number, pageSize: number): Promise<paginatedData> {
    return await visitorModel.visitor.gpPgFindDeletedMany(page, pageSize);
  }

  async createVisitor(visitorData: Visitor | Visitor[]): Promise<Visitor | Visitor[]> {
    if (Array.isArray(visitorData)) {
      return await Promise.all(
        visitorData.map((v) => visitorModel.visitor.gpCreate(v))
      );
    }
    const vd: any = visitorData;
    // 6c: default the owning unit to the creating user's unit when not provided.
    if (!vd.unitId) {
      vd.unitId = await this.defaultUnitForUser(vd.createdByUserId);
    }
    const created: any = await visitorModel.visitor.gpCreate(vd);
    // 6b: notify the referred host (bell). Sound/animation is handled on the client.
    if (created?.referredToEmployeeId) {
      try {
        const hostUser = await prisma.user.findFirst({
          where: { employeeId: created.referredToEmployeeId, isDeleted: null },
          select: { id: true },
        });
        if (hostUser?.id) {
          await notify(
            [hostUser.id],
            "VISITOR",
            "A visitor is here to see you",
            `${created.name}${created.company ? ` (${created.company})` : ""} is waiting at the front desk.`,
            "Visitor",
            created.id
          );
        }
      } catch (e) {
        console.error("Failed to notify referred host of visitor:", e);
      }
    }
    return created;
  }

  /** 6b: host marks the visit attended. */
  async attendVisitor(visitorId: string, userId?: string, note?: string): Promise<Visitor> {
    return await visitorModel.visitor.gpAttend(visitorId, userId, note);
  }

  async updateVisitor(visitorId: string, visitorData: Visitor): Promise<Visitor> {
    return await visitorModel.visitor.gpUpdate(visitorId, visitorData);
  }

  async checkOutVisitor(
    visitorId: string,
    timeOut?: string,
    updatedByUserId?: string
  ): Promise<Visitor> {
    return await visitorModel.visitor.gpCheckOut(visitorId, timeOut, updatedByUserId);
  }

  async deleteVisitor(visitorId: string): Promise<void> {
    await visitorModel.visitor.gpSoftDelete(visitorId);
  }

  async restoreVisitor(visitorId: string): Promise<void> {
    await visitorModel.visitor.gpRestore(visitorId);
  }

  async getVisitorById(visitorId: string): Promise<Visitor | null> {
    return await visitorModel.visitor.gpFindById(visitorId);
  }

  async getTotalVisitors(): Promise<number> {
    return await visitorModel.visitor.gpCount();
  }

  async searchVisitors(
    searchTerm: string | string[],
    page: number,
    pageSize: number,
    userId?: string
  ): Promise<paginatedData> {
    const unitIds = await this.unitScope(userId);
    return await visitorModel.visitor.gpSearch(searchTerm, page, pageSize, unitIds);
  }

  async getStats(from?: string, to?: string): Promise<any> {
    return await visitorModel.visitor.gpStats(from, to);
  }

  async getPersonHistory(opts: { phone?: string; name?: string; cnic?: string }): Promise<any> {
    return await visitorModel.visitor.gpPersonHistory(opts);
  }

  async lookupPerson(opts: { phone?: string; name?: string; cnic?: string }): Promise<any> {
    return await visitorModel.visitor.gpLookupPerson(opts);
  }

  async suggestPersons(term: string, limit?: number): Promise<any> {
    return await visitorModel.visitor.gpSuggestPersons(term, limit);
  }

  async getFiltered(
    opts: { from?: string; to?: string; outcome?: string; purchased?: boolean; waiting?: boolean; unitId?: string },
    page: number,
    pageSize: number,
    userId?: string
  ): Promise<paginatedData> {
    const unitIds = await this.unitScope(userId);
    return await visitorModel.visitor.gpFilterPaginated(opts, page, pageSize, unitIds);
  }

  async getPresent(page: number, pageSize: number, userId?: string): Promise<paginatedData> {
    const unitIds = await this.unitScope(userId);
    return await visitorModel.visitor.gpPresent(page, pageSize, unitIds);
  }

  async getHistoryById(visitorId: string, filter?: boolean, date?: string): Promise<any> {
    return await visitorModel.visitor.getHistoryById(visitorId, filter, date);
  }

  // ---- Excel export ----

  async generateExcel(opts: {
    from?: string;
    to?: string;
    outcome?: string;
    purchased?: boolean;
  }): Promise<{ wbout: Buffer; fileName: string }> {
    const data = await visitorModel.visitor.gpFilter(opts);
    return await this.excelUtility.create(data);
  }

  async generateTemplate(): Promise<{ wbout: Buffer; fileName: string }> {
    return await this.excelUtility.buildTemplate();
  }

  // ---- Excel import ----

  /**
   * Import from the clean single-sheet template.
   */
  async importVisitors(
    file: Buffer,
    createdByUserId?: string
  ): Promise<{ created: number; parsed: number }> {
    const rows = await this.excelUtility.parseTemplate(file);
    const result = await visitorModel.visitor.gpBulkCreate(rows, createdByUserId);
    return { created: result.created, parsed: rows.length };
  }

  /**
   * Import from the historical multi-sheet "Reception Visitors List" workbook.
   */
  async importReceptionWorkbook(
    file: Buffer,
    createdByUserId?: string
  ): Promise<{ created: number; parsed: number; skippedSheets: string[] }> {
    const { rows, skippedSheets } = await this.excelUtility.parseReceptionWorkbook(file);
    const result = await visitorModel.visitor.gpBulkCreate(rows, createdByUserId);
    return { created: result.created, parsed: rows.length, skippedSheets };
  }
}

export default VisitorService;
