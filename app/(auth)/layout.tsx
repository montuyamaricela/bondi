import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-main">
      <header className="p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-secondary-text dark:text-primary-text">Bondi</h1>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full">{children}</div>
      </main>

      <footer className="p-6 text-center text-sm text-text-muted">
        <p>&copy; 2025 Bondi. All rights reserved.</p>
      </footer>
    </div>
  );
}
