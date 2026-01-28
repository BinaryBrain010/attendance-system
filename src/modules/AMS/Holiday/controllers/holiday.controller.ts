import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import HolidayService from "../services/holiday.service";
import { Holiday } from "../types/holiday";

class HolidayController extends BaseController<HolidayService> {
  protected service = new HolidayService();

  async getAllHolidays(req: Request, res: Response) {
    const operation = () => this.service.getAllHolidays();
    await this.handleRequest(operation, res, { successMessage: "Holidays retrieved successfully!" });
  }

  async getHolidays(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getHolidays(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Holidays retrieved successfully!" });
  }

  async getDeletedHolidays(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const operation = () => this.service.getDeletedHolidays(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted holidays retrieved successfully!" });
  }

  async createHoliday(req: Request, res: Response) {
    const holidayData: Holiday & { createdByUserId?: string } = req.body;
    const operation = () => this.service.createHoliday(holidayData);
    await this.handleRequest(operation, res, { 
      successMessage: "Holiday created successfully!",
      logActivity: {
        action: "CREATE",
        entityType: "Holiday",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Holiday created: ${holidayData.name || 'N/A'}`,
        metadata: {
          name: holidayData.name,
          date: holidayData.date
        }
      },
      req
    });
  }

  async updateHoliday(req: Request, res: Response) {
    const { id, ...data } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Holiday ID is required" });
    }
    const operation = () => this.service.updateHoliday(id, data);
    await this.handleRequest(operation, res, { 
      successMessage: "Holiday updated successfully!",
      logActivity: {
        action: "UPDATE",
        entityType: "Holiday",
        entityId: id,
        description: `Holiday updated: ${data.name || 'N/A'}`,
        metadata: {
          changes: data,
          holidayId: id
        }
      },
      req
    });
  }

  async deleteHoliday(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Holiday ID is required" });
    }
    const operation = () => this.service.deleteHoliday(id);
    await this.handleRequest(operation, res, { 
      successMessage: "Holiday deleted successfully!",
      logActivity: {
        action: "DELETE",
        entityType: "Holiday",
        entityId: id,
        description: "Holiday deleted"
      },
      req
    });
  }

  async restoreHoliday(req: Request, res: Response) {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ message: "Holiday ID is required" });
    }
    const operation = () => this.service.restoreHoliday(id);
    await this.handleRequest(operation, res, { 
      successMessage: "Holiday restored successfully!",
      logActivity: {
        action: "RESTORE",
        entityType: "Holiday",
        entityId: id,
        description: "Holiday restored"
      },
      req
    });
  }

  async getHolidayById(req: Request, res: Response) {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "Holiday ID is required" });
    }
    const operation = () => this.service.getHolidayById(id as string);
    await this.handleRequest(operation, res, { successMessage: "Holiday retrieved successfully!" });
  }

  async getTotalHolidays(req: Request, res: Response) {
    const operation = () => this.service.getTotalHolidays();
    await this.handleRequest(operation, res, { successMessage: "Total holidays count retrieved successfully!" });
  }

  async searchHolidays(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }
    const pageNum = page || 1;
    const pageSizeNum = pageSize || 10;
    const operation = () => this.service.searchHolidays(searchTerm, pageNum, pageSizeNum);
    await this.handleRequest(operation, res, { successMessage: "Holidays search completed successfully!" });
  }

  async markSundaysForYear(req: Request, res: Response) {
    const { year, createdByUserId } = req.body;
    if (!year) {
      return res.status(400).json({ message: "Year is required" });
    }
    const operation = () => this.service.markSundaysForYear(year, createdByUserId);
    await this.handleRequest(operation, res, { 
      successMessage: "Sundays marked as holidays successfully!",
      logActivity: {
        action: "BULK_CREATE",
        entityType: "Holiday",
        description: `Sundays marked as holidays for year ${year}`,
        metadata: {
          year,
          action: "markSundays"
        }
      },
      req
    });
  }

  async getHistoryById(req: Request, res: Response) {
    const { id, filter, date } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: "Holiday ID is required" });
    }

    const filterBool = filter === true || filter === "true";
    
    const operation = () => this.service.getHistoryById(id, filterBool, date);
    await this.handleRequest(operation, res, { successMessage: "Holiday history retrieved successfully!" });
  }
}

export default HolidayController;
