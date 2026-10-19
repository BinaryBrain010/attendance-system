/**
 * Tiny in-process TTL cache for analytics results. Keyed by caller + widget + filters so one user's
 * scoped data never leaks to another. Default TTL 60s (big aggregate queries are expensive and the
 * numbers rarely need to be fresher than a minute). Not shared across processes — fine for a single
 * Node instance; swap for Redis if the backend is clustered.
 */
type Entry = { value: any; expires: number };
const store = new Map<string, Entry>();
const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 2000;

export function cacheKey(parts: Array<string | number | undefined | null | object>): string {
  return parts.map((p) => (p && typeof p === "object" ? JSON.stringify(p) : String(p ?? ""))).join("|");
}

export async function cached<T>(key: string, producer: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await producer();
  if (store.size >= MAX_ENTRIES) {
    // cheap eviction: drop the first (oldest-inserted) key
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Clear everything (used by tests / after a write that should invalidate dashboards). */
export function clearCache(): void {
  store.clear();
}
