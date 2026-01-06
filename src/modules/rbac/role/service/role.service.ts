import roleModel from "../models/role.model";
import { paginatedData } from "../../../../types/paginatedData";
import { Role ,createRole} from "../types/role";

class RoleService {
  async getAllRoles(): Promise<Role[]> {
    return await roleModel.role.gpFindMany();
  }

  async getRoles(
    page: number,
    pageSize: number,
    userId: string
  ): Promise<paginatedData> {
    return await roleModel.role.gpPgFindMany(page, pageSize);
  }

  async getRolesWithPagination(
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
    filter?: string,
    search?: string
  ): Promise<paginatedData> {
    return await roleModel.role.gpPgFindManyWithSortAndFilter(
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      search
    );
  }

  async createRole(roleData: createRole): Promise<Role | Role[]> {
    return await roleModel.role.gpCreate(roleData);
  }

  async updateRole(roleId: string, roleData: createRole): Promise<Role | null> {
    return await roleModel.role.gpUpdate(roleId, roleData);
  }

  async deleteRole(roleId: string): Promise<void> {
    await roleModel.role.gpSoftDelete(roleId);
  }

  async restoreRole(roleId: string): Promise<void> {
    await roleModel.role.gpRestore(roleId);
  }

  async getByName(name: string) {
    return await roleModel.role.gpGetByName(name);
  }

  async changeRole(id: string, role: string) {
    return await roleModel.role.changeRole(id, role);
  }

  async getById(roleId: string,userId:string): Promise<Role[]> {
    return await roleModel.role.gpFindById(roleId);
  }

  async totalRoles(userId:string): Promise<number> {
    return await roleModel.role.gpCount();
  }

  async getDetailedRoleById(id: string) {
    return await roleModel.role.getRoleByroleId(id);
  }

  async searchRoles(
    searchTerm: string | string[],
    page: number,
    pageSize: number,
    userId: string
  ): Promise<paginatedData> {
    const columns: string[] = ["name"];
    return await roleModel.role.gpSearch(searchTerm, columns, page, pageSize);
  }
}

export default RoleService;
