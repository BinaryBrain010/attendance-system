import prisma from "../../../../core/models/base.model";

const SYSTEM_CONFIG_ID = "default";

const systemConfigModel = prisma.$extends({
  model: {
    systemConfig: {
      async getConfig(this: any): Promise<Record<string, any>> {
        const row = await prisma.systemConfig.findUnique({
          where: { id: SYSTEM_CONFIG_ID },
        });
        return row?.config != null ? (row.config as Record<string, any>) : {};
      },

      async updateConfig(this: any, config: Record<string, any>): Promise<Record<string, any>> {
        await prisma.systemConfig.upsert({
          where: { id: SYSTEM_CONFIG_ID },
          create: {
            id: SYSTEM_CONFIG_ID,
            config: config ?? {},
            updatedAt: new Date(),
          },
          update: {
            config: config ?? {},
            updatedAt: new Date(),
          },
        });
        return config;
      },
    },
  },
});

export default systemConfigModel;
