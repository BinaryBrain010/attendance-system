/**
 * CRM shared access helpers.
 *
 * Scope (own/team/all) and cost/margin visibility are enforced in the SERVICE layer, independently
 * of the RBAC_ENFORCE mode of the `requirePermission` middleware (which may be off/log/on). We
 * resolve the caller's effective feature set with the same resolver the middleware uses
 * (AccessService.getAllowedFeaturesForUser) and apply the same ancestor/parent rule: holding a
 * parent feature (e.g. `crm.lead.*`) grants every descendant (`crm.lead.read.all.*`).
 */
import AccessService from "../../rbac/Access/service/access.service";

export const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";
const accessService = new AccessService();

export function isGod(userId?: string | null): boolean {
  return !!userId && userId === GOD_ID;
}

/** Effective feature set for a user (empty on any error, so a failure denies rather than grants). */
export async function getFeatureSet(userId: string): Promise<Set<string>> {
  try {
    const feats = await accessService.getAllowedFeaturesForUser(userId);
    return new Set<string>(Array.isArray(feats) ? feats : []);
  } catch {
    return new Set<string>();
  }
}

/** Ancestors of "a.b.c.*" -> ["a.*","a.b.*"] (same as the middleware). */
export function ancestorsOf(f: string): string[] {
  if (!f.endsWith(".*")) return [];
  const segs = f.slice(0, -2).split(".");
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}

/** Does the set hold feature `f`, honoring the parent rule? */
export function holds(set: Set<string>, f: string): boolean {
  if (!f || f.startsWith("(")) return false;
  if (set.has(f)) return true;
  for (const a of ancestorsOf(f)) if (set.has(a)) return true;
  return false;
}
