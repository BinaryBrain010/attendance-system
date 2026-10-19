/**
 * Dashboard persistence for Analytics. Users own personal dashboards (create / rename / duplicate /
 * delete / set-home / share-to-roles); the ROLE DEFAULT is virtual (the auto catalog layout the
 * viewer builds client-side when they have no home dashboard) so nothing extra is stored per role.
 * Reads need analytics.read.*; writes need analytics.dashboard.* (enforced here AND in featureMap).
 * A user may only mutate dashboards they own; shared / others' dashboards are read-only.
 */
import prisma from "../../../core/models/base.model";
import { ForbiddenError, NotFoundError } from "../../../core/errors/app.error";
import { getFeatureSet, holds, GOD_ID } from "../shared/gating";

export interface WidgetInput {
  widgetKey?: string | null;
  savedWidgetId?: string | null;
  type: string;
  title?: string | null;
  config?: any;
  x?: number; y?: number; w?: number; h?: number;
}

async function userRoleIds(userId: string): Promise<string[]> {
  const [direct, groups] = await Promise.all([
    prisma.userRole.findMany({ where: { userId, isDeleted: null }, select: { roleId: true } }),
    prisma.userGroup.findMany({ where: { userId, isDeleted: null }, select: { groupId: true } }),
  ]);
  const groupIds = groups.map((g) => g.groupId);
  const viaGroups = groupIds.length
    ? await prisma.groupRole.findMany({ where: { groupId: { in: groupIds }, isDeleted: null }, select: { roleId: true } })
    : [];
  return Array.from(new Set([...direct.map((r) => r.roleId), ...viaGroups.map((r) => r.roleId)]));
}

class DashboardService {
  private requireWrite(feats: Set<string>, userId: string) {
    if (userId === GOD_ID) return;
    if (!holds(feats, "analytics.dashboard.*")) throw new ForbiddenError("You cannot manage dashboards");
  }

  private async loadOwned(userId: string, id: string) {
    const d = await prisma.dashboard.findFirst({ where: { id, isDeleted: null } });
    if (!d) throw new NotFoundError("Dashboard not found");
    if (d.ownerId !== userId && userId !== GOD_ID) throw new ForbiddenError("This dashboard is not yours");
    return d;
  }

  /** Dashboards the user owns or that are shared to one of their roles. */
  async list(userId: string) {
    const roleIds = userId === GOD_ID ? [] : await userRoleIds(userId);
    const rows = await prisma.dashboard.findMany({
      where: {
        isDeleted: null,
        OR: [{ ownerId: userId }, ...(roleIds.length ? [{ sharedRoleIds: { hasSome: roleIds } }] : [])],
      },
      select: { id: true, name: true, isHome: true, ownerId: true, sharedRoleIds: true, updatedAt: true },
      orderBy: [{ isHome: "desc" }, { updatedAt: "desc" }],
    });
    return rows.map((r) => ({ id: r.id, name: r.name, isHome: r.isHome, mine: r.ownerId === userId, shared: r.ownerId !== userId, updatedAt: r.updatedAt }));
  }

  /** One dashboard with its widgets. Owner, shared-to-role, or god may read it. */
  async get(userId: string, id: string) {
    const d = await prisma.dashboard.findFirst({ where: { id, isDeleted: null }, include: { widgets: { where: { isDeleted: null }, orderBy: [{ y: "asc" }, { x: "asc" }] } } });
    if (!d) throw new NotFoundError("Dashboard not found");
    if (d.ownerId !== userId && userId !== GOD_ID) {
      const roleIds = await userRoleIds(userId);
      const shared = d.sharedRoleIds.some((r) => roleIds.includes(r));
      if (!shared) throw new ForbiddenError("This dashboard is outside your access");
    }
    return { ...d, mine: d.ownerId === userId };
  }

  async create(userId: string, feats: Set<string>, body: { name?: string; filters?: any; widgets?: WidgetInput[] }) {
    this.requireWrite(feats, userId);
    const d = await prisma.dashboard.create({ data: { name: (body.name || "My dashboard").slice(0, 120), ownerId: userId, filters: body.filters ?? undefined } });
    if (Array.isArray(body.widgets) && body.widgets.length) await this.replaceWidgets(d.id, body.widgets);
    return this.get(userId, d.id);
  }

  async update(userId: string, feats: Set<string>, body: { id: string; name?: string; filters?: any; widgets?: WidgetInput[] }) {
    this.requireWrite(feats, userId);
    const d = await this.loadOwned(userId, body.id);
    await prisma.dashboard.update({
      where: { id: d.id },
      data: { name: body.name != null ? body.name.slice(0, 120) : undefined, filters: body.filters !== undefined ? body.filters : undefined },
    });
    if (Array.isArray(body.widgets)) await this.replaceWidgets(d.id, body.widgets);
    return this.get(userId, d.id);
  }

  async remove(userId: string, feats: Set<string>, id: string) {
    this.requireWrite(feats, userId);
    await this.loadOwned(userId, id);
    await prisma.dashboard.update({ where: { id }, data: { isDeleted: new Date() } });
    return { id };
  }

  async duplicate(userId: string, feats: Set<string>, id: string, name?: string) {
    this.requireWrite(feats, userId);
    const src = await this.get(userId, id); // readability already enforced
    const copy = await prisma.dashboard.create({ data: { name: (name || `${src.name} copy`).slice(0, 120), ownerId: userId, filters: (src as any).filters ?? undefined } });
    await this.replaceWidgets(copy.id, src.widgets.map((w: any) => ({ widgetKey: w.widgetKey, savedWidgetId: w.savedWidgetId, type: w.type, title: w.title, config: w.config, x: w.x, y: w.y, w: w.w, h: w.h })));
    return this.get(userId, copy.id);
  }

  async setHome(userId: string, feats: Set<string>, id: string) {
    this.requireWrite(feats, userId);
    await this.loadOwned(userId, id);
    await prisma.dashboard.updateMany({ where: { ownerId: userId, isHome: true, isDeleted: null }, data: { isHome: false } });
    await prisma.dashboard.update({ where: { id }, data: { isHome: true } });
    return { id };
  }

  async share(userId: string, feats: Set<string>, id: string, roleIds: string[]) {
    this.requireWrite(feats, userId);
    await this.loadOwned(userId, id);
    await prisma.dashboard.update({ where: { id }, data: { sharedRoleIds: Array.isArray(roleIds) ? roleIds : [] } });
    return { id, sharedRoleIds: roleIds };
  }

  private async replaceWidgets(dashboardId: string, widgets: WidgetInput[]) {
    await prisma.dashboardWidget.updateMany({ where: { dashboardId, isDeleted: null }, data: { isDeleted: new Date() } });
    for (const w of widgets) {
      await prisma.dashboardWidget.create({
        data: {
          dashboardId,
          widgetKey: w.widgetKey ?? null,
          savedWidgetId: w.savedWidgetId ?? null,
          type: w.type,
          title: w.title ?? null,
          config: w.config ?? undefined,
          x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 4, h: w.h ?? 4,
        },
      });
    }
  }
}

export default DashboardService;
export { userRoleIds };
