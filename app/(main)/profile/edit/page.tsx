'use client';

import { useProfileWithPhotosQuery } from '@/lib/client/profile';
import { ProfileEditForm } from '@/app/components/features/profile/components/ProfileEditForm';
import { ProfileSkeleton } from '@/app/components/features/profile/components/ProfileSkeleton';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ProfileEditPage() {
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
        <Link
          href='/profile'
          className='inline-flex items-center space-x-2 text-text-body hover:text-text-heading mb-6'
        >
          <ArrowLeft className='h-4 w-4' />
          <span>Back to Profile</span>
        </Link>

        <h1 className='text-3xl font-bold text-text-heading mb-6'>
          Edit Profile
        </h1>

        <ProfileEditForm profile={data.profile} />
      </div>
    </div>
  );
}
