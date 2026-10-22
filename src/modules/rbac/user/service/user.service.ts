import userModel from "../models/user.model";
import { paginatedData } from "../../../../types/paginatedData";
import { User } from "../types/user";
import { UserData } from "../types/user";
import prisma from "../../../../core/models/base.model";
import { AppError, NotFoundError } from "../../../../core/errors/app.error";
class UserService {
  /**
   * Link (or unlink with employeeId=null) a login to an employee, AND keep SalesAgent.userId in sync in
   * the SAME transaction: the agent of the linked employee gets this login's userId (cleared on unlink).
   * User.employeeId and SalesAgent.userId are both unique, so a login backs at most one employee and an
   * agent is tied to at most one login; a friendly 409 is raised if the employee, or that employee's
   * agent, is already tied to another login.
   */
  async linkEmployee(userId: string, employeeId: string | null): Promise<UserData | null> {
    if (!userId) throw new AppError(400, "userId is required");
    return await prisma.$transaction(async (tx: any) => {
      let targetAgent: { id: string; agentCode: string; userId: string | null } | null = null;
      if (employeeId) {
        const emp = await tx.employee.findFirst({ where: { id: employeeId, isDeleted: null }, select: { id: true } });
        if (!emp) throw new NotFoundError("Employee");
        const taken = await tx.user.findFirst({ where: { employeeId, id: { not: userId }, isDeleted: null }, select: { username: true } });
        if (taken) throw new AppError(409, `That employee is already linked to the login "${taken.username}". Unlink it first.`);
        // The agent (if any) for this employee must not already be tied to a different login.
        targetAgent = await tx.salesAgent.findFirst({ where: { employeeId, isDeleted: null }, select: { id: true, agentCode: true, userId: true } });
        if (targetAgent && targetAgent.userId && targetAgent.userId !== userId) {
          throw new AppError(409, `That employee's agent (${targetAgent.agentCode}) is already tied to another login. Unlink that login first.`);
        }
      }
      // Set / clear the user's employee link.
      const updated = await tx.user.update({ where: { id: userId }, data: { employeeId } });
      // Keep SalesAgent.userId consistent: clear this login from any agent it was on (except the new
      // target, to respect the unique userId), then attach it to the target agent. On unlink there is no
      // target, so this just clears the login off its old agent.
      await tx.salesAgent.updateMany({ where: { userId, isDeleted: null, ...(targetAgent ? { id: { not: targetAgent.id } } : {}) }, data: { userId: null } });
      if (targetAgent) await tx.salesAgent.update({ where: { id: targetAgent.id }, data: { userId } });
      return updated as any;
    });
  }

  /** Employees with no linked login (for the "Linked employee" picker). `includeId` keeps the one the
   *  login being edited is already linked to, so the current value stays selectable. */
  async unlinkedEmployees(includeId?: string | null) {
    const or: any[] = [{ user: { is: null } }];
    if (includeId) or.push({ id: includeId });
    return await prisma.employee.findMany({
      where: { isDeleted: null, OR: or },
      select: { id: true, name: true, surname: true, code: true, designation: true, department: true },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    });
  }

  async getUsers(): Promise<User[]> {
    return await userModel.user.gpFindMany();
  }

  
  async getNonAssociatedUsers(){
return await userModel.user.gpNonAssociatedUsers();
  }

  async getAllUsers(
    page: number,
    pageSize: number,
    userId: string
  ): Promise<paginatedData> {
    return await userModel.user.gpPgFindMany(page, pageSize, userId);
  }

  async getUsersWithPagination(
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
    filter?: string,
    search?: string
  ): Promise<paginatedData> {
    return await userModel.user.gpPgFindManyWithSortAndFilter(
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      search
    );
  }

  async createUsers(userData: UserData): Promise<UserData | UserData[]> {
    return await userModel.user.gpCreate(userData);
  }

  async updateUsers(
    userId: string,
    updatedData: UserData
  ): Promise<UserData | null> {
    return await userModel.user.gpUpdate(userId, updatedData);
  }

  async deleteUser(userId: string): Promise<void> {
    return await userModel.user.gpSoftDelete(userId);
  }

  async suspendUser(userId: string, byId: string | null) {
    return await userModel.user.gpSuspend(userId, byId);
  }

  async reactivateUser(userId: string) {
    return await userModel.user.gpReactivate(userId);
  }

  async restoreUser(userId: string): Promise<void> {
    return await userModel.user.gpRestore(userId);
  }

//   async changeCompany(userId: string, companyId: string): Promise<void> {
//     return await userModel.user.changeDefaultCompany(userId, companyId);
//   }

  async getUserByUsername(username: string): Promise<User | null> {
    return await userModel.user.gpFindUnique(username);
  }

  async getById(userId: string): Promise<UserData> {
    return await userModel.user.gpFindById(userId);
  }

  async getDetailed(userId: string): Promise<UserData|null> {
    return await userModel.user.detailedUser(userId);
  }

  async getLoggedInUser(userId: string) {
    return await userModel.user.getLoggedInUser(userId);
  }

  // 8d/8e
  async getProfile(userId: string) {
    return await userModel.user.getProfile(userId);
  }
  async getPreferences(userId: string) {
    return await userModel.user.getPreferences(userId);
  }
  async setPreferences(userId: string, patch: Record<string, any>) {
    return await userModel.user.setPreferences(userId, patch);
  }

  async checkPreviousPassword(userId: string, password: string) {
    return await userModel.user.checkPreviousPassowrd(userId, password);
  }

  async removeLoggedInUser(userId: string, token: string) {
    return await userModel.user.gpRemoveLoggedInUser(userId, token);
  }

  async changePassword(userId: string, password: string) {
    return await userModel.user.changePassowrd(userId, password);
  }

  async totalUsers(userId: string): Promise<number> {
    return await userModel.user.gpCount(userId);
  }

  async searchUsers(
    searchTerm: string | string[],
    page: number,
    pageSize: number,
  ): Promise<paginatedData> {
    const columns: string[] = ["username", "password"];
    return await userModel.user.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize,
    );
  }
}

export default UserService;
