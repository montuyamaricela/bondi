import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen flex flex-col bg-linear-to-br from-pink-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950'>
      <header className='p-6'>
        <div className='max-w-7xl mx-auto'>
          <h1 className='text-3xl font-bold bg-linear-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent'>
            Bondi
          </h1>
        </div>
      </header>

      <main className='flex-1 flex items-center justify-center p-4'>
        <div className='w-full'>{children}</div>
      </main>

      <footer className='p-6 text-center text-sm text-gray-600 dark:text-gray-400'>
        <p>&copy; 2024 Bondi. All rights reserved.</p>
      </footer>
    </div>
  );
}
