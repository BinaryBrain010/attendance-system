import visitorModel from "../models/visitor.model";
import { Visitor } from "../types/visitor";
import { paginatedData } from "../../../../types/paginatedData";
import { VisitorExcelUtility } from "../../../../excel/visitor";
import prisma from "../../../../core/models/base.model";
import { getAccessibleUnitIds } from "../../../AMS/Unit/helper/unitAccess.helper";
import { notify } from "../../../Work/shared/workHelpers";
import accessModel from "../../../rbac/Access/models/access.model";
import { AppError, NotFoundError, ForbiddenError } from "../../../../core/errors/app.error";

// 6c: holders of this feature see visitors from every unit; everyone else is scoped to their units.
const VISITOR_VIEW_ALL = "visitor.viewAll.unit.*";
const VISITOR_READ = "visitor.read.*";

class VisitorService {
  private excelUtility = new VisitorExcelUtility();

  /** 6c: unit ids the user may see (null = all units). A user with NO unit assignment (and not a
   *  viewAll holder) would otherwise be scoped to an empty set — which, once the backfill gives every
   *  visitor a unit, means an empty page. visitor.read.* already gates access, so we fall back to
   *  showing all visitors rather than nothing/an error. */
  private async unitScope(userId?: string): Promise<string[] | null> {
    const ids = await getAccessibleUnitIds(userId, VISITOR_VIEW_ALL);
    if (Array.isArray(ids) && ids.length === 0) return null; // no unit → see all (not empty)
    return ids;
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

  /** Export the visitors matching the screen's current view + filters (unit-scoped), newest first,
   *  capped (+1 to detect the ceiling). Routes through the same list methods the UI uses so the export
   *  equals what is on screen. */
  async exportRows(
    userId: string | undefined,
    cap: number,
    opts?: { view?: string; search?: string; from?: string; to?: string; outcome?: string; purchased?: boolean; unitId?: string }
  ): Promise<any[]> {
    const unitIds = await this.unitScope(userId);
    const o = opts || {};
    let res: any;
    if (o.view === "present") {
      res = await visitorModel.visitor.gpPresent(1, cap + 1, unitIds);
    } else if (o.view === "filtered") {
      res = await visitorModel.visitor.gpFilterPaginated(
        { from: o.from, to: o.to, outcome: o.outcome, purchased: o.purchased, unitId: o.unitId },
        1, cap + 1, unitIds
      );
    } else if (o.search && o.search.trim()) {
      res = await visitorModel.visitor.gpSearch(o.search.trim(), 1, cap + 1, unitIds);
    } else {
      res = await visitorModel.visitor.gpPgFindMany(1, cap + 1, unitIds);
    }
    return res?.data || [];
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

  /**
   * Part 1a: the host (the referred-to employee's user) OR a front-desk reader may open/respond to a
   * referral. 403 for anyone else. This backs the "A visitor is here to see you" notification so the
   * host — who has no frontdesk permission — can still open the visit and respond.
   */
  private async assertHostOrFrontdesk(userId: string | undefined, visitor: { referredToEmployeeId?: string | null }): Promise<{ isHost: boolean }> {
    if (!userId) throw new AppError(401, "Not authenticated.");
    try {
      if (await accessModel.user.checkUserPermission(userId, VISITOR_READ)) return { isHost: false };
      if (await accessModel.user.checkUserPermission(userId, VISITOR_VIEW_ALL)) return { isHost: false };
    } catch { /* fall through to host check */ }
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (me?.employeeId && visitor.referredToEmployeeId && me.employeeId === visitor.referredToEmployeeId) return { isHost: true };
    throw new ForbiddenError("You are not the host of this visit.");
  }

  /** Part 2 "My visitors": visits referred to the caller's own employee (self — derived from the user). */
  async getMyVisitors(userId: string | undefined, page = 1, pageSize = 20): Promise<paginatedData> {
    if (!userId) throw new AppError(401, "Not authenticated.");
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!me?.employeeId) return { data: [], totalSize: 0 } as any;
    const where = { referredToEmployeeId: me.employeeId, isDeleted: null };
    const take = Math.min(100, Math.max(1, pageSize));
    const [rows, totalSize] = await Promise.all([
      prisma.visitor.findMany({ where, orderBy: { visitDate: "desc" }, skip: (Math.max(1, page) - 1) * take, take,
        select: { id: true, name: true, company: true, phone: true, purpose: true, visitDate: true, timeIn: true, timeOut: true, referredAt: true, attendedAt: true, attendedNote: true } }),
      prisma.visitor.count({ where }),
    ]);
    const data = rows.map((v) => ({ ...v, arrivalTime: v.timeIn || v.referredAt || v.visitDate, status: v.timeOut ? "CHECKED_OUT" : v.attendedAt ? "ATTENDED" : "WAITING" }));
    return { data, totalSize } as any;
  }

  /** Self/host visitor detail for the referral notification (host OR frontdesk). Minimal, safe fields. */
  async getMyVisitor(userId: string | undefined, visitorId: string): Promise<any> {
    if (!visitorId) throw new AppError(400, "visitorId is required.");
    const v = await prisma.visitor.findFirst({
      where: { id: visitorId, isDeleted: null },
      select: { id: true, name: true, company: true, phone: true, purpose: true, visitDate: true, timeIn: true, timeOut: true, referredAt: true, attendedAt: true, attendedNote: true, referredToEmployeeId: true, referredToText: true },
    });
    if (!v) throw new NotFoundError("Visitor");
    const { isHost } = await this.assertHostOrFrontdesk(userId, v);
    const status = v.timeOut ? "CHECKED_OUT" : v.attendedAt ? "ATTENDED" : "WAITING";
    const { referredToEmployeeId, ...rest } = v as any;
    return { ...rest, arrivalTime: v.timeIn || v.referredAt || v.visitDate, status, isHost };
  }

  /** Host (or frontdesk) responds: ATTEND (accept), WAIT (ask to wait), DECLINE. Notifies the logger. */
  async respondVisitor(userId: string | undefined, visitorId: string, action: string, note?: string): Promise<any> {
    if (!visitorId) throw new AppError(400, "visitorId is required.");
    const v = await prisma.visitor.findFirst({ where: { id: visitorId, isDeleted: null } });
    if (!v) throw new NotFoundError("Visitor");
    await this.assertHostOrFrontdesk(userId, v);
    const act = String(action || "").toUpperCase();
    if (act === "ATTEND" || act === "ACCEPT") return await this.attendVisitor(visitorId, userId, note);
    if (act !== "WAIT" && act !== "DECLINE") throw new AppError(400, "action must be ATTEND, WAIT or DECLINE.");
    const label = act === "WAIT" ? "asked the visitor to wait" : "declined the visit";
    const hostNote = `${act === "WAIT" ? "Asked to wait" : "Declined"}${note ? `: ${note}` : ""}`;
    const updated = await prisma.visitor.update({ where: { id: visitorId }, data: { attendedNote: hostNote, updatedAt: new Date(), updatedBy: userId || null } as any });
    try { if (v.createdById) await notify([v.createdById], "VISITOR_RESPONSE", "Visitor response", `The host ${label}${note ? `: ${note}` : ""}.`, "Visitor", visitorId); } catch { /* best effort */ }
    return updated;
  }

  /** 6b: host marks the visit attended. Notifies the front-desk user who logged the visit. */
  async attendVisitor(visitorId: string, userId?: string, note?: string): Promise<Visitor> {
    const result = await visitorModel.visitor.gpAttend(visitorId, userId, note);
    try {
      const v = await prisma.visitor.findUnique({ where: { id: visitorId }, select: { name: true, createdById: true } });
      // createdById is the User id of whoever logged the visitor (audit stamp).
      if (v?.createdById && v.createdById !== userId) {
        await notify([v.createdById], "VISITOR_ATTENDED", "Visitor attended",
          `${v.name || "A visitor"} was received by the host.`, "Visitor", visitorId);
      }
    } catch (e) {
      console.error("Failed to notify logger of attended visitor:", e);
    }
    return result;
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
