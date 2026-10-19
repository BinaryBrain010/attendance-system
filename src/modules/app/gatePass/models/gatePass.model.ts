import prisma from "../../../../core/models/base.model";
import { Prisma } from "@prisma/client";
import { Status } from "../../../../enums/schema";
import { AppError } from "../../../../core/errors/app.error";
import { getActorId } from "../../../../core/context/requestContext";
import { DetailedGatePass } from "../../../../types/paginatedData";
import {
  CreateGatePassItem,
  GatePass,
  GatePassItem,
} from "../../../../types/schema";

const gatePassModel = prisma.$extends({
  model: {
    gatePass: {
      async gpCreate(
        this: any,
        gatePass: GatePass,
        gatePassItem: CreateGatePassItem[]
      ) {
        const transaction = await prisma.$transaction(async (prisma: any) => {
          try {
            const createdGatePass = await prisma.gatePass.gpCreate(gatePass);
            if (createdGatePass) {
              await Promise.all(
                gatePassItem.map((item) =>
                  prisma.gatePassItem.create({
                    data: {
                      ...item,
                      gatePassId: createdGatePass[0]?.id || "",
                    },
                  })
                )
              );
            }
            return createdGatePass;
          } catch (error) {
            throw error;
          }
        });

        return transaction;
      },
      async gpPgFindMany(this: any, page: number, pageSize: number) {
        const offset = (page - 1) * pageSize;
        const data = await prisma.$queryRaw(Prisma.sql`
   SELECT
    g.id AS gatePassId,
    c.name AS customerName,
    g."issuedAt",
    g.status,
    g.notes AS gatePassNotes,
    g.location,
    g."vehicleNo",
    g."storeIncharge",
    (
        SELECT json_agg(
            json_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'quantity', gpi.quantity,
                'unitPrice', i."unitPrice",
                'serialNos', gpi."serialNos"
            )
        )
        FROM "GatePassItem" gpi
        JOIN "Item" i ON gpi."itemId" = i.id
        WHERE gpi."gatePassId" = g.id
          AND i."isDeleted" IS NULL -- Ensure Item is not deleted
    ) AS items
FROM
    "GatePass" g
JOIN
    "Customer" c ON g."customerId" = c.id
WHERE
    g."isDeleted" IS NULL -- Ensure GatePass is not deleted
    ORDER BY
    g."createdAt" DESC
LIMIT ${pageSize}
OFFSET ${offset};
`);

        const totalSize: number = await this.count({
          where: {
            isDeleted: null,
          },
        });

        return { data, totalSize };
      },

      async gpPgDeletedFindMany(this: any, page: number, pageSize: number) {
        const offset = (page - 1) * pageSize;
        const data = await prisma.$queryRaw(Prisma.sql`
  SELECT
    g.id AS gatePassId,
    c.name AS customerName,
    g."issuedAt",
    g."validUntil",
    g.status,
    g.notes AS gatePassNotes,
    g.location,
    g."vehicleNo",
    g."storeIncharge",
    (
        SELECT json_agg(
            json_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'quantity', gpi.quantity,
                'unitPrice', i."unitPrice",
                'serialNos', gpi."serialNos"
            )
        )
        FROM "GatePassItem" gpi
        JOIN "Item" i ON gpi."itemId" = i.id
        WHERE gpi."gatePassId" = g.id
          AND i."isDeleted" IS NOT NULL  -- Ensure Item is not deleted
    ) AS items
FROM
    "GatePass" g
JOIN
    "Customer" c ON g."customerId" = c.id
WHERE
    g."isDeleted" IS NOT NULL  -- Ensure GatePass is not deleted;

`);

        const totalSize: number = await this.count({
          where: {
            isDeleted: {
              not: null,
            },
          },
        });

        return { data, totalSize };
      },

      async gpPgDateFilter(
        this: any,
        page: number,
        pageSize: number,
        from: Date,
        to: Date
      ) {
        const offset = (page - 1) * pageSize;
        const data = await prisma.$queryRaw(Prisma.sql`
          SELECT
            g.id AS gatePassId,
            c.name AS customerName,
            g."issuedAt",
            g."validUntil",
            g.status,
            g.notes AS gatePassNotes,
            g.location,
            g."vehicleNo",
            g."storeIncharge",
            (
              SELECT json_agg(
                json_build_object(
                  'id', i.id,
                  'name', i.name,
                  'description', i.description,
                  'quantity', gpi.quantity,
                  'unitPrice', i."unitPrice",
                  'serialNos', gpi."serialNos"
                )
              )
              FROM "GatePassItem" gpi
              JOIN "Item" i ON gpi."itemId" = i.id
              WHERE gpi."gatePassId" = g.id
                AND i."isDeleted" IS NULL -- Ensure Item is not deleted
            ) AS items
          FROM
            "GatePass" g
          JOIN
            "Customer" c ON g."customerId" = c.id
          WHERE
            g."isDeleted" IS NULL -- Ensure GatePass is not deleted
            AND g."issuedAt" >= CAST(${from} AS timestamp)
            AND g."issuedAt" <= CAST(${to} AS timestamp)
            `);
            // LIMIT ${pageSize}
            // OFFSET ${offset}

        const response: { total: number }[] = await prisma.$queryRaw(Prisma.sql`
          SELECT CAST(COUNT(*) AS INTEGER) AS total
          FROM "GatePass" g
          WHERE g."isDeleted" IS NULL -- Ensure GatePass is not deleted
            AND g."issuedAt" >= CAST(${from} AS timestamp)
            AND g."issuedAt" <= CAST(${to} AS timestamp)
        `);
        const totalSize = response[0].total;
        return { data, totalSize };
      },

      async gpPgStatusFilter(
        this: any,
        page: number,
        pageSize: number,
        status: Status
      ) {
        const offset = (page - 1) * pageSize;
        const data = await prisma.$queryRaw(Prisma.sql`
  SELECT
    g.id AS gatePassId,
    c.name AS customerName,
    g."issuedAt",
    g."validUntil",
    g.status,
    g.notes AS gatePassNotes,
    g.location,
    g."vehicleNo",
    g."storeIncharge",
    (
        SELECT json_agg(
            json_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'quantity', gpi.quantity,
                'unitPrice', i."unitPrice",
                'serialNos', gpi."serialNos"
            )
        )
        FROM "GatePassItem" gpi
        JOIN "Item" i ON gpi."itemId" = i.id
        WHERE gpi."gatePassId" = g.id
          AND i."isDeleted" IS NULL -- Ensure Item is not deleted
    ) AS items
FROM
    "GatePass" g
JOIN
    "Customer" c ON g."customerId" = c.id
WHERE
    g."isDeleted" IS NULL -- Ensure GatePass is not deleted
    AND g.status = ${status} -- Replace 'specific_status' with your actual status value
LIMIT ${pageSize}
OFFSET ${offset};


`);

        const totalSize: number = await prisma.$queryRaw(Prisma.sql`
  SELECT CAST(COUNT(*) AS INTEGER) AS total_count
FROM "GatePass" g
WHERE g."isDeleted" IS NULL -- Ensure GatePass is not deleted
AND g.status = ${status};
`);

        return { data, totalSize };
      },

      async gpFindById(this: any, id: string): Promise<DetailedGatePass> {
        const data: DetailedGatePass[] = await prisma.$queryRaw(Prisma.sql`
      SELECT
      g.id AS gatePassId,
      c.id AS customerId,
      c.name AS customerName,
      g."issuedAt",
      g."validUntil",
      g.status,
      g.notes AS gatePassNotes,
      g.location,
      g."vehicleNo",
      g."storeIncharge",
      g.signature,
      (
          SELECT json_agg(
              json_build_object(
                  'id', i.id,
                  'name', i.name,
                  'description', i.description,
                  'quantity', gpi.quantity,
                  'unitPrice', i."unitPrice",
                  'serialNos', gpi."serialNos"
              )
          )
          FROM "GatePassItem" gpi
          JOIN "Item" i ON gpi."itemId" = i.id
          WHERE gpi."gatePassId" = g.id
            AND i."isDeleted" IS NULL 
      ) AS items
    FROM
      "GatePass" g
    JOIN
      "Customer" c ON g."customerId" = c.id
    WHERE
      g.id = ${id} 
      AND g."isDeleted" IS NULL;
        `);

        return data[0];
      },

      async gpFindByCustomerId(
        this: any,
        id: string
      ): Promise<DetailedGatePass[]> {
        const data: DetailedGatePass[] = await prisma.$queryRaw(Prisma.sql`
      SELECT
    g.id AS gatePassId,
    c.name AS customerName,
    g."issuedAt",
    g."validUntil",
    g.status,
    g.notes AS gatePassNotes,
    g.location,
    g."vehicleNo",
    g."storeIncharge",
    g.signature,
    (
        SELECT json_agg(
            json_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'quantity', gpi.quantity,
                'unitPrice', i."unitPrice",
                'serialNos', gpi."serialNos"
            )
        )
        FROM "GatePassItem" gpi
        JOIN "Item" i ON gpi."itemId" = i.id
        WHERE gpi."gatePassId" = g.id
          AND i."isDeleted" IS NULL 
    ) AS items
FROM
    "GatePass" g
JOIN
    "Customer" c ON g."customerId" = c.id
WHERE
    g."isDeleted" IS NULL
    AND c.id = ${id};
        `);

        return data;
      },

      async gpFindByItemId(this: any, id: string): Promise<DetailedGatePass[]> {
        const data: DetailedGatePass[] = await prisma.$queryRaw(Prisma.sql`
      SELECT
    g.id AS gatePassId,
    c.name AS customerName,
    g."issuedAt",
    g."validUntil",
    g.status,
    g.notes AS gatePassNotes,
    g.location,
    g."vehicleNo",
    g."storeIncharge",
    g.signature,
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'id', i.id,
                    'name', i.name,
                    'description', i.description,
                    'quantity', gpi.quantity,
                    'unitPrice', i."unitPrice",
                    'serialNos', gpi."serialNos"
                )
            )
            FROM "GatePassItem" gpi
            JOIN "Item" i ON gpi."itemId" = i.id
            WHERE gpi."gatePassId" = g.id
              AND i."isDeleted" IS NULL 
              AND i.id = ${id}
        ),
        '[]'::json 
    ) AS items
FROM
    "GatePass" g
JOIN
    "Customer" c ON g."customerId" = c.id
WHERE
    g."isDeleted" IS NULL
    AND EXISTS (
        SELECT 1
        FROM "GatePassItem" gpi
        JOIN "Item" i ON gpi."itemId" = i.id
        WHERE gpi."gatePassId" = g.id
          AND i.id = ${id}
    );
        `);

        return data;
      },

      async gpUpdate(
        this: any,
        updateId: string,
        GatePassData: GatePass,
        GatePassItem: CreateGatePassItem[]
      ) {
        // A gate pass can only be edited while it is Pending or Approved. Once it has moved past
        // approval (dispatched / returned / closed / rejected / cancelled) edits are rejected. The
        // status is NEVER changed here — status transitions have their own endpoints — so we strip it
        // from the incoming data (this guards the mobile Edit path too).
        const current = await prisma.gatePass.findUnique({ where: { id: updateId }, select: { status: true } });
        if (!current) throw new AppError(404, `Gate pass with ID ${updateId} not found.`);
        const LOCKED = new Set<Status>([Status.DISPATCHED, Status.RETURNED, Status.CLOSED, Status.REJECTED, Status.CANCELLED]);
        if (LOCKED.has(current.status as Status)) {
          throw new AppError(409, "This pass has moved past approval");
        }
        const { status, ...editable } = (GatePassData || {}) as any; // never change status via update

        try {
          // Update the GatePass and retrieve the updated data
          const updated = await prisma.gatePass.update({
            where: { id: updateId },
            data: editable,
          });

          // Check if the update was successful and the ID is valid
          if (!updated || !updated.id) {
            throw new Error(`Failed to update GatePass with ID ${updateId}`);
          }

          // Delete existing GatePassItems associated with the given GatePass
          await prisma.gatePassItem.deleteMany({
            where: {
              gatePassId: updateId,
            },
          });

          // Create new GatePassItems
          if (GatePassItem && GatePassItem.length > 0) {
            await Promise.all(
              GatePassItem.map((item) =>
                prisma.gatePassItem.create({
                  data: {
                    ...item,
                    gatePassId: updated.id, // Use the updated GatePass ID
                  },
                })
              )
            );
          }

          return updated;
        } catch (error) {
          console.error("Error updating GatePass:", error);
          throw error;
        }
      },
      async gpApprovePass(id: string, signature?: string | null) {
        try {
            // Only a pending gate pass can be approved (no double-apply / re-approval).
            const existingPass = await prisma.gatePass.findUnique({ where: { id } });
            if (!existingPass) {
                return { success: false, message: `Gate pass with ID ${id} not found.` };
            }
            if (existingPass.status !== Status.PENDING) {
                throw new AppError(409, `Gate pass is already ${existingPass.status} and cannot be approved again.`);
            }

            const gatePassItems = await prisma.gatePassItem.findMany({
                where: { gatePassId: id },
            });
    
            // Iterate over gate pass items and update quantities
            for (const gatePassItem of gatePassItems) {
                const item = await prisma.item.findUnique({
                    where: { id: gatePassItem.itemId },
                });
    
                if (!item) {
                    console.log(`Approval failed: Item with ID ${gatePassItem.itemId} not found.`);
                    return {
                        success: false,
                        message: `Item with ID ${gatePassItem.itemId} not found.`,
                    };
                }
    
                if (gatePassItem.quantity) {
                    if (item.quantity) {
                        const remainingQuantity = item.quantity - gatePassItem.quantity;
    
                        if (remainingQuantity < 0) {
                            console.log(`Approval failed: Item ${item.name} has insufficient quantity. Available: ${item.quantity}, Requested: ${gatePassItem.quantity}`);
                            return {
                                success: false,
                                message: `Item ${item.name} has insufficient quantity. Available: ${item.quantity}, Requested: ${gatePassItem.quantity}`,
                            };
                        }
    
                        await prisma.item.update({
                            where: { id: gatePassItem.itemId },
                            data: { quantity: remainingQuantity },
                        });
                    } else {
                        console.log(`Approval failed: Item ${item.name} does not have a defined quantity.`);
                        return {
                            success: false,
                            message: `Item ${item.name} does not have a defined quantity.`,
                        };
                    }
                } else {
                    console.log(`Approval failed: Gate pass item with ID ${gatePassItem.id} does not have a defined quantity.`);
                    return {
                        success: false,
                        message: `Gate pass item with ID ${gatePassItem.id} does not have a defined quantity.`,
                    };
                }
            }
    
            // Update gate pass status and signature after all items have been processed
            const updateData: { status: Status; signature?: string | null } = { status: Status.APPROVED };
            if (signature !== undefined) {
                updateData.signature = signature;
            }
            
            await prisma.gatePass.update({
                where: { id },
                data: updateData,
            });

            // Record the approval in the status history too (does NOT change this endpoint's response).
            try {
                await prisma.gatePassStatusHistory.create({
                    data: { gatePassId: id, fromStatus: Status.PENDING, toStatus: Status.APPROVED, reason: null, changedById: getActorId() || null },
                });
            } catch { /* history is best-effort; never fail an approval on it */ }

            return {
                success: true,
                message: "Gate pass approved successfully.",
            };
        } catch (error) {
            if (error instanceof AppError) throw error; // let the 409 (not-pending) reach the client
            console.error("Error approving gate pass:", error);
            return { success: false, message: "Error approving gate pass." };
        }
    }
    
    
,    
      async getGatePassesReport() {
        // Array of month abbreviations
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        // Generate dates for the last 10 months
        const last10Months = Array.from({ length: 10 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          return date;
        }).reverse();

        const report = await Promise.all(
          last10Months.map(async (date) => {
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(
              date.getFullYear(),
              date.getMonth() + 1,
              1
            );

            const count = await prisma.gatePass.count({
              where: {
                createdAt: {
                  gte: startDate,
                  lt: endDate,
                },
              },
            });

            // Format the month string as YYYY-MMM
            const monthAbbreviation = monthNames[startDate.getMonth()];
            return {
              month: `${startDate.getFullYear()}-${monthAbbreviation}`,
              count,
            };
          })
        );

        return report;
      },
    },
  },
});

export default gatePassModel;
