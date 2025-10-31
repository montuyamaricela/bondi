'use client';

import { useProfileWithPhotosQuery } from '@/lib/client/profile';
import { ProfileView } from '@/app/components/features/profile/components/ProfileView';
import { ProfileSkeleton } from '@/app/components/features/profile/components/ProfileSkeleton';
import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { Edit } from 'lucide-react';

export default function ProfilePage() {
  const { data, isLoading, error } = useProfileWithPhotosQuery();

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
          <p className='text-text-muted'>Please complete your profile setup</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-bg-main py-8'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-3xl font-bold text-text-heading'>My Profile</h1>
          <Link href='/profile/edit'>
            <Button className='flex items-center space-x-2 cursor-pointer bg-primary-main dark:bg-secondary-main text-primary-text dark:text-secondary-text'>
              <Edit className='h-4 w-4' />
              <span>Edit Profile</span>
            </Button>
          </Link>
        </div>

        <ProfileView profile={data.profile} />
      </div>
    </div>
  );
}
