/**
 * Single source of truth for error responses. Classifies an error, maps Prisma / validation errors
 * to the right 4xx (so bad input is never a scary 500), and for genuine 500s mints a short reference
 * id, logs the real error + stack against that id (visible in pm2 logs), and returns a user-safe
 * "Something went wrong. Ref: <id>". Used by BaseController.handleError and the global error middleware.
 */
import { Response } from "express";
import { randomUUID } from "crypto";
import logger from "../logger/logger";
import { AppError } from "../errors/app.error";
import { getActorId } from "../context/requestContext";

export interface Classified { statusCode: number; message: string; ref?: string }

export function classifyError(error: any): Classified {
  // Operational AppErrors carry their own status + safe message.
  if (error instanceof AppError || (error && typeof error.statusCode === "number" && error.isOperational)) {
    return { statusCode: error.statusCode, message: error.message };
  }
  const code = error?.code as string | undefined;
  const name = error?.name as string | undefined;

  // body-parser / http-errors (malformed JSON body, payload too large, unsupported media type) carry
  // their own 4xx status + `expose`. Honor it so a bad REQUEST is a 4xx, never a scary 500.
  const httpStatus = Number(error?.status ?? error?.statusCode);
  if (httpStatus >= 400 && httpStatus < 500 && (error?.expose === true || typeof error?.type === "string")) {
    if (error?.type === "entity.parse.failed") return { statusCode: 400, message: "Invalid request body: malformed JSON." };
    if (error?.type === "entity.too.large") return { statusCode: 413, message: "Request body is too large." };
    return { statusCode: httpStatus, message: httpStatus === 400 ? "Invalid request." : (error?.message || "Request error") };
  }

  // Prisma known-request errors
  if (code === "P2002") {
    const t = error?.meta?.target;
    return { statusCode: 409, message: t ? `Duplicate value: ${Array.isArray(t) ? t.join(", ") : t}` : "Duplicate value" };
  }
  if (code === "P2025") return { statusCode: 404, message: "Record not found" };
  if (code === "P2003") return { statusCode: 400, message: "Invalid reference" };
  if (code === "P2000" || code === "P2011" || code === "P2012") return { statusCode: 400, message: "Invalid request" };

  // Prisma validation (e.g. a getById hit without an id) and zod — client-side input problems.
  if (name === "PrismaClientValidationError") return { statusCode: 400, message: "Invalid request" };
  if (name === "ZodError") return { statusCode: 400, message: "Validation failed" };

  // Genuine, unexpected failure → reference id + full server-side log.
  const ref = randomUUID().slice(0, 8).toUpperCase();
  return { statusCode: 500, message: `Something went wrong. Ref: ${ref}`, ref };
}

export function sendError(res: Response, error: any, ctx: { method?: string; path?: string; requestId?: string } = {}) {
  const c = classifyError(error);
  const userId = getActorId();
  if (c.statusCode >= 500) {
    logger.error(`[500] ref=${c.ref} ${ctx.method || ""} ${ctx.path || ""} user=${userId || "-"}`.trim(), {
      ref: c.ref,
      requestId: ctx.requestId,
      userId,
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    });
  } else {
    logger.warn(`[${c.statusCode}] ${ctx.method || ""} ${ctx.path || ""}: ${c.message}`.trim(), { code: error?.code, name: error?.name });
  }
  if (res.headersSent) return;
  return res.status(c.statusCode).json({ success: false, message: c.message, ...(c.ref ? { ref: c.ref } : {}), statusCode: c.statusCode });
}
