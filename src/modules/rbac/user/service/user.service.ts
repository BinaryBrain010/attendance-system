import userModel from "../models/user.model";
import { paginatedData } from "../../../../types/paginatedData";
import { User } from "../types/user";
import { UserData } from "../types/user";
import prisma from "../../../../core/models/base.model";
import { AppError, NotFoundError } from "../../../../core/errors/app.error";
class UserService {
  /**
   * Link (or unlink with employeeId=null) a login to an employee. User.employeeId is unique, so an
   * employee can back at most one login; a friendly 409 is raised if the employee is already taken.
   */
  async linkEmployee(userId: string, employeeId: string | null): Promise<UserData | null> {
    if (!userId) throw new AppError(400, "userId is required");
    if (employeeId) {
      const emp = await prisma.employee.findFirst({ where: { id: employeeId, isDeleted: null }, select: { id: true } });
      if (!emp) throw new NotFoundError("Employee");
      const taken = await prisma.user.findFirst({ where: { employeeId, id: { not: userId }, isDeleted: null }, select: { id: true, username: true } });
      if (taken) throw new AppError(409, `That employee is already linked to the login "${taken.username}". Unlink it first.`);
    }
    // employeeId may be null (unlink); the column is nullable. Cast past the stricter UserData type.
    return await userModel.user.gpUpdate(userId, { employeeId } as any);
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
