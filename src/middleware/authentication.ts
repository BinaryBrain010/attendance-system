import jwt from "jsonwebtoken";
import { secretKey } from "../environment/environment";
import { Request, Response, NextFunction } from "express";
import BlackListedTokenService from "../modules/rbac/Token/service/token.service";
import logger from "../core/logger/logger";

const blackListedTokenService = new BlackListedTokenService();

class Authentication {
  public authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const token = req.headers.authorization?.split(" ")[1];
    const secret_key = secretKey || "";
    
    if (!token) {
      logger.warn("Authentication attempt without token", { path: req.path });
      res.status(401).json({ success: false, message: "Unauthorized", statusCode: 401 });
      return;
    }

    jwt.verify(token, secret_key, async (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
      if (err) {
        logger.warn("Invalid token provided", { path: req.path, error: err.message });
        res.status(403).json({ success: false, message: "Invalid token", statusCode: 403 });
        return;
      }

      if (!decoded || typeof decoded === 'string') {
        logger.warn("Token decoded incorrectly", { path: req.path });
        res.status(403).json({ success: false, message: "Invalid token", statusCode: 403 });
        return;
      }

      const isBlacklisted = await blackListedTokenService.isAuthenticatedToken(
        token
      );

      if (isBlacklisted) {
        logger.warn("Blacklisted token used", { path: req.path, userId: decoded.userId });
        res.status(401).json({ success: false, message: "Unauthorized", statusCode: 401 });
        return;
      }

      // Impersonation ("login as user") is ADMIN-WEB ONLY. An impersonation token carries an
      // `impersonatorId` claim; reject it on the attendance app / mobile (any client that declares a
      // non-Admin x-platform), so a leaked impersonation token can never drive those apps.
      const impersonatorId = (decoded.impersonatorId as string | undefined) || null;
      if (impersonatorId) {
        const platRaw = req.headers["x-platform"];
        const platform = typeof platRaw === "string" ? platRaw.trim() : "";
        if (platform && platform.toLowerCase() !== "admin") {
          logger.warn("Impersonation token rejected on non-admin platform", { path: req.path, platform });
          res.status(401).json({ success: false, message: "Impersonation is not permitted on this app", statusCode: 401 });
          return;
        }
      }

      const r = req as Request & { userId?: string; impersonatorId?: string | null; impersonationId?: string | null };
      r.userId = decoded.userId as string;
      r.impersonatorId = impersonatorId;
      r.impersonationId = (decoded.impersonationId as string | undefined) || null;
      next();
    });
  }
}

export default new Authentication();
