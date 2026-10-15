import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    // 'query' logging is intentionally left off: under load it logs every statement to the
    // console and files, which dominates latency and floods the logs. Opt in with PRISMA_QUERY_LOG=1.
    log: process.env.PRISMA_QUERY_LOG === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Give interactive transactions a bit more room to acquire a connection and run before
    // Prisma throws "Unable to start a transaction in the given time" under load.
    transactionOptions: {
      maxWait: 10000, // wait up to 10s for a pooled connection to begin the transaction
      timeout: 15000, // allow the transaction body up to 15s
    },
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Optimize connection pooling for production
if (process.env.NODE_ENV === 'production') {
  // Ensure proper connection management
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

