import { PrismaClient } from '@prisma/client';
import { isProduction, runtimeDatabaseUrl } from '@/lib/server/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeDatabaseUrl() } },
    // API handlers report redacted correlation IDs; raw Prisma logs can include private values.
    log: [],
  });

if (!isProduction()) globalForPrisma.prisma = db;
