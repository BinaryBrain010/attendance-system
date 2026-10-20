/**
 * Custom (saved) widget service: exposes the builder metadata the caller is allowed to use, runs
 * live previews, and persists SavedWidget definitions (shareable to roles, read-only). Saving needs
 * analytics.customWidget.*. Every preview/render goes through runCustom, which validates against the
 * whitelist and the caller's scope.
 */
import prisma from "../../../core/models/base.model";
import { ForbiddenError, NotFoundError } from "../../../core/errors/app.error";
import { getFeatureSet, moduleEnabled, holds, holdsRead, GOD_ID } from "../shared/gating";
import { Filters } from "../shared/query";
import { ENTITIES, OPERATORS, AGGREGATIONS, CHART_TYPES } from "./whitelist";
import { runCustom, CustomDef } from "./builder";
import { userRoleIds } from "../services/dashboard.service";

const READ_BASE: Record<string, string> = { attendance: "attendance", visitor: "visitor", gatePass: "voucher", gatePassItem: "voucher", lead: "crm.lead", quotation: "crm.quotation", salesOrder: "crm.order", salesReturn: "crm.return", task: "work.task", dailyReport: "work.report", auditLog: "audit" };

class CustomWidgetService {
  /** The builder vocabulary the caller may use: only entities they can read, metrics they're allowed. */
  async meta(userId: string) {
    const feats = await getFeatureSet(userId);
    const entities = ENTITIES
      .filter((e) => userId === GOD_ID || (moduleEnabled(feats, userId, e.module) && holdsRead(feats, READ_BASE[e.key])))
      .map((e) => ({
        key: e.key, label: e.label, module: e.module, dateField: e.dateField,
        dimensions: e.dimensions.map((f) => ({ field: f.field, label: f.label })),
        dates: e.dates.map((f) => ({ field: f.field, label: f.label })),
        metrics: e.metrics.filter((m) => !m.requires || userId === GOD_ID || holds(feats, m.requires)).map((f) => ({ field: f.field, label: f.label })),
        filters: [...e.filters, ...e.dates].map((f) => ({ field: f.field, label: f.label, kind: f.kind })),
      }));
    return { entities, operators: OPERATORS, aggregations: AGGREGATIONS, chartTypes: CHART_TYPES };
  }

  /** Live preview — compute without saving. */
  async preview(userId: string, def: CustomDef, filters: Filters = {}) {
    const feats = await getFeatureSet(userId);
    const data = await runCustom(userId, feats, def, filters);
    return { type: def.chartType, data };
  }

  async save(userId: string, body: { id?: string; name: string; definition: CustomDef; sharedRoleIds?: string[] }) {
    const feats = await getFeatureSet(userId);
    if (userId !== GOD_ID && !holds(feats, "analytics.customWidget.*")) throw new ForbiddenError("You cannot build custom widgets");
    // validate the definition is runnable for this user before saving
    await runCustom(userId, feats, body.definition, {});
    if (body.id) {
      const existing = await prisma.savedWidget.findFirst({ where: { id: body.id, isDeleted: null } });
      if (!existing) throw new NotFoundError("Saved widget not found");
      if (existing.ownerId !== userId && userId !== GOD_ID) throw new ForbiddenError("Not your widget");
      return prisma.savedWidget.update({ where: { id: body.id }, data: { name: body.name.slice(0, 120), definition: body.definition as any, sharedRoleIds: body.sharedRoleIds ?? existing.sharedRoleIds } });
    }
    return prisma.savedWidget.create({ data: { name: (body.name || "Custom widget").slice(0, 120), ownerId: userId, definition: body.definition as any, sharedRoleIds: body.sharedRoleIds ?? [] } });
  }

  async list(userId: string) {
    const roleIds = userId === GOD_ID ? [] : await userRoleIds(userId);
    const rows = await prisma.savedWidget.findMany({
      where: { isDeleted: null, OR: [{ ownerId: userId }, ...(roleIds.length ? [{ sharedRoleIds: { hasSome: roleIds } }] : [])] },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, definition: r.definition, mine: r.ownerId === userId, type: (r.definition as any)?.chartType || "bar" }));
  }

  async remove(userId: string, id: string) {
    const w = await prisma.savedWidget.findFirst({ where: { id, isDeleted: null } });
    if (!w) throw new NotFoundError("Saved widget not found");
    if (w.ownerId !== userId && userId !== GOD_ID) throw new ForbiddenError("Not your widget");
    await prisma.savedWidget.update({ where: { id }, data: { isDeleted: new Date() } });
    return { id };
  }

  /** Render a saved widget by id (used by /insights/widget/data when a dashboard tile is custom). */
  async render(userId: string, id: string, filters: Filters = {}) {
    const feats = await getFeatureSet(userId);
    const w = await prisma.savedWidget.findFirst({ where: { id, isDeleted: null } });
    if (!w) throw new NotFoundError("Saved widget not found");
    if (w.ownerId !== userId && userId !== GOD_ID) {
      const roleIds = await userRoleIds(userId);
      if (!w.sharedRoleIds.some((r) => roleIds.includes(r))) throw new ForbiddenError("This widget is outside your access");
    }
    const def = w.definition as unknown as CustomDef;
    const data = await runCustom(userId, feats, def, filters);
    return { key: id, type: def.chartType, title: w.name, data };
  }
}

export default CustomWidgetService;
