/**
 * Cost / margin visibility gate.
 *
 * `crm.catalogue.cost.*` (or god) is required to see `cost`, `unitCost`, `margin` and `marginPct`
 * anywhere — price lists, products, quotation/order lines, and every report & export. Services call
 * `canSeeCost(userId)` once, then `stripCost(obj, canSee)` on anything leaving the server.
 */
import { GOD_ID, getFeatureSet, holds } from "./access";

const COST_KEYS = ["cost", "unitCost", "margin", "marginPct", "totalCost"];

export async function canSeeCost(userId: string): Promise<boolean> {
  if (userId === GOD_ID) return true;
  const feats = await getFeatureSet(userId);
  return holds(feats, "crm.catalogue.cost.*");
}

/** A plain object we should recurse into (not a Date/Buffer/etc. which must be returned as-is). */
function isPlainObject(v: any): boolean {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Deep-strip cost keys from an object/array unless the caller may see cost. Returns a safe copy. */
export function stripCost<T>(data: T, canSee: boolean): T {
  if (canSee || data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map((d) => stripCost(d, canSee)) as unknown as T;
  if (isPlainObject(data)) {
    const out: any = {};
    for (const [k, v] of Object.entries(data as any)) {
      if (COST_KEYS.includes(k)) continue;
      out[k] = isPlainObject(v) || Array.isArray(v) ? stripCost(v, canSee) : v; // leave Date/Buffer as-is
    }
    return out;
  }
  return data; // Date, Buffer, etc. untouched
}
