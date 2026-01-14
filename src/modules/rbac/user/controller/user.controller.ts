import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import { User, UserData } from "../types/user";
import UserService from "../service/user.service";
import BlackListedTokenService from "../../Token/service/token.service";
import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";
import AuthHelper from "../../../../Auth/helper/auth.helper";
import prisma from "../../../../core/models/base.model";
import { LoggedInTokens } from "../../Token/types/token";
import accessModel from "../../Access/models/access.model";
import { secretKey } from "../../../../environment/environment";
import AccessService from "../../Access/service/access.service";
import EmployeeService from "../../../AMS/Employee/services/employee.service";
class UserController extends BaseController<UserService> {
  protected service = new UserService();
  protected tokenService = new BlackListedTokenService();
  protected accessService = new AccessService();
  protected employeeService = new EmployeeService();

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
    const userId = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.removeLoggedInUser(userId, "");
    let successMessage = "logged out of all devices successfully!";
    let errorMessage = "Error logging out of all devices ";
    await this.handleRequest(operation, res, { successMessage });
  }

  async logoutUserOfAllDevices(req: Request, res: Response) {
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
        description: `User updated: ${data.username || 'N/A'}`,
        metadata: {
          changes: data,
          userId: id
        }
      },
      req
    });
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

  async loginUser(req: Request, res: Response) {
    let { username, password, rememberMe, platform } = req.body;
    // Security: Never log passwords or sensitive data
    // Using logger instead of console.log
    
    let user: User | null = await this.service.getUserByUsername(username);
    const roleIds: string[] = await accessModel.role.getRoleIds(user?.id || "");
    // const isAdmin = roleIds.includes("2d9c89e7-466d-4b1c-b1b3-3ef5be815ed4");
    
    // Security: Use async password comparison to prevent timing attacks
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const expiresIn = rememberMe ? "6M" : "24h";
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
          const unitEmployeeModel = (await import("../../AMS/Unit/models/unitEmployee.model")).default;
          
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

      // Include unitIds in token payload
      let token: string | null = jwt.sign({ userId: user.id, unitIds }, secretKey, {
        expiresIn,
      });

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
        await prisma.loggedInUsers.gpCreate(data);
      }

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

      // Always include permissions array and unitIds in response
      if (employee) {
        return res.json({ token, employee, permissions, unitIds });
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

      return res.json({ token, permissions, unitIds });
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
