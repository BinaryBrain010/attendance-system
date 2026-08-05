import { Prisma } from "@prisma/client";
import prisma from "../../../../core/models/base.model";

// Hardcoded admin user id (same convention used across the codebase)
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// Fields exposed to the client for the referred-to employee (host)
const referredToEmployeeSelect = {
  id: true,
  name: true,
  surname: true,
  code: true,
  department: true,
  designation: true,
} as const;

// Helper to resolve a username from a userId for audit display
async function getUpdatedByName(updatedBy: string | null): Promise<string | null> {
  if (!updatedBy) {
    return null;
  }
  if (updatedBy === ADMIN_USER_ID) {
    return "Admin";
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: updatedBy },
      select: { username: true },
    });
    return user?.username || null;
  } catch (error) {
    console.error(`Error fetching username for userId ${updatedBy}:`, error);
    return null;
  }
}

const visitorModel = prisma.$extends({
  model: {
    visitor: {
      async gpFindMany(this: any) {
        return await prisma.visitor.findMany({
          where: { isDeleted: null },
          orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });
      },

      async gpFindById(this: any, id: string) {
        const visitor = (await prisma.visitor.findUnique({
          where: { id, isDeleted: null },
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        })) as any;

        if (visitor) {
          const updatedByName = await getUpdatedByName(visitor.updatedBy || null);
          return { ...visitor, updatedByName };
        }
        return visitor;
      },

      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.visitor.findMany({
            where: { isDeleted: null },
            orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
            skip,
            take: pageSize,
            include: { referredToEmployee: { select: referredToEmployeeSelect } },
          }),
          prisma.visitor.count({ where: { isDeleted: null } }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.visitor.findMany({
            where: { isDeleted: { not: null } },
            orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
            skip,
            take: pageSize,
            include: { referredToEmployee: { select: referredToEmployeeSelect } },
          }),
          prisma.visitor.count({ where: { isDeleted: { not: null } } }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpSearch(
        this: any,
        searchTerm: string | string[],
        page: number,
        pageSize: number
      ) {
        const searchTerms = Array.isArray(searchTerm) ? searchTerm : [searchTerm];
        const searchConditions = searchTerms.map((term) => ({
          OR: [
            { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { cnic: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { company: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { purpose: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { referredToText: { contains: term, mode: Prisma.QueryMode.insensitive } },
            { vehicleNo: { contains: term, mode: Prisma.QueryMode.insensitive } },
          ],
        }));

        const skip = (page - 1) * pageSize;
        const where = { AND: [{ isDeleted: null }, { OR: searchConditions }] };
        const [data, total] = await Promise.all([
          prisma.visitor.findMany({
            where: where as any,
            orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
            skip,
            take: pageSize,
            include: { referredToEmployee: { select: referredToEmployeeSelect } },
          }),
          prisma.visitor.count({ where: where as any }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      async gpCount(this: any): Promise<number> {
        return await prisma.visitor.count({ where: { isDeleted: null } });
      },

      /**
       * Filter visitors by an arbitrary date range and/or outcome.
       * Used for reporting and Excel export.
       */
      async gpFilter(
        this: any,
        opts: { from?: string | Date; to?: string | Date; outcome?: string; purchased?: boolean }
      ) {
        const where: any = { isDeleted: null };

        if (opts.from || opts.to) {
          where.visitDate = {};
          if (opts.from) {
            const from = new Date(opts.from);
            from.setHours(0, 0, 0, 0);
            where.visitDate.gte = from;
          }
          if (opts.to) {
            const to = new Date(opts.to);
            to.setHours(23, 59, 59, 999);
            where.visitDate.lte = to;
          }
        }
        if (opts.outcome) {
          where.outcome = opts.outcome;
        }
        if (typeof opts.purchased === "boolean") {
          where.purchased = opts.purchased;
        }

        return await prisma.visitor.findMany({
          where,
          orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });
      },

      async gpCreate(this: any, visitorData: any) {
        const { createdByUserId, updatedByUserId, id, referredToEmployee, ...rest } =
          visitorData;

        const data = await prisma.visitor.create({
          data: {
            ...rest,
            visitDate: rest.visitDate ? new Date(rest.visitDate) : new Date(),
            timeIn: rest.timeIn ? new Date(rest.timeIn) : null,
            timeOut: rest.timeOut ? new Date(rest.timeOut) : null,
            createdBy: createdByUserId || null,
            createdAt: new Date(),
          },
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });

        return data;
      },

      async gpUpdate(this: any, updateId: string, data: any) {
        const { updatedByUserId, createdByUserId, id, referredToEmployee, ...rest } = data;

        const current = (await prisma.visitor.findUnique({
          where: { id: updateId },
        })) as any;

        if (!current) {
          throw new Error(`Visitor with ID ${updateId} not found.`);
        }

        // Snapshot the previous state for the audit trail (keep last 3)
        const previousUpdate = {
          data: {
            name: current.name,
            phone: current.phone,
            purpose: current.purpose,
            referredToText: current.referredToText,
            referredToEmployeeId: current.referredToEmployeeId,
            outcome: current.outcome,
            purchased: current.purchased,
            purchaseAmount: current.purchaseAmount,
            notes: current.notes,
          },
          updatedBy: current.updatedBy || null,
          updatedAt: current.updatedAt || new Date(),
        };
        const existingPreviousUpdates = (current.previousUpdates as any[]) || [];
        const updatedPreviousUpdates = [previousUpdate, ...existingPreviousUpdates].slice(0, 3);

        const updateData: any = {
          ...rest,
          updatedAt: new Date(),
          updatedBy: updatedByUserId || null,
          previousUpdates: updatedPreviousUpdates,
        };
        if (rest.visitDate) updateData.visitDate = new Date(rest.visitDate);
        if (rest.timeIn !== undefined) updateData.timeIn = rest.timeIn ? new Date(rest.timeIn) : null;
        if (rest.timeOut !== undefined) updateData.timeOut = rest.timeOut ? new Date(rest.timeOut) : null;

        return await prisma.visitor.update({
          where: { id: updateId },
          data: updateData,
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });
      },

      /** Records a check-out time on an existing visit. */
      async gpCheckOut(this: any, id: string, timeOut?: string | Date, updatedByUserId?: string) {
        const visitor = await prisma.visitor.findUnique({ where: { id, isDeleted: null } });
        if (!visitor) {
          throw new Error(`Visitor with ID ${id} not found.`);
        }
        return await prisma.visitor.update({
          where: { id },
          data: {
            timeOut: timeOut ? new Date(timeOut) : new Date(),
            updatedAt: new Date(),
            updatedBy: updatedByUserId || null,
          },
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });
      },

      async gpSoftDelete(this: any, id: string) {
        const visitor = await prisma.visitor.findUnique({ where: { id, isDeleted: null } });
        if (!visitor) {
          throw new Error(`Visitor with ID ${id} not found.`);
        }
        return await prisma.visitor.update({
          where: { id },
          data: { isDeleted: new Date() },
        });
      },

      async gpRestore(this: any, id: string) {
        const visitor = await prisma.visitor.findUnique({ where: { id } });
        if (!visitor) {
          throw new Error(`Visitor with ID ${id} not found.`);
        }
        return await prisma.visitor.update({
          where: { id },
          data: { isDeleted: null },
        });
      },

      /**
       * Bulk create used by the import flows. Accepts already-normalized rows.
       * Returns the count created.
       */
      async gpBulkCreate(this: any, rows: any[], createdByUserId?: string) {
        if (!rows.length) return { created: 0 };
        const now = new Date();
        const CHUNK = 500;
        let created = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK).map((r) => ({
            name: r.name,
            phone: r.phone ?? null,
            cnic: r.cnic ?? null,
            vehicleNo: r.vehicleNo ?? null,
            company: r.company ?? null,
            purpose: r.purpose ?? null,
            referredToText: r.referredToText ?? null,
            referredToEmployeeId: r.referredToEmployeeId ?? null,
            visitDate: r.visitDate ? new Date(r.visitDate) : now,
            timeIn: r.timeIn ? new Date(r.timeIn) : null,
            timeOut: r.timeOut ? new Date(r.timeOut) : null,
            outcome: r.outcome ?? "ENQUIRY",
            purchased: typeof r.purchased === "boolean" ? r.purchased : false,
            purchaseAmount: r.purchaseAmount ?? null,
            notes: r.notes ?? null,
            createdBy: createdByUserId || null,
            createdAt: now,
          }));
          const res = await prisma.visitor.createMany({ data: chunk });
          created += res.count;
        }
        return { created };
      },

      async getHistoryById(this: any, visitorId: string, filter?: boolean, date?: string) {
        const visitor = (await prisma.visitor.findUnique({
          where: { id: visitorId },
        })) as any;
        if (!visitor) {
          throw new Error(`Visitor with ID ${visitorId} not found.`);
        }

        const previousUpdates = (visitor.previousUpdates as any[]) || [];
        const withNames = await Promise.all(
          previousUpdates.map(async (u: any) => ({
            ...u,
            updatedByName: await getUpdatedByName(u.updatedBy || null),
          }))
        );

        if (!filter) return withNames;

        if (filter && date) {
          const targetDateStr = new Date(date).toISOString().split("T")[0];
          const record = withNames.find((u: any) => {
            if (!u.updatedAt) return false;
            return new Date(u.updatedAt).toISOString().split("T")[0] === targetDateStr;
          });
          return record || null;
        }

        return withNames
          .map((u: any) => u.updatedAt)
          .filter((d: any) => d !== null && d !== undefined);
      },

      /** Dashboard/reporting stats for a date range. */
      async gpStats(this: any, from?: string | Date, to?: string | Date) {
        const where: any = { isDeleted: null };
        if (from || to) {
          where.visitDate = {};
          if (from) {
            const f = new Date(from);
            f.setHours(0, 0, 0, 0);
            where.visitDate.gte = f;
          }
          if (to) {
            const t = new Date(to);
            t.setHours(23, 59, 59, 999);
            where.visitDate.lte = t;
          }
        }

        const [total, purchasedCount, byOutcome, purchaseAgg] = await Promise.all([
          prisma.visitor.count({ where }),
          prisma.visitor.count({ where: { ...where, purchased: true } }),
          prisma.visitor.groupBy({
            by: ["outcome"],
            where,
            _count: { _all: true },
          }),
          prisma.visitor.aggregate({
            where: { ...where, purchased: true },
            _sum: { purchaseAmount: true },
          }),
        ]);

        return {
          totalVisitors: total,
          purchasedVisitors: purchasedCount,
          totalPurchaseAmount: purchaseAgg._sum.purchaseAmount || 0,
          byOutcome: byOutcome.map((o: any) => ({
            outcome: o.outcome,
            count: o._count._all,
          })),
        };
      },

      /**
       * Full visit history for one person, matched by phone (preferred) and/or name.
       * Returns every visit (newest first) plus a summary (count, first/last visit, purchases).
       */
      async gpPersonHistory(this: any, opts: { phone?: string; name?: string; cnic?: string }) {
        const or: any[] = [];

        // Match phone/CNIC by DIGITS ONLY so formatting (hyphens/spaces) doesn't matter:
        // e.g. "0321-4034022", "03214034022" and "0321 4034022" all match.
        const phoneDigits = (opts.phone || "").replace(/\D/g, "");
        const cnicDigits = (opts.cnic || "").replace(/\D/g, "");
        const matchedIds = new Set<string>();

        if (phoneDigits.length >= 7) {
          const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT id FROM "Visitor" WHERE "isDeleted" IS NULL AND regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = $1`,
            phoneDigits
          );
          rows.forEach((r) => matchedIds.add(r.id));
        }
        if (cnicDigits.length >= 5) {
          const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT id FROM "Visitor" WHERE "isDeleted" IS NULL AND regexp_replace(coalesce(cnic,''), '[^0-9]', '', 'g') = $1`,
            cnicDigits
          );
          rows.forEach((r) => matchedIds.add(r.id));
        }
        if (matchedIds.size > 0) or.push({ id: { in: Array.from(matchedIds) } });

        if (opts.name && opts.name.trim())
          or.push({ name: { equals: opts.name.trim(), mode: Prisma.QueryMode.insensitive } });

        if (or.length === 0) {
          return { visits: [], summary: { totalVisits: 0 } };
        }

        const visits = await prisma.visitor.findMany({
          where: { isDeleted: null, OR: or },
          orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });

        const purchased = visits.filter((v) => v.purchased);
        const totalSpent = purchased.reduce((sum, v) => sum + (v.purchaseAmount || 0), 0);

        return {
          visits,
          summary: {
            totalVisits: visits.length,
            firstVisit: visits.length ? visits[visits.length - 1].visitDate : null,
            lastVisit: visits.length ? visits[0].visitDate : null,
            purchasedCount: purchased.length,
            totalSpent,
          },
        };
      },

      /**
       * Quick "returning visitor" lookup used while adding a visitor:
       * matches by phone (or name) and returns the count + the most recent prior visit for prefill.
       */
      async gpLookupPerson(this: any, opts: { phone?: string; name?: string; cnic?: string }) {
        const { visits, summary } = await this.gpPersonHistory(opts);
        return {
          isReturning: visits.length > 0,
          totalVisits: summary.totalVisits,
          lastVisit: summary.lastVisit || null,
          totalSpent: summary.totalSpent || 0,
          purchasedCount: summary.purchasedCount || 0,
          last: visits[0] || null,
        };
      },

      /**
       * Suggest distinct people (by name) for the Add-visitor name autocomplete.
       * Returns each distinct person once with their most recent record for prefill.
       */
      async gpSuggestPersons(this: any, term: string, limit = 8) {
        const t = (term || "").trim();
        if (t.length < 1) return [];

        // Pull recent matching visits, then dedupe by person in JS (newest first).
        const rows = await prisma.visitor.findMany({
          where: {
            isDeleted: null,
            name: { contains: t, mode: Prisma.QueryMode.insensitive },
          },
          orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
          take: 200,
          include: { referredToEmployee: { select: referredToEmployeeSelect } },
        });

        const seen = new Set<string>();
        const persons: any[] = [];
        for (const r of rows) {
          const key = `${(r.name || "").toLowerCase()}|${r.phone || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          persons.push({
            name: r.name,
            phone: r.phone,
            cnic: r.cnic,
            company: r.company,
            vehicleNo: r.vehicleNo,
            purpose: r.purpose,
            referredToText: r.referredToText,
            referredToEmployeeId: r.referredToEmployeeId,
            referredToEmployee: r.referredToEmployee,
            lastVisit: r.visitDate,
          });
          if (persons.length >= limit) break;
        }
        return persons;
      },

      /** Paginated list filtered by date range / outcome / purchased (for the filter dialog). */
      async gpFilterPaginated(
        this: any,
        opts: { from?: string | Date; to?: string | Date; outcome?: string; purchased?: boolean },
        page: number,
        pageSize: number
      ) {
        const where: any = { isDeleted: null };
        if (opts.from || opts.to) {
          where.visitDate = {};
          if (opts.from) {
            const f = new Date(opts.from);
            f.setHours(0, 0, 0, 0);
            where.visitDate.gte = f;
          }
          if (opts.to) {
            const t = new Date(opts.to);
            t.setHours(23, 59, 59, 999);
            where.visitDate.lte = t;
          }
        }
        if (opts.outcome) where.outcome = opts.outcome;
        if (typeof opts.purchased === "boolean") where.purchased = opts.purchased;

        const skip = (page - 1) * pageSize;
        const [data, total] = await Promise.all([
          prisma.visitor.findMany({
            where,
            orderBy: [{ visitDate: "desc" }, { timeIn: "desc" }],
            skip,
            take: pageSize,
            include: { referredToEmployee: { select: referredToEmployeeSelect } },
          }),
          prisma.visitor.count({ where }),
        ]);

        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },

      /**
       * Visitors currently on-site: checked in today (timeIn set) with no check-out yet.
       * Scoped to today so historical records without a check-out don't appear as "present".
       */
      async gpPresent(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const where: any = {
          isDeleted: null,
          timeIn: { not: null },
          timeOut: null,
          visitDate: { gte: todayStart, lte: todayEnd },
        };
        const [data, total] = await Promise.all([
          prisma.visitor.findMany({
            where,
            orderBy: [{ timeIn: "desc" }],
            skip,
            take: pageSize,
            include: { referredToEmployee: { select: referredToEmployeeSelect } },
          }),
          prisma.visitor.count({ where }),
        ]);
        return {
          data,
          totalSize: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },
    },
  },
});

export default visitorModel;
