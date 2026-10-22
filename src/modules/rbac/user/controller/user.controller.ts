import { Request, Response } from "express";
import { z } from "zod";
import BaseController from "../../../../core/controllers/base.controller";
import { User, UserData } from "../types/user";
import UserService from "../service/user.service";
import BlackListedTokenService from "../../Token/service/token.service";
import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import AuthHelper from "../../../../Auth/helper/auth.helper";
import prisma from "../../../../core/models/base.model";
import { LoggedInTokens } from "../../Token/types/token";
import accessModel from "../../Access/models/access.model";
import { secretKey } from "../../../../environment/environment";
import AccessService from "../../Access/service/access.service";
import EmployeeService from "../../../AMS/Employee/services/employee.service";
import { logEvent } from "../../../../core/audit/event";
import ImpersonationService from "../service/impersonation.service";
import { AppError } from "../../../../core/errors/app.error";
class UserController extends BaseController<UserService> {
  protected service = new UserService();
  protected tokenService = new BlackListedTokenService();
  protected accessService = new AccessService();
  protected employeeService = new EmployeeService();
  protected impersonationService = new ImpersonationService();

  /** POST /user/impersonate {userId, reason} — admin "login as user". Gated user.impersonate.*. */
  async impersonate(req: Request, res: Response) {
    const callerId = AuthHelper.getUserIdFromHeader(req);
    const { userId, reason } = req.body || {};
    const r = req as Request & { impersonatorId?: string | null };
    const meta = {
      ip: req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null,
      userAgent: (req.headers["user-agent"] as string) || null,
      alreadyImpersonating: !!r.impersonatorId, // cannot nest impersonation
    };
    const operation = () => this.impersonationService.start(callerId || "", userId, reason, meta);
    await this.handleRequest(operation, res, { successMessage: "Impersonation started" });
  }

  /** POST /user/impersonate/exit — end the current impersonation (token carries the session id). */
  async exitImpersonation(req: Request, res: Response) {
    const r = req as Request & { impersonationId?: string | null };
    const impersonationId = r.impersonationId || "";
    const meta = {
      ip: req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null,
      userAgent: (req.headers["user-agent"] as string) || null,
    };
    const operation = () => {
      if (!impersonationId) throw new AppError(400, "You are not impersonating anyone.");
      return this.impersonationService.end(impersonationId, meta);
    };
    await this.handleRequest(operation, res, { successMessage: "Impersonation ended" });
  }

  async getUsers(req: Request, res: Response) {
    let operation = () => this.service.getUsers();
    await this.handleRequest(operation, res, { successMessage: "Users retrieved successfully!" });
  }

  async getNonAssociatedUsers(req: Request, res: Response) {
    let operation = () => this.service.getNonAssociatedUsers();
    await this.handleRequest(operation, res, { successMessage: "User retrieved successfully!" });
  }

  async getAllUsers(req: Request, res: Response) {
    const id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { page, pageSize } = req.body;
      let operation = () => this.service.getAllUsers(page, pageSize, id);
      await this.handleRequest(operation, res, { successMessage: "Users retrieved successfully!" });
    }
  }

  async getAllUsersWithFilters(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const filter = req.query.filter as string;
    const search = req.query.search as string;

    const operation = async () => {
      return await this.service.getUsersWithPagination(
        page,
        pageSize,
        sortBy,
        sortOrder,
        filter,
        search
      );
    };

    await this.handleRequest(operation, res, { successMessage: "Users retrieved successfully!" });
  }

  async totalUsers(req: Request, res: Response) {
    const id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let operation = () => this.service.totalUsers(id);
      let successMessage = "Users retrieved successfully!";
      let errorMessage = "Error retrieving users:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async getUserById(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getById(id);
    let successMessage = "Users retrieved successfully!";
    let errorMessage = "Error retrieving users:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLoggedInUser(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.getLoggedInUser(userId);
    let successMessage = "Users retrieved successfully!";
    let errorMessage = "Error retrieving users:";
    await this.handleRequest(operation, res, { successMessage });
  }

  // 8d: "Me" app profile (own)
  async getMyProfile(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    await this.handleRequest(() => this.service.getProfile(userId), res, { successMessage: "Profile retrieved successfully!" });
  }

  // 8d/8e: own preferences
  async getMyPreferences(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    await this.handleRequest(() => this.service.getPreferences(userId), res, { successMessage: "Preferences retrieved successfully!" });
  }
  async saveMyPreferences(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    const patch = req.body?.preferences ?? req.body ?? {};
    await this.handleRequest(() => this.service.setPreferences(userId, patch), res, { successMessage: "Preferences saved!" });
  }

  async checkPreviousPassword(req: Request, res: Response) {
    let { password } = req.body;
    const userId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.checkPreviousPassword(userId, password);
    let successMessage = "checked successfully!";
    let errorMessage = "Error checking users:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async changePassword(req: Request, res: Response) {
    let { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", statusCode: 400 });
    }
    const userId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.changePassword(userId, password);
    let successMessage = "password chnaged successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "User",
        entityId: userId,
        description: "User password changed",
        metadata: {
          userId,
          action: "changePassword"
        }
      },
      req
    });
  }

  async changeUserPassword(req: Request, res: Response) {
    let { userId, password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", statusCode: 400 });
    }
    const currentUserId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.changePassword(userId, password);
    await this.service.removeLoggedInUser(userId, "");
    let successMessage = "password changed successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "User",
        entityId: userId,
        description: "User password changed by admin",
        metadata: {
          userId,
          changedBy: currentUserId,
          action: "changeUserPassword"
        }
      },
      req
    });
  }

  async logoutOfAllDevices(req: Request, res: Response) {
    // Blocked during impersonation so an impersonator can't nuke the target's (or their own) sessions.
    if (AuthHelper.getImpersonatorIdFromHeader(req)) {
      return res.status(403).json({ success: false, message: "This action is not allowed while you are logged in as another user. Exit first.", statusCode: 403 });
    }
    const userId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.removeLoggedInUser(userId, "");
    let successMessage = "logged out of all devices successfully!";
    let errorMessage = "Error logging out of all devices ";
    await this.handleRequest(operation, res, { successMessage });
  }

  async logoutUserOfAllDevices(req: Request, res: Response) {
    if (AuthHelper.getImpersonatorIdFromHeader(req)) {
      return res.status(403).json({ success: false, message: "This action is not allowed while you are logged in as another user. Exit first.", statusCode: 403 });
    }
    const { id } = req.body;
    let operation = () => this.service.removeLoggedInUser(id, "");
    let successMessage = "logged out of all devices successfully!";
    let errorMessage = "Error logging of all devices ";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDetailedUser(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getDetailed(id);
    let successMessage = "Users retrieved successfully!";
    let errorMessage = "Error retrieving users:";
    await this.handleRequest(operation, res, { successMessage });
  }

  //   async changeCompany(req: Request, res: Response) {
  //     let { userId, companyId } = req.body;
  //     let operation = () => this.service.changeCompany(userId, companyId);
  //     let successMessage = "changed compnany successfully!";
  //     let errorMessage = "Error changing company:";
  //     await this.handleRequest(operation, res, { successMessage });
  //   }

  async createUser(req: Request, res: Response) {
    let userData: UserData = req.body;
    let operation = () => this.service.createUsers(userData);
    let successMessage = "User created successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "User",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `User created: ${userData.username || 'N/A'}`,
        metadata: {
          username: userData.username,
          employeeId: userData.employeeId
        }
      },
      req
    });
  }

  async updateUser(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateUsers(id, data);
    let successMessage = "User updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "User",
        entityId: id,
        description: `User updated: ${data?.username || 'N/A'}`,
        metadata: {
          changes: data,
          userId: id
        }
      },
      req
    });
  }

  /** Link or unlink a login to an employee. Body: { userId, employeeId | null }. */
  async linkEmployee(req: Request, res: Response) {
    const { userId, employeeId } = req.body;
    const operation = () => this.service.linkEmployee(userId, employeeId ?? null);
    await this.handleRequest(operation, res, {
      successMessage: employeeId ? "Employee linked to login" : "Employee unlinked from login",
      logActivity: { action: "UPDATE", entityType: "User", entityId: userId, description: employeeId ? `Linked employee ${employeeId}` : "Unlinked employee", metadata: { employeeId: employeeId ?? null } },
      req,
    });
  }

  /** Employees with no linked login (for the user form's "Linked employee" picker). Body: { includeId? }. */
  async unlinkedEmployees(req: Request, res: Response) {
    const includeId = req.body?.includeId ?? null;
    const operation = () => this.service.unlinkedEmployees(includeId);
    await this.handleRequest(operation, res, { successMessage: "Unlinked employees retrieved" });
  }

  async deleteUser(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteUser(id);
    let successMessage = "User deleted successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "User",
        entityId: id,
        description: "User deleted"
      },
      req
    });
  }

  async searchUsers(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { searchTerm, page, pageSize } = req.body;
      let operation = () =>
        this.service.searchUsers(searchTerm, page, pageSize);
      let successMessage = "Search results retrieved successfully!";
      let errorMessage = "Error retrieving search results:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async restoreUser(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreUser(id);
    let successMessage = "User restored successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "User",
        entityId: id,
        description: "User restored"
      },
      req
    });
  }

  async suspendUser(req: Request, res: Response) {
    const { id } = req.body;
    const actor = (req as any).userId || null;
    await this.handleRequest(() => this.service.suspendUser(id, actor), res, {
      successMessage: "User suspended. Their sessions have been revoked.",
      logActivity: { action: "SUSPEND", entityType: "User", entityId: id, description: "User suspended" }, req,
    });
  }

  async reactivateUser(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.reactivateUser(id), res, {
      successMessage: "User reactivated.",
      logActivity: { action: "REACTIVATE", entityType: "User", entityId: id, description: "User reactivated" }, req,
    });
  }

  async loginUser(req: Request, res: Response) {
    // Validate the body so a malformed payload returns 400 instead of throwing deeper.
    const loginSchema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      platform: z.string().min(1),
      rememberMe: z.boolean().optional(),
    });
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login request", errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    }
    const { username, password, platform } = parsed.data;
    // Default rememberMe so loggedInUsers.create (rememberMe is required, no default) never fails.
    const rememberMe: boolean = parsed.data.rememberMe ?? false;
    // Security: Never log passwords or sensitive data
    // Using logger instead of console.log

    // Audit context for login events (login runs before the context middleware, so pass explicitly).
    const _ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
    const _ua = (req.headers["user-agent"] as string) || null;
    const loginFailed = (userId: string | null, reason: string) =>
      logEvent({ module: "Auth", entity: "User", entityId: userId, action: "LOGIN_FAILED", changes: { username, reason }, userId, ip: _ip, userAgent: _ua, platform });

    let user: User | null = await this.service.getUserByUsername(username);
    const roleIds: string[] = await accessModel.role.getRoleIds(user?.id || "");
    // const isAdmin = roleIds.includes("2d9c89e7-466d-4b1c-b1b3-3ef5be815ed4");

    // Security: Use async password comparison to prevent timing attacks
    if (!user) {
      await loginFailed(null, "unknown username");
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await loginFailed(user.id || null, "bad password");
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Phase 3b: a suspended account cannot log in (block quietly, audited).
    if ((user as any).suspendedAt) {
      await loginFailed(user.id || null, "suspended");
      return res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
    }

    // Use "180d" for 6 months (ms package has no "months" - "6M" was parsed as 6 minutes!)
    const expiresIn = rememberMe ? "180d" : "24h";
    let employee: any = null;
    let isAllowded: boolean = false;

    if (platform == "Mobile") {
      isAllowded = await this.accessService.checkPermission(
        user?.id || "",
        "login.app.*"
      );
    } else if (platform == "Admin") {
      isAllowded = await this.accessService.checkPermission(
        user?.id || "",
        "login.admin.*"
      );
    } else if (platform == "Attendance App") {
      isAllowded = await this.accessService.checkPermission(
        user?.id || "",
        "login.quickmark.*"
      );
      if (user.id) {
        employee = await this.employeeService.getEmployeeByUserId(user.id);
      }
    }else if(platform == "quick-solutions"){
      isAllowded = await this.accessService.checkPermission(
        user?.id || "",
        "login.quickmark.*"
      );
      if (isAllowded) {

  
  
        // return res.json({ url });
      } else {
        return res
          .status(401)
          .json({ message: "You don't have permission to login ! contact ERP" });
      }
    }

    if (isAllowded) {
      // Get unit IDs for the user's employee
      let unitIds: string[] = [];
      if (user.employeeId) {
        try {
          const unitEmployeeModel = (await import("../../../AMS/Unit/models/unitEmployee.model")).default;
          
          // Get units where employee is assigned (via UnitEmployee)
          const unitEmployees = await (unitEmployeeModel as any).unitEmployee.getUnitsByEmployeeId(user.employeeId);
          const unitIdsFromAssignments = unitEmployees ? unitEmployees.map((ue: any) => ue.unitId) : [];
          
          // Get units where employee is the attendance manager (via attendanceManagerId)
          const managedUnits = await prisma.unit.findMany({
            where: {
              attendanceManagerId: user.employeeId,
              isDeleted: null,
            },
            select: {
              id: true,
            },
          });
          const unitIdsFromManagement = managedUnits.map((unit: any) => unit.id);
          
          // Combine unit IDs from both sources (remove duplicates)
          unitIds = [...new Set([...unitIdsFromAssignments, ...unitIdsFromManagement])];
        } catch (error) {
          console.error("Error fetching unit IDs during login:", error);
          // Continue with empty unitIds array if there's an error
        }
      }

      // Include unitIds in token payload. A random jti makes every issued token unique so two
      // logins in the same second cannot collide on the loggedInUsers.token unique constraint.
      let token: string | null = jwt.sign(
        { userId: user.id, unitIds, jti: randomUUID() },
        secretKey,
        { expiresIn }
      );

      // if (user.defaultCompanyId) {
      //   token = jwt.sign(
      //     { userId: user.id, companyId: user.defaultCompanyId },
      //     "your_secret_key",
      //     {
      //       expiresIn,
      //     }
      //   );
      // } else if (user.id === "58c55d6a-910c-46f8-a422-4604bea6cd15" || isAdmin) {
      //   token = jwt.sign(
      //     { userId: user.id, companyId: "a9f53d14-7177-45ef-bf74-f4b8d1a6ce0e" },
      //     "your_secret_key",
      //     {
      //       expiresIn,
      //     }
      //   );
      // } else {
      //   token = null;
      // }

      const data: LoggedInTokens = {
        userId: user.id || "",
        token: token,
        rememberMe: rememberMe,
      };

      if (token != null) {
        // Never let a failure to record the session crash the login. The JWT is already valid;
        // the loggedInUsers row is only for logout/blacklist tracking.
        try {
          await prisma.loggedInUsers.gpCreate(data);
        } catch (sessionErr: any) {
          console.error(
            "loggedInUsers.gpCreate failed during login (continuing):",
            sessionErr?.code || sessionErr?.message || sessionErr
          );
        }
      }

      // Audit: successful login (covers both the employee/Attendance and Admin return paths below).
      await logEvent({ module: "Auth", entity: "User", entityId: user.id || null, action: "LOGIN", changes: { username: user.username, platform }, userId: user.id || null, ip: _ip, userAgent: _ua, platform });

      // Get allowed permissions for the user
      let permissions: string[] = [];
      try {
        const userPermissions = await this.accessService.getAllowedFeaturesForUser(user.id || "");
        permissions = Array.isArray(userPermissions) ? userPermissions : [];
      } catch (error) {
        console.error("Error fetching user permissions during login:", error);
        // Continue with empty permissions array if there's an error
        permissions = [];
      }

      // Session info for client to show "Session expires at..."
      const decoded = jwt.decode(token as string) as { exp?: number } | null;
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

      // Always include permissions array and unitIds in response
      if (employee) {
        return res.json({ token, employee, permissions, unitIds, expiresIn, expiresAt });
      }

      // Log login activity
      try {
        const { logActivityFromRequest } = await import('../../../ActivityLog/helper/activityLog.helper');
        await logActivityFromRequest(
          req,
          "LOGIN",
          "User",
          user.id || undefined,
          `User logged in: ${user.username} (${platform || 'Unknown'})`,
          {
            userId: user.id,
            username: user.username,
            platform,
            rememberMe,
            unitIds
          }
        );
      } catch (logError) {
        console.error("Error logging login activity:", logError);
      }

      return res.json({ token, permissions, unitIds, expiresIn, expiresAt });
    } else {
      return res
        .status(401)
        .json({ message: "You don't have permission to login ! contact ERP" });
    }
  }

  async logoutUser(req: Request, res: Response) {
    const token = AuthHelper.getTokenFromHeader(req);
    console.log("token:", token);
    if (token) {
      const userId = AuthHelper.getUserIdFromHeader(req);
      console.log("user id :", userId);
      if (userId && token) {
        await this.service.removeLoggedInUser(userId, token);

        await logEvent({ module: "Auth", entity: "User", entityId: userId, action: "LOGOUT", userId });

        // Log logout activity
        try {
          const { logActivityFromRequest } = await import('../../../ActivityLog/helper/activityLog.helper');
          await logActivityFromRequest(
            req,
            "LOGOUT",
            "User",
            userId,
            "User logged out",
            {
              userId,
              action: "logout"
            }
          );
        } catch (logError) {
          console.error("Error logging logout activity:", logError);
        }
      }

      res.json({ message: "User logged out successfully" });
    } else {
      res.status(400).json({ message: "Token not provided" });
    }
  }
}

export default UserController;
