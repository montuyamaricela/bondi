import 'dotenv/config';
import path from 'node:path';
import type { PrismaConfig } from 'prisma';
import { migrationDatabaseUrl } from './lib/server/env';

export default {
  engine: 'classic',
  datasource: { url: migrationDatabaseUrl() },
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
} satisfies PrismaConfig;
