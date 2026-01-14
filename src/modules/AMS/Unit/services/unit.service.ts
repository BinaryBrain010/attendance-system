import unitModel from "../models/unit.model";
import { Unit } from "../types/unit";
import { paginatedData } from "../../../../types/paginatedData";

class UnitService {
  async getAllUnits(): Promise<Unit[]> {
    return await unitModel.unit.gpFindMany();
  }

  async getUnits(page: number, pageSize: number): Promise<paginatedData> {
    return await unitModel.unit.gpPgFindMany(page, pageSize);
  }

  async getDeletedUnits(page: number, pageSize: number): Promise<paginatedData> {
    return await unitModel.unit.gpPgFindDeletedMany(page, pageSize);
  }

  async createUnit(unitData: Unit | Unit[]): Promise<Unit | Unit[]> {
    if (Array.isArray(unitData)) {
      return await Promise.all(
        unitData.map((unit) => unitModel.unit.gpCreate(unit))
      );
    }
    return await unitModel.unit.gpCreate(unitData);
  }

  async updateUnit(unitId: string, unitData: Unit): Promise<Unit> {
    return await unitModel.unit.gpUpdate(unitId, unitData);
  }

  async deleteUnit(unitId: string): Promise<void> {
    await unitModel.unit.gpSoftDelete(unitId);
  }

  async restoreUnit(unitId: string): Promise<void> {
    await unitModel.unit.gpRestore(unitId);
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    return await unitModel.unit.gpFindById(unitId);
  }

  async getTotalUnits(): Promise<number> {
    return await unitModel.unit.gpCount();
  }

  async searchUnits(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await unitModel.unit.gpSearch(searchTerm, page, pageSize);
  }

  async getHistoryById(unitId: string, filter?: boolean, date?: string): Promise<any> {
    return await unitModel.unit.getHistoryById(unitId, filter, date);
  }
}

export default UnitService;
