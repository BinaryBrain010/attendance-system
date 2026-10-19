/**
 * While an admin is impersonating ("login as user"), a set of sensitive actions must be blocked so
 * the impersonator cannot change credentials/access or nuke sessions as the target. The auth
 * middleware sets `req.impersonatorId` from the token; when present we 403 the blocked routes.
 *
 * Mounted after requestContext and before requirePermission (see routes.helper.ts). Logout-of-all
 * lives on the un-authenticated /auth group, so it is additionally guarded inside its controller.
 */
import { Request, Response, NextFunction } from "express";

const BLOCKED_EXACT = new Set<string>([
  "POST /user/changePassword",
  "POST /user/changeUserPassword",
  "POST /user/linkEmployee",
  "POST /user/unlinkedEmployees",
  "POST /user/impersonate", // no nesting
]);

// Role / group / permission assignment changes — any mutation on these modules is blocked.
const BLOCKED_PREFIXES = ["/role", "/group", "/userRole", "/groupRole", "/userGroup", "/featurePermission"];
const MUTATION = /(create|update|delete|restore|assign|revoke|add|remove|edit|change)/i;

function isBlocked(method: string, fullPath: string): boolean {
  if (BLOCKED_EXACT.has(`${method} ${fullPath}`)) return true;
  const inModule = BLOCKED_PREFIXES.some((p) => fullPath === p || fullPath.startsWith(p + "/"));
  if (!inModule) return false;
  if (method === "PUT" || method === "PATCH" || method === "DELETE") return true;
  if (method === "POST" && MUTATION.test(fullPath)) return true;
  return false;
}

export function blockDuringImpersonation(req: Request, res: Response, next: NextFunction): void {
  const r = req as Request & { impersonatorId?: string | null };
  if (!r.impersonatorId) { next(); return; }
  const fullPath = (req.baseUrl || "") + (req.path || "");
  if (isBlocked(req.method, fullPath)) {
    res.status(403).json({
      success: false,
      message: "This action is not allowed while you are logged in as another user. Exit first.",
      statusCode: 403,
    });
    return;
  }
  next();
}

export default blockDuringImpersonation;
