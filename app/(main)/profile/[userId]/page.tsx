'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useUserProfileQuery } from '@/lib/client/profile';
import { ProfileView } from '@/app/components/features/profile/components/ProfileView';
import { ProfileSkeleton } from '@/app/components/features/profile/components/ProfileSkeleton';
import { Button } from '@/app/components/ui/button';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { data, isLoading, error } = useUserProfileQuery(userId);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-bg-main'>
        <div className='text-center space-y-4'>
          <h2 className='text-2xl font-bold text-text-heading'>
            Error loading profile
          </h2>
          <p className='text-text-muted'>
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-bg-main'>
        <div className='text-center space-y-4'>
          <h2 className='text-2xl font-bold text-text-heading'>
            Profile not found
          </h2>
          <p className='text-text-muted'>
            This user&apos;s profile could not be found
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-bg-main py-8'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center gap-4 mb-6'>
          <Button
            variant='ghost'
            onClick={() => router.back()}
            className='hover:text-primary-main bg-transparent cursor-pointer hover:bg-transparent'
          >
            <ArrowLeft className='h-5 w-5 mr-2' />
            Back
          </Button>
          <h1 className='text-3xl font-bold text-text-heading'>
            {data.profile.name}&apos;s Profile
          </h1>
        </div>

        <ProfileView profile={data.profile} />
      </div>
    </div>
  );
}
