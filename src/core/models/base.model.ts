import { Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
import { getCurrentTimeInPST } from "../../helper/date.helper";
import { prisma as basePrisma } from "../database/prisma.client";
import { getActorId, getImpersonatorId } from "../context/requestContext";
import { stampArgs } from "../audit/stamp";
import { WRITE_OPS, AUDIT_EXCLUDE } from "../audit/auditModels";
import { writeAudit, loadBefore, lowerFirst } from "../audit/auditWriter";
// import { tableNames } from "../static/staticData";

// Run 11 Part 2/3. Audit toggles (default on). AUDIT_LOG=0 disables logging entirely;
// AUDIT_ENFORCE=0 makes a failed audit insert non-fatal (write still commits) for emergencies.
// Read lazily so a maintenance script (e.g. qa/cleanup.ts) can set AUDIT_LOG=0 at startup.
const isAuditOn = () => process.env.AUDIT_LOG !== "0";
const AUDIT_ENFORCE = process.env.AUDIT_ENFORCE !== "0";

// Carries the active transaction client so the audit row is written on the SAME tx as the write.
const txAls = new AsyncLocalStorage<{ tx: any }>();

// Run 11 Part 2: apply the audit query extension FIRST so that the model-extension helpers below
// (gpCreate/gpUpdate/gpSoftDelete, whose internal this.create/this.update must be stamped) run on a
// client that already has the query hook. Direct prisma.x.create/update calls go through it too.
const audited = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const isWrite = WRITE_OPS.has(operation);
        if (isWrite) {
          // During impersonation, createdBy/updatedBy are attributed to the real admin (impersonator),
          // NOT the target user — so record ownership reflects who actually made the change. The
          // AuditLog row still records userId = target (the acting user) + impersonatorId separately.
          const actor = getImpersonatorId() ?? getActorId();
          if (actor) {
            try { stampArgs(model, operation, args, actor); } catch { /* never block a write on stamping */ }
          }
        }
        // Not an audited write -> pass straight through.
        if (!isAuditOn() || !isWrite || AUDIT_EXCLUDE.has(model)) return query(args);

        const store = txAls.getStore();
        if (store && store.tx) {
          // Inside a transaction we are tracking (caller opened one): run the op via the bound
          // executor and log on the same tx. loadBefore/writeAudit use the extended tx client;
          // their reads/inserts pass through the hook harmlessly (reads + excluded AuditLog).
          let before: any = null;
          try { before = await loadBefore(store.tx, model, operation, args); } catch { /* best-effort pre-image */ }
          const result = await query(args);
          try {
            await writeAudit(store.tx, { model, operation, args, before, result });
          } catch (e: any) {
            if (AUDIT_ENFORCE) throw e; // no write without its log: roll the tx back
            console.error("writeAudit failed (non-enforced):", e?.message || e);
          }
          return result;
        }
        // Not in a tracked tx: open one on the RAW client and run the op + before + audit on that
        // raw tx. args are already stamped above, and a raw tx delegate does NOT re-enter this hook,
        // so there is no recursion. The write and its audit row commit atomically.
        return basePrisma.$transaction(async (rawTx: any) => {
          let before: any = null;
          try { before = await loadBefore(rawTx, model, operation, args); } catch { /* best-effort */ }
          const result = await rawTx[lowerFirst(model)][operation](args);
          try {
            await writeAudit(rawTx, { model, operation, args, before, result });
          } catch (e: any) {
            if (AUDIT_ENFORCE) throw e;
            console.error("writeAudit failed (non-enforced):", e?.message || e);
          }
          return result;
        });
      },
    },
  },
});

const prisma = audited.$extends({
  model: {
    $allModels: {
      async gpSoftDelete(this: any, id: string) {
        const existingItem = await this.findUnique({ where: { id } });
        if (!existingItem || existingItem.isDeleted === null) {
          if (!existingItem) return;
          await this.update({
            where: { id },
            data: { isDeleted:new Date() },
          });
        }
      },

      async gpRestore(this: any, id: string) {
        const existingItem = await this.findUnique({ where: { id } });
        if (existingItem.isDeleted !== null) {
          await this.update({
            where: { id },
            data: { isDeleted: null },
          });
        }
      },

      async gpSearch(
        this: any,
        searchTerm: string | string[],
        columns: string[],
        pageNumber: number = 1,
        pageSize: number = 10
      ) {
        const searchTermsArray = Array.isArray(searchTerm)
          ? searchTerm
          : [searchTerm];
        let mainCondition = {};

        for (let i = 0; i < searchTermsArray.length; i++) {
          const term = searchTermsArray[i];
          const condition = {
            OR: columns.map((column) => ({
              [column]: {
                mode: "insensitive",
                contains: term,
              },
            })),
          };

          if (i === 0) {
            mainCondition = condition;
          } else {
            mainCondition = {
              AND: [mainCondition, condition],
            };
          }
        }

        const offset = (pageNumber - 1) * pageSize;

        const [data, totalSize] = await Promise.all([
          this.findMany({
            where: {
              isDeleted: null,
              ...mainCondition,
            },
            skip: offset,
            take: pageSize,
          }),
          this.count({
            where: {
              isDeleted: null,
              ...mainCondition,
            },
          }),
        ]);

        return { data, totalSize };
      },

      async gpCreate(this: any, createdData: any) {
        if (!Array.isArray(createdData)) {
          createdData = [createdData];
        }

        const createdItems = [];

        for (const data of createdData) {
          let newData = {
            ...data,
            createdAt:new Date(),
          };

          const createdItem = await this.create({
            data: newData,
          });

          createdItems.push(createdItem);
        }

        return createdItems;
      },

      async gpUpdate(this: any, updateId: string, updatedData: any) {
        let newData = {
          ...updatedData,
          updatedAt:new Date(),
        };
        const updatedItem = await this.update({
          where: { id: updateId },
          data: newData,
        });
        return updatedItem;
      },

      async gpFindById(this: any, id: string) {
        const data = await this.findUnique({
          where: {
            id: id,
            isDeleted: null,
          },
        });
        return data;
      },

      async gpCount(this: any) {
        const count = await this.count({
          where: {
            isDeleted: null,
          },
        });
        return count;
      },
      
      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;
// console.log(page,pageSize);
        const data = await this.findMany({
          where: {
            isDeleted: null,
          },
          take: pageSize,
          skip: skip,
        });

        const totalSize = await this.count({
          where: {
            isDeleted: null,
          },
        });

        return { data, totalSize };
      },

      async gpPgFindDeletedMany(this: any, page: number, pageSize: number) {
        const skip = (page - 1) * pageSize;

        const data = await this.findMany({
          where: {
            isDeleted: {
              not: null,
            },
          },
          // take: pageSize,
          // skip: skip,
        });

        const totalSize = await this.count({
          where: {
            isDeleted: {
              not: null,
            },
          },
        });

        return { data, totalSize };
      },

      async gpFindMany(this: any) {
        const data = await this.findMany({
          where: {
            isDeleted: null,
          },
        });

        return data;
      },

      async gpFilter(
        this: any,
        searchTerm: string | string[],
        columns: string[],
        pageNumber: number = 1,
        pageSize: number = 10
      ) {
        const searchTermsArray = Array.isArray(searchTerm)
          ? searchTerm
          : [searchTerm];

        const searchConditions = searchTermsArray.map((term) => ({
          OR: columns.map((column) => ({
            [column]: { equals: term },
          })),
        }));

        const [data, totalSize] = await Promise.all([
          this.findMany({
            where: {
              isDeleted: null,
              OR: searchConditions,
            },
            skip: (pageNumber - 1) * pageSize,
            take: pageSize,
          }),
          this.count({
            where: {
              isDeleted: null,
              OR: searchConditions,
            },
          }),
        ]);

        return { data, totalSize };
      },

      async gpGetByName(this: any, name: string) {
        const Data = await this.findFirst({
          where: {
            name: name,
            isDeleted: null,
          },
        });

        return Data;
      },
      async gpUpdateByName(this: any, updateId: string, updatedData: any) {
        let newData = {
          ...updatedData,
          updatedAt:new Date(),
        };
        const updatedItem = await this.update({
          where: { name: updateId },
          data: newData,
        });
        return updatedItem;
      },

    },
  },
});

// Override $transaction so that when a service opens its own interactive transaction, writes inside
// it are audited on THAT tx (preserving the caller's atomicity) instead of each opening a new one.
const prismaFinal = prisma.$extends({
  client: {
    $transaction(this: any, ...a: any[]) {
      const arg = a[0];
      if (typeof arg === "function") {
        return (prisma as any).$transaction((tx: any) => txAls.run({ tx }, () => arg(tx)), a[1]);
      }
      // Batch array form: delegate unchanged (each op self-audits in its own tx).
      return (prisma as any).$transaction(...a);
    },
  },
});

export default prismaFinal;
