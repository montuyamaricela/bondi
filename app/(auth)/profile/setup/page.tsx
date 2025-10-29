import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { ProfileSetupForm } from '@/app/components/features/auth/components/ProfileSetupForm';

export default async function ProfileSetupPage() {
  const session = await getServerSession(
    await import('next/headers').then((m) => m.headers())
  );

  if (!session?.user) {
    redirect('/login');
  }

  const existingProfile = await db.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (existingProfile) {
    redirect('/discover');
  }

  return (
    <div className='container mx-auto '>
      <ProfileSetupForm />
    </div>
  );
}
