import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { secretKey } from "../../environment/environment";

class AuthHelper {
  static getTokenFromHeader(req: Request): string | null {
    if (req.headers && req.headers.authorization) {
      return req.headers.authorization.split(" ")[1] || null;
    }
    return null;
  }

  static getUserIdFromHeader(req: Request) {
    // Soft identity lookup: returns the userId when a valid token is present, else null. The actual
    // 401 enforcement is the auth middleware — a missing/invalid token here is normal (e.g. the login
    // route itself), so it must NOT be logged at error level (it was flooding the pm2 error log).
    if (req.headers && req.headers.authorization) {
      const authorization = req.headers.authorization.split(" ")[1];
      try {
        const decoded: any = jwt.verify(authorization, secretKey);
        return decoded.userId;
      } catch (e) {
        /* invalid/expired token — caller handles the unauthenticated case */
      }
    }
    return null;
  }

  /** The impersonatorId claim, if this request is an impersonation token; null otherwise. Used on the
   *  un-authenticated /auth group (logout-of-all) to block those actions during impersonation. */
  static getImpersonatorIdFromHeader(req: Request): string | null {
    if (req.headers && req.headers.authorization) {
      const authorization = req.headers.authorization.split(" ")[1];
      try {
        const decoded: any = jwt.verify(authorization, secretKey);
        return decoded?.impersonatorId || null;
      } catch (e) {
        /* invalid token — treat as not impersonating */
      }
    }
    return null;
  }

//   static getCompanyIdFromHeader(req: Request): string {
//     if (req.headers && req.headers.authorization) {
//       const authorization = req.headers.authorization.split(" ")[1];
//       try {
//         const decoded: any = jwt.verify(authorization, "your_secret_key");
//         return decoded.companyId;
//       } catch (e) {
//         console.error("error");
//       }
//     }
//     throw new Error("Authorization header missing");
//   }
}

export default AuthHelper;
