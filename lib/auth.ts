import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from '@/lib/db';
import { authEnvironment } from '@/lib/server/env';
import { notifyPresenceChange } from '@/lib/server/native-presence';

const configuration = authEnvironment();

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  databaseHooks: {
    session: {
      delete: {
        after: async (session) => notifyPresenceChange(session.userId),
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (default)
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      // Every protected request must observe database revocation immediately.
      enabled: false,
    },
    rememberMe: {
      enabled: true,
      expiresIn: 60 * 60 * 24 * 30, // 30 days when remember me is checked
    },
  },
  secret: configuration.secret,
  baseURL: configuration.baseURL,
});

// Export types for client-side usage
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
