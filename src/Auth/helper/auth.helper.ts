import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { secretKey } from "../../environment/environment";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class AuthHelper {
  static getTokenFromHeader(req: Request): string | null {
    if (req.headers && req.headers.authorization) {
      return req.headers.authorization.split(" ")[1] || null;
    }
    return null;
  }

  static getUserIdFromHeader(req: Request) {
    if (req.headers && req.headers.authorization) {
      const authorization = req.headers.authorization.split(" ")[1];
      try {
        const decoded: any = jwt.verify(authorization, secretKey);
        return decoded.userId;
      } catch (e) {
        console.error("error");
      }
    }

    console.error("Authorization header missing");
  }

  static async getUserNameForUserId(req: Request): Promise<string | null> {
    const userId = this.getUserIdFromHeader(req);
    
    if (!userId) {
      console.error("Unable to extract userId from header");
      return null;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true }
      });

      return user?.username || null;
    } catch (e) {
      console.error("Error fetching username:", e);
      return null;
    }
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
