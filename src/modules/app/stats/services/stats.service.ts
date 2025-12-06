import prisma from "../../../../core/models/base.model";
import { Status } from "../../../../enums/schema";
import gatePassModel from "../../gatePass/models/gatePass.model";
import customerModel from "../../customer/models/cutomer.model";
import ItemModel from "../../item/models/item.model";
import { Prisma } from "@prisma/client";

class StatsService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats() {
    try {
      const [
        totalGatePasses,
        pendingGatePasses,
        approvedGatePasses,
        cancelledGatePasses,
        totalCustomers,
        totalItems,
        outOfStockItems,
        recentGatePasses,
      ] = await Promise.all([
        prisma.gatePass.count({ where: { isDeleted: null } }),
        prisma.gatePass.count({
          where: { status: Status.PENDING, isDeleted: null },
        }),
        prisma.gatePass.count({
          where: { status: Status.APPROVED, isDeleted: null },
        }),
        prisma.gatePass.count({
          where: { status: Status.CANCELLED, isDeleted: null },
        }),
        prisma.customer.count({ where: { isDeleted: null } }),
        prisma.item.count({ where: { isDeleted: null } }),
        prisma.item.count({
          where: { quantity: { lte: 0 }, isDeleted: null },
        }),
        prisma.gatePass.findMany({
          where: { isDeleted: null },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            customer: {
              select: { name: true },
            },
          },
        }),
      ]);

      return {
        gatePasses: {
          total: totalGatePasses,
          pending: pendingGatePasses,
          approved: approvedGatePasses,
          cancelled: cancelledGatePasses,
        },
        customers: {
          total: totalCustomers,
        },
        items: {
          total: totalItems,
          outOfStock: outOfStockItems,
        },
        recentGatePasses: recentGatePasses.map((gp) => ({
          id: gp.id,
          customerName: gp.customer.name,
          status: gp.status,
          issuedAt: gp.issuedAt,
          createdAt: gp.createdAt,
        })),
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }

  /**
   * Get gate pass statistics
   */
  async getGatePassStats() {
    try {
      const [
        total,
        byStatus,
        todayCount,
        thisWeekCount,
        thisMonthCount,
        monthlyReport,
      ] = await Promise.all([
        prisma.gatePass.count({ where: { isDeleted: null } }),
        prisma.gatePass.groupBy({
          by: ["status"],
          where: { isDeleted: null },
          _count: { status: true },
        }),
        this.getGatePassesByDateRange(new Date(), new Date()),
        this.getGatePassesByDateRange(this.getStartOfWeek(), new Date()),
        this.getGatePassesByDateRange(this.getStartOfMonth(), new Date()),
        gatePassModel.gatePass.getGatePassesReport(),
      ]);

      const statusBreakdown = byStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        total,
        byStatus: {
          pending: statusBreakdown[Status.PENDING] || 0,
          approved: statusBreakdown[Status.APPROVED] || 0,
          cancelled: statusBreakdown[Status.CANCELLED] || 0,
        },
        byPeriod: {
          today: todayCount,
          thisWeek: thisWeekCount,
          thisMonth: thisMonthCount,
        },
        monthlyReport,
      };
    } catch (error) {
      console.error("Error getting gate pass stats:", error);
      throw error;
    }
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats() {
    try {
      const [total, topCustomers, customersWithGatePasses] = await Promise.all([
        prisma.customer.count({ where: { isDeleted: null } }),
        customerModel.customer.getCustomersWithMostGatePasses(),
        prisma.customer.count({
          where: {
            isDeleted: null,
            gatePasses: {
              some: {
                isDeleted: null,
              },
            },
          },
        }),
      ]);

      return {
        total,
        active: customersWithGatePasses,
        topCustomers: topCustomers.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          gatePassCount: customer._count.gatePasses,
        })),
      };
    } catch (error) {
      console.error("Error getting customer stats:", error);
      throw error;
    }
  }

  /**
   * Get item statistics
   */
  async getItemStats() {
    try {
      const [
        total,
        outOfStock,
        lowStock,
        itemsWithGatePasses,
        mostUsedItems,
      ] = await Promise.all([
        prisma.item.count({ where: { isDeleted: null } }),
        prisma.item.count({
          where: { quantity: { lte: 0 }, isDeleted: null },
        }),
        prisma.item.count({
          where: {
            quantity: { lte: 10, gt: 0 },
            isDeleted: null,
          },
        }),
        prisma.item.count({
          where: {
            isDeleted: null,
            gatePasses: {
              some: {
                isDeleted: null,
              },
            },
          },
        }),
        this.getMostUsedItems(),
      ]);

      return {
        total,
        outOfStock,
        lowStock,
        inUse: itemsWithGatePasses,
        mostUsedItems,
      };
    } catch (error) {
      console.error("Error getting item stats:", error);
      throw error;
    }
  }

  /**
   * Get statistics by date range
   */
  async getStatsByDateRange(from: Date, to: Date) {
    try {
      const [gatePasses, customers, items] = await Promise.all([
        prisma.gatePass.count({
          where: {
            createdAt: {
              gte: from,
              lte: to,
            },
            isDeleted: null,
          },
        }),
        prisma.customer.count({
          where: {
            createdAt: {
              gte: from,
              lte: to,
            },
            isDeleted: null,
          },
        }),
        prisma.item.count({
          where: {
            createdAt: {
              gte: from,
              lte: to,
            },
            isDeleted: null,
          },
        }),
      ]);

      return {
        gatePasses,
        customers,
        items,
        dateRange: {
          from,
          to,
        },
      };
    } catch (error) {
      console.error("Error getting stats by date range:", error);
      throw error;
    }
  }

  /**
   * Get widget data for dashboard
   */
  async getWidgetData() {
    try {
      const [
        dashboardStats,
        gatePassStats,
        customerStats,
        itemStats,
      ] = await Promise.all([
        this.getDashboardStats(),
        this.getGatePassStats(),
        this.getCustomerStats(),
        this.getItemStats(),
      ]);

      return {
        overview: dashboardStats,
        gatePasses: gatePassStats,
        customers: customerStats,
        items: itemStats,
      };
    } catch (error) {
      console.error("Error getting widget data:", error);
      throw error;
    }
  }

  // Helper methods
  private async getGatePassesByDateRange(from: Date, to: Date): Promise<number> {
    return await prisma.gatePass.count({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
        isDeleted: null,
      },
    });
  }

  private getStartOfWeek(): Date {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }

  private getStartOfMonth(): Date {
    const date = new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    return startOfMonth;
  }

  private async getMostUsedItems(limit: number = 10) {
    try {
      const result = await prisma.$queryRaw<Array<{
        itemId: string;
        itemName: string;
        totalQuantity: bigint;
        gatePassCount: bigint;
      }>>(
        Prisma.sql`
          SELECT 
            i.id AS "itemId",
            i.name AS "itemName",
            SUM(gpi.quantity) AS "totalQuantity",
            COUNT(DISTINCT gpi."gatePassId") AS "gatePassCount"
          FROM "Item" i
          INNER JOIN "GatePassItem" gpi ON i.id = gpi."itemId"
          INNER JOIN "GatePass" gp ON gpi."gatePassId" = gp.id
          WHERE i."isDeleted" IS NULL
            AND gp."isDeleted" IS NULL
          GROUP BY i.id, i.name
          ORDER BY "totalQuantity" DESC
          LIMIT ${limit}
        `
      );

      return result.map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        totalQuantity: Number(item.totalQuantity),
        gatePassCount: Number(item.gatePassCount),
      }));
    } catch (error) {
      console.error("Error getting most used items:", error);
      return [];
    }
  }
}

export default StatsService;

