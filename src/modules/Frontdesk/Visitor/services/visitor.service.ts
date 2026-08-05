import visitorModel from "../models/visitor.model";
import { Visitor } from "../types/visitor";
import { paginatedData } from "../../../../types/paginatedData";
import { VisitorExcelUtility } from "../../../../excel/visitor";

class VisitorService {
  private excelUtility = new VisitorExcelUtility();

  async getAllVisitors(): Promise<Visitor[]> {
    return await visitorModel.visitor.gpFindMany();
  }

  async getVisitors(page: number, pageSize: number): Promise<paginatedData> {
    return await visitorModel.visitor.gpPgFindMany(page, pageSize);
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
    return await visitorModel.visitor.gpCreate(visitorData);
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
    pageSize: number
  ): Promise<paginatedData> {
    return await visitorModel.visitor.gpSearch(searchTerm, page, pageSize);
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
    opts: { from?: string; to?: string; outcome?: string; purchased?: boolean },
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await visitorModel.visitor.gpFilterPaginated(opts, page, pageSize);
  }

  async getPresent(page: number, pageSize: number): Promise<paginatedData> {
    return await visitorModel.visitor.gpPresent(page, pageSize);
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
