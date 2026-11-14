import { getServerSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { SettingsContent } from '@/app/components/features/settings/components/SettingsContent';

export default async function SettingsPage() {
  const headersList = await headers();
  const session = await getServerSession(headersList);

  if (!session?.user) {
    redirect('/login');
  }

  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      showOnlineStatus: true,
      showDistance: true,
      latitude: true,
      longitude: true,
      lastLocationUpdate: true,
    },
  });

  return (
    <div className="min-h-screen bg-bg-main py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-text-heading">Settings</h1>
        <SettingsContent user={session.user} profile={profile} />
      </div>
    </div>
  );
}
