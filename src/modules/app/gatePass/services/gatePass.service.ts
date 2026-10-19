import gatePassModel from "../models/gatePass.model";
import { CreateGatePassItem, GatePass } from "../../../../types/schema";
import { GatePassPDF } from "../../../../pdf/gatePass";
import { DetailedGatePass, paginatedData } from "../../../../types/paginatedData";
import { Status } from "../../../../enums/schema";
import prisma from "../../../../core/models/base.model";

// The current mobile APK only understands pending/approved/cancelled. Map the new workflow statuses to
// the closest value it renders safely, so the existing (mobile-facing) endpoints never surprise it.
// The admin web uses the dedicated webList/webDetail endpoints below, which return the REAL status.
const MOBILE_STATUS_MAP: Record<string, string> = {
  dispatched: "approved",
  returned: "approved",
  closed: "approved",
  rejected: "cancelled",
};
function mapRowStatusForMobile<T>(value: T): T {
  if (Array.isArray(value)) { value.forEach((v) => mapRowStatusForMobile(v)); return value; }
  if (value && typeof value === "object") {
    const o = value as any;
    if (typeof o.status === "string" && MOBILE_STATUS_MAP[o.status]) o.status = MOBILE_STATUS_MAP[o.status];
    if (Array.isArray(o.data)) mapRowStatusForMobile(o.data);
    return value;
  }
  return value;
}

class GatePassService {
  private pdfUtility: GatePassPDF = new GatePassPDF();

  async getAllGatePass(): Promise<GatePass[]> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpFindMany());
  }

  async getGatePass(page: number, pageSize: number): Promise<paginatedData> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpPgFindMany(page, pageSize));
  }

  async getDeletedGatePass(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpPgDeletedFindMany(page, pageSize));
  }

  async createGatePass(
    GatePassData: GatePass,
    GatePassItem: CreateGatePassItem[]
  ): Promise<GatePass | GatePass[]> {
    return await gatePassModel.gatePass.gpCreate(GatePassData,GatePassItem);
  }

  async updateGatePass(
    GatePassId: string,
    GatePassData: GatePass,
    GatePassItem: CreateGatePassItem[]
  ) {
    return await gatePassModel.gatePass.gpUpdate(GatePassId, GatePassData,GatePassItem);
  }

  async deleteGatePass(GatePassId: string): Promise<void> {
    await gatePassModel.gatePass.gpSoftDelete(GatePassId);
  }

  async restoreGatePass(GatePassId: string): Promise<void> {
    await gatePassModel.gatePass.gpRestore(GatePassId);
  }

  async getGatePassById(GatePassId: string): Promise<DetailedGatePass> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpFindById(GatePassId));
  }

  async getGatePassByCustomer(GatePassId: string): Promise<DetailedGatePass[]> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpFindByCustomerId(GatePassId));
  }

  async getGatePassByItem(itemId: string): Promise<DetailedGatePass[]> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpFindByItemId(itemId));
  }

  async getTotal() {
    return await gatePassModel.gatePass.gpCount();
  }

  async approveGatePass(GatePassId: string, signature?: string | null) {
   return await gatePassModel.gatePass.gpApprovePass(GatePassId, signature);
  }

  async getTotalGatePass(): Promise<number> {
    return await gatePassModel.gatePass.gpCount();
  }

  async getDateFiltered(
    page: number,
    pageSize: number,
    from: Date,
    to: Date
  ): Promise<paginatedData> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpPgDateFilter(
      page,
      pageSize,
      from,
      to
    ));
  }

  async getStatusFilterd(
    page: number,
    pageSize: number,
    status: Status
  ): Promise<paginatedData> {
    return mapRowStatusForMobile(await gatePassModel.gatePass.gpPgStatusFilter(
      page,
      pageSize,
      status
    ));
  }

  async getGatePassesReport() {
    return await gatePassModel.gatePass.getGatePassesReport();
  }

  // ---------- ADMIN WEB (real statuses, server-side filters + pagination) ----------

  /** Filtered, paginated gate-pass list for the admin web. Returns REAL statuses (not mobile-mapped). */
  async webList(filters: {
    page?: number; pageSize?: number; status?: string; customerId?: string; itemId?: string;
    from?: string | Date; to?: string | Date; search?: string;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize) || 20));
    const where: any = { isDeleted: null };
    if (filters.status) where.status = filters.status as any;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.itemId) where.items = { some: { itemId: filters.itemId, isDeleted: null } };
    if (filters.from || filters.to) {
      where.issuedAt = {};
      if (filters.from) where.issuedAt.gte = new Date(filters.from);
      if (filters.to) where.issuedAt.lte = new Date(filters.to);
    }
    const s = (filters.search || "").trim();
    if (s) {
      where.OR = [
        { vehicleNo: { contains: s, mode: "insensitive" } },
        { storeIncharge: { contains: s, mode: "insensitive" } }, // "driver" / store incharge
        { id: { contains: s, mode: "insensitive" } },            // no dedicated GP number: search the id
        { customer: { is: { name: { contains: s, mode: "insensitive" } } } },
      ];
    }
    const [rows, totalSize] = await Promise.all([
      prisma.gatePass.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true } },
          items: { where: { isDeleted: null }, select: { id: true, quantity: true, item: { select: { id: true, name: true } } } },
        },
      }),
      prisma.gatePass.count({ where }),
    ]);
    const data = rows.map((g) => ({
      id: g.id,
      status: g.status,
      customerId: g.customerId,
      customerName: g.customer?.name || "",
      location: g.location,
      vehicleNo: g.vehicleNo,
      storeIncharge: g.storeIncharge,
      notes: g.notes,
      issuedAt: g.issuedAt,
      validUntil: g.validUntil,
      itemCount: g.items.length,
      items: g.items.map((i) => ({ id: i.id, name: i.item?.name || "", quantity: i.quantity })),
    }));
    return { data, totalSize, page, pageSize };
  }

  /** Full gate-pass detail for the admin web: real status, items (with serials), signature + the
   *  status history (who/when/reason), and the audit footer ids. */
  async webDetail(id: string) {
    const g = await prisma.gatePass.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        items: { where: { isDeleted: null }, include: { item: { select: { id: true, name: true, description: true } } } },
      },
    });
    if (!g) return null;
    const { default: GatePassWorkflowService } = await import("./gatePassWorkflow.service");
    const history = await new GatePassWorkflowService().history(id);
    let approvedBy: any = null;
    if ((g as any).updatedById) {
      const u = await prisma.user.findUnique({ where: { id: (g as any).updatedById }, select: { id: true, username: true } }).catch(() => null);
      approvedBy = u || null;
    }
    return {
      ...g,
      items: g.items.map((i) => ({ id: i.id, itemId: i.itemId, name: i.item?.name || "", description: i.item?.description || null, quantity: i.quantity, serialNos: i.serialNos })),
      history,
      approvedBy,
    };
  }
}

export default GatePassService;
