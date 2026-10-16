/**
 * Seeds the AsyncLocalStorage request context for every authenticated request, so downstream
 * code (notably the Prisma audit extension) can attribute writes to the caller and capture
 * ip / user-agent / platform / requestId. Mounted in src/helper/routes.helper.ts right after
 * authentication.authenticateToken (which sets req.userId) and before requirePermission.
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import als from "./requestContext";

function firstIp(xff: unknown, fallback?: string): string | null {
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return fallback || null;
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as Request & { userId?: string }).userId ?? null;
  // With `trust proxy` set (server.ts), Express resolves req.ip to the real client IP from
  // X-Forwarded-For. Fall back to parsing the header / socket address if req.ip is unset.
  const ip = req.ip || firstIp(req.headers["x-forwarded-for"], req.socket?.remoteAddress || undefined);
  const uaRaw = req.headers["user-agent"];
  const userAgent = typeof uaRaw === "string" ? uaRaw : null;
  const platRaw = req.headers["x-platform"];
  const platform = typeof platRaw === "string" ? platRaw : null;
  const ridRaw = req.headers["x-request-id"];
  const requestId = typeof ridRaw === "string" && ridRaw.length ? ridRaw : randomUUID();
  als.run({ userId, ip, userAgent, platform, requestId }, () => next());
}

export default requestContext;
