import holidayModel from "../models/holiday.model";
import { Holiday } from "../types/holiday";
import { paginatedData } from "../../../../types/paginatedData";

class HolidayService {
  async getAllHolidays(): Promise<Holiday[]> {
    return await holidayModel.holiday.gpFindMany();
  }

  async getHolidays(page: number, pageSize: number): Promise<paginatedData> {
    return await holidayModel.holiday.gpPgFindMany(page, pageSize);
  }

  async getDeletedHolidays(page: number, pageSize: number): Promise<paginatedData> {
    return await holidayModel.holiday.gpPgFindDeletedMany(page, pageSize);
  }

  async createHoliday(holidayData: Holiday | Holiday[]): Promise<Holiday | Holiday[]> {
    if (Array.isArray(holidayData)) {
      return await Promise.all(
        holidayData.map((holiday) => holidayModel.holiday.gpCreate(holiday))
      );
    }
    return await holidayModel.holiday.gpCreate(holidayData);
  }

  async updateHoliday(holidayId: string, holidayData: Holiday): Promise<Holiday> {
    return await holidayModel.holiday.gpUpdate(holidayId, holidayData);
  }

  async deleteHoliday(holidayId: string): Promise<void> {
    await holidayModel.holiday.gpSoftDelete(holidayId);
  }

  async restoreHoliday(holidayId: string): Promise<void> {
    await holidayModel.holiday.gpRestore(holidayId);
  }

  async getHolidayById(holidayId: string): Promise<Holiday | null> {
    return await holidayModel.holiday.gpFindById(holidayId);
  }

  async getTotalHolidays(): Promise<number> {
    return await holidayModel.holiday.gpCount();
  }

  async searchHolidays(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await holidayModel.holiday.gpSearch(searchTerm, page, pageSize);
  }

  async markSundaysForYear(year: number, createdByUserId?: string): Promise<Holiday[]> {
    return await holidayModel.holiday.markSundaysForYear(year, createdByUserId);
  }

  async getHistoryById(holidayId: string, filter?: boolean, date?: string): Promise<any> {
    return await holidayModel.holiday.getHistoryById(holidayId, filter, date);
  }
}

export default HolidayService;
