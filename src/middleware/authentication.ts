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

      (req as Request & { userId?: string }).userId = decoded.userId as string;
      next();
    });
  }
}

export default new Authentication();
