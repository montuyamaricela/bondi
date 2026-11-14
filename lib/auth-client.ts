import { createAuthClient } from 'better-auth/react';

// Auth routes share the app origin; the SDK also supports relative requests during SSR.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
