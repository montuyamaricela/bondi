import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // API handlers report redacted correlation IDs; raw Prisma logs can include private values.
    log: [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
