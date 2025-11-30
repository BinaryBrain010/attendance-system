import { Prisma } from "@prisma/client";
import { getCurrentTimeInPST } from "../../helper/date.helper";
import { prisma as basePrisma } from "../database/prisma.client";
// import { tableNames } from "../static/staticData";

const prisma = basePrisma.$extends({
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

export default prisma;
