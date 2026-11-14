import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { safeCallbackUrl } from '@/lib/auth-navigation';
import { ProfileSetupForm } from '@/app/components/features/auth/components/ProfileSetupForm';

export default async function ProfileSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  const session = await getServerSession(await import('next/headers').then((m) => m.headers()));

  if (!session?.user) {
    redirect('/login');
  }

  const existingProfile = await db.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (existingProfile) {
    redirect(callbackUrl);
  }

  return (
    <div className="container mx-auto">
      <ProfileSetupForm callbackUrl={callbackUrl} />
    </div>
  );
}
