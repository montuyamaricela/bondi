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
      <div className="flex min-h-screen items-center justify-center bg-bg-main">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-text-heading">Error loading profile</h2>
          <p className="text-text-muted">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-main">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-text-heading">Profile not found</h2>
          <p className="text-text-muted">This user&apos;s profile could not be found</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="cursor-pointer bg-transparent hover:bg-transparent hover:text-primary-main"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-text-heading">
            {data.profile.name}&apos;s Profile
          </h1>
        </div>

        <ProfileView profile={data.profile} />
      </div>
    </div>
  );
}
