import groupModel from "../models/group.model";
import { Group } from "../types/group";
import { paginatedData } from "../../../../types/paginatedData";
import { createGroup } from "../types/group";

class GroupService {
  async getAllGroups(): Promise<Group[]> {
    return await groupModel.group.gpFindMany();
  }

  async getGroups(
    page: number,
    pageSize: number,
    userId: string
  ): Promise<paginatedData> {
    return await groupModel.group.gpPgFindMany(page, pageSize);
  }

  async getGroupsWithPagination(
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
    filter?: string,
    search?: string
  ): Promise<paginatedData> {
    return await groupModel.group.gpPgFindManyWithSortAndFilter(
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      search
    );
  }

  async createGroup(groupData: createGroup): Promise<Group | Group[]> {
    return await groupModel.group.gpCreate(groupData);
  }

  async updateGroup(
    groupId: string,
    groupData: createGroup
  ): Promise<Group | null> {
    return await groupModel.group.gpUpdate(groupId, groupData);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await groupModel.group.gpSoftDelete(groupId);
  }

  async restoreGroup(groupId: string): Promise<void> {
    await groupModel.group.gpRestore(groupId);
  }

  async getById(groupId: string): Promise<Group[]> {
    return await groupModel.group.gpFindById(groupId);
  }

  async getByName(name: string) {
    return await groupModel.group.gpGetByName(name);
  }

  async totalGroups(): Promise<number> {
    return await groupModel.group.gpCount();
  }

  async getDetailedGroupById(id: string) {
    return await groupModel.group.getGroupByGroupId(id);
  }

  async searchGroups(
    searchTerm: string | string[],
    page: number,
    pageSize: number,
  ): Promise<paginatedData> {
    const columns: string[] = ["name"];
    return await groupModel.group.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize,
      )  }
}

export default GroupService;
