import prisma from "../../../../core/models/base.model";
import { Prisma } from "@prisma/client";
import { DetailedGatePass } from "../../../../types/paginatedData";

const ItemModel = prisma.$extends({
  model: {
    item: {
      async outOfStockItems() {
        const data = await prisma.item.findMany({
          where: {
            quantity: {
              lte: 0, // `lte` stands for "less than or equal to"
            },
          },
        });

        return data;
      },

      async findBySerialNo(serialNo: string): Promise<DetailedGatePass | null> {
        const data: DetailedGatePass[] = await prisma.$queryRaw(Prisma.sql`
          SELECT
            g.id AS gatepassid,
            c.name AS customername,
            g."issuedAt",
            g."validUntil",
            g.status,
            g.notes AS gatepassnotes,
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
                AND ${serialNo} = ANY(gpi."serialNos")
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
              WHERE gpi."gatePassId" = g.id
                AND gpi."isDeleted" IS NULL
                AND ${serialNo} = ANY(gpi."serialNos")
            )
          LIMIT 1;
        `);

        return data.length > 0 ? data[0] : null;
      },
    },
  },
});

export default ItemModel;
