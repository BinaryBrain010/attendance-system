/**
 * Insights (Analytics) gating helpers. A widget is visible only if the caller holds the module's
 * `appModules.*` menu feature AND the read feature behind it. Disabled modules never show. Reuses the
 * same ancestor-aware `holds` as the RBAC middleware (via CRM/shared/access).
 */
import { getFeatureSet, holds, GOD_ID } from "../../CRM/shared/access";

export { getFeatureSet, holds, GOD_ID };

export type ModuleKey = "quickMark" | "frontdesk" | "quickPass" | "crm" | "work" | "access";

/** appModules.* feature that gates each analytics module (the module must be enabled for the user). */
export const MODULE_APP_FEATURE: Record<ModuleKey, string> = {
  quickMark: "appModules.quickMark.*",
  frontdesk: "appModules.frontdesk.*",
  quickPass: "appModules.quickPass.*",
  crm: "appModules.crm.*",
  work: "appModules.work.*",
  access: "appModules.accessControl.*",
};

/**
 * Does the user hold READ on a module base? Accepts the unscoped read (`base.read.*`), the module
 * wildcard (`base.*`), or any scoped read child (`base.read.own.*` / `read.team.*` / `read.all.*`).
 */
export function holdsRead(feats: Set<string>, base: string): boolean {
  if (holds(feats, `${base}.*`)) return true;
  if (holds(feats, `${base}.read.*`)) return true;
  const prefix = `${base}.read.`;
  for (const f of feats) if (f.startsWith(prefix)) return true;
  return false;
}

/** Is the whole analytics MODULE available to the user (appModules gate only)? god sees all. */
export function moduleEnabled(feats: Set<string>, userId: string, module: ModuleKey): boolean {
  if (userId === GOD_ID) return true;
  return holds(feats, MODULE_APP_FEATURE[module]);
}
