'use client';

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes';
import { useSyncExternalStore, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const subscribe = () => () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemeProvider>
  );
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  // Match the server snapshot during hydration before exposing the saved preference.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return {
    theme: hydrated && (theme === 'light' || theme === 'dark') ? theme : 'system',
    setTheme: (value: Theme) => setTheme(value),
    actualTheme: hydrated && resolvedTheme === 'dark' ? 'dark' : 'light',
  };
}
