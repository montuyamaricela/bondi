import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/session';
import { LikedYouList } from '@/app/components/features/matching/components/LikedYouList';

export default async function LikesPage() {
  const headersList = await headers();
  const session = await getServerSession(headersList);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-text-heading'>Who Likes You</h1>
        <p className='text-text-muted mt-2'>
          These users have already liked you. Like them back to match!
        </p>
      </div>

      <LikedYouList />
    </div>
  );
}
