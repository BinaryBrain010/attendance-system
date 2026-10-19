/**
 * Insights (Analytics) service — permission-aware widget catalog + scoped widget data.
 *   catalog(userId)                 -> only the widgets whose module is enabled AND whose entity the
 *                                      caller can read (disabled modules never appear).
 *   widgetData(userId, key, filters)-> computes one widget, re-checking the gate server-side and
 *                                      resolving the caller's scope; cached 60s per caller+filters.
 */
import { ForbiddenError, NotFoundError } from "../../../core/errors/app.error";
import { getFeatureSet, moduleEnabled, ModuleKey } from "../shared/gating";
import { entityScope, Entity, EntityScope } from "../shared/scope";
import { WIDGETS, WIDGET_BY_KEY, canSeeEntity, Ctx } from "../widgets/registry";
import { Filters, parseWindow } from "../shared/query";
import { cached, cacheKey } from "../shared/cache";

const MODULE_LABEL: Record<ModuleKey, string> = {
  quickMark: "Quick Mark", frontdesk: "Frontdesk", quickPass: "Quick Pass",
  crm: "CRM", work: "Work", access: "Access & Audit",
};
const MODULE_ORDER: ModuleKey[] = ["quickMark", "frontdesk", "quickPass", "crm", "work", "access"];

class InsightsService {
  /** The widgets this user may add to a dashboard, grouped by module. */
  async catalog(userId: string) {
    const feats = await getFeatureSet(userId);
    const items = WIDGETS
      .filter((w) => moduleEnabled(feats, userId, w.module) && canSeeEntity(feats, userId, w.entity))
      .map((w) => ({ key: w.key, module: w.module, moduleLabel: MODULE_LABEL[w.module], title: w.title, description: w.description, type: w.type, drill: w.drill }));

    const groups = MODULE_ORDER
      .map((m) => ({ module: m, label: MODULE_LABEL[m], widgets: items.filter((i) => i.module === m) }))
      .filter((g) => g.widgets.length);

    return { widgets: items, groups };
  }

  /** Compute one built-in widget's data, scope-enforced and cached 60s per caller + filters. */
  async widgetData(userId: string, key: string, filters: Filters = {}) {
    const w = WIDGET_BY_KEY[key];
    if (!w) throw new NotFoundError(`Unknown widget: ${key}`);

    const feats = await getFeatureSet(userId);
    if (!(moduleEnabled(feats, userId, w.module) && canSeeEntity(feats, userId, w.entity))) {
      throw new ForbiddenError("This widget is outside your access");
    }

    const ck = cacheKey(["widget", userId, key, filters]);
    return cached(ck, async () => {
      const scopeCache = new Map<Entity, EntityScope>();
      const ctx: Ctx = {
        userId, feats, filters, window: parseWindow(filters),
        scopeOf: async (e) => {
          if (!scopeCache.has(e)) scopeCache.set(e, await entityScope(userId, e, feats));
          return scopeCache.get(e)!;
        },
      };
      const data = await w.compute(ctx);
      return { key, type: w.type, title: w.title, data };
    });
  }
}

export default InsightsService;
