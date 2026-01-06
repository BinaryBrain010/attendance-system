import userModel from "../models/user.model";
import { paginatedData } from "../../../../types/paginatedData";
import { User } from "../types/user";
import { UserData } from "../types/user";
class UserService {
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
