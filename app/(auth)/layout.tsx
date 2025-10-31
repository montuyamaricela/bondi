import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:bg-bg-main'>
      <header className='p-6'>
        <div className='max-w-7xl mx-auto'>
          <h1 className='text-3xl font-bold text-primary-main'>
            Bondi
          </h1>
        </div>
      </header>

      <main className='flex-1 flex items-center justify-center p-4'>
        <div className='w-full'>{children}</div>
      </main>

      <footer className='p-6 text-center text-sm text-text-muted'>
        <p>&copy; 2024 Bondi. All rights reserved.</p>
      </footer>
    </div>
  );
}
