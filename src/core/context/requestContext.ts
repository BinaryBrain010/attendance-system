/**
 * Per-request context, carried implicitly via AsyncLocalStorage so that the Prisma client
 * extension (src/core/audit) can stamp createdById/updatedById/deletedById and write AuditLog
 * rows without every service having to thread a userId through its calls.
 *
 * Populated by src/core/context/contextMiddleware.ts right after the auth middleware sets
 * req.userId. Crons, imports and seeders that run outside the request cycle must wrap their work
 * in runAsSystem(...) so their writes are attributed to the System user instead of being blank.
 */
import { AsyncLocalStorage } from "node:async_hooks";

// Fixed id of the seeded System user (see seeder.ts / seedSystemUser). All-zero uuid, 36 chars.
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
export const SYSTEM_USERNAME = "system";

export interface RequestContext {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  platform?: string | null; // "Admin" | "Attendance App" | "Mobile" | "system" | null
  requestId?: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();
export default als;
export { als };

export function getContext(): RequestContext | undefined {
  return als.getStore();
}

export function getActorId(): string | null {
  const s = als.getStore();
  return s && s.userId ? s.userId : null;
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/** Run fn attributed to the System user (crons, imports, seeders). */
export function runAsSystem<T>(fn: () => T, extra?: Partial<RequestContext>): T {
  return als.run({ userId: SYSTEM_USER_ID, platform: "system", ...extra }, fn);
}
