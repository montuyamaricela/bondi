import { getServerSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { MainNav } from '@/app/components/features/layout/components/MainNav';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const session = await getServerSession(headersList);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg-main">
      <MainNav />
      <main>{children}</main>
    </div>
  );
}
