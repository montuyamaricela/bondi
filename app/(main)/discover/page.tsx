'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SwipeCard } from '@/app/components/features/discover/components/SwipeCard';
import { MatchModal } from '@/app/components/features/discover/components/MatchModal';
import { FilterPanel } from '@/app/components/features/discover/components/FilterPanel';
import { useDiscoverProfiles, useLikeActionMutation } from '@/lib/client/discover';
import { useNotifications } from '@/app/components/hooks/useNotifications';
import { useGeolocation } from '@/app/components/hooks/useGeolocation';
import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { api, FetchError } from '@/lib/fetch-wrapper';
import type { DiscoverFilters, MatchNotification } from '@/app/components/features/discover/types';

export default function DiscoverPage() {
  const [filters, setFilters] = useState<DiscoverFilters>({
    minAge: 18,
    maxAge: 100,
  });
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [matchNotification, setMatchNotification] = useState<MatchNotification | null>(null);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);

  const { data: profiles, isLoading, error, refetch } = useDiscoverProfiles(filters);
  const likeActionMutation = useLikeActionMutation();
  const { showMatchNotification, permission } = useNotifications();
  const { requestLocation } = useGeolocation();

  useEffect(() => {
    const autoRequestLocation = async () => {
      const locationRequested = localStorage.getItem('locationRequested');

      if (!locationRequested && !hasRequestedLocation) {
        setHasRequestedLocation(true);

        try {
          const coords = await requestLocation();
          await api.patch('/api/profile/location', {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          localStorage.setItem('locationRequested', 'true');
          toast.success('Location enabled successfully!');
        } catch (error) {
          if (error instanceof Error && error.message.includes('denied')) {
            toast.info('Location permission denied. You can enable it later in Settings.');
          }
          localStorage.setItem('locationRequested', 'true');
        }
      }
    };

    autoRequestLocation();
  }, [requestLocation, hasRequestedLocation]);

  const currentProfile = profiles?.[currentProfileIndex];
  const locationRequired =
    error instanceof FetchError &&
    !!error.data &&
    typeof error.data === 'object' &&
    'code' in error.data &&
    error.data.code === 'LOCATION_REQUIRED';

  const handleLike = async () => {
    if (!currentProfile) return;

    try {
      const result = await likeActionMutation.mutateAsync({
        targetUserId: currentProfile.userId,
        action: 'LIKE',
      });

      if (result.matched && result.matchId && result.matchedUser) {
        setMatchNotification({
          matchId: result.matchId,
          matchedUser: result.matchedUser,
        });
        toast.success("It's a Match!");

        const notificationSettings = localStorage.getItem('notificationSettings');
        const settings = notificationSettings
          ? JSON.parse(notificationSettings)
          : { matchNotifications: true };

        if (permission === 'granted' && settings.matchNotifications) {
          showMatchNotification(result.matchedUser.name, result.matchedUser.photo || undefined);
        }
      }

      if (currentProfileIndex < (profiles?.length ?? 0) - 1) {
        setCurrentProfileIndex((prev) => prev + 1);
      } else {
        setCurrentProfileIndex(0);
        refetch();
      }
    } catch (error) {
      console.error('Failed to like profile:', error);
      toast.error('Failed to like profile. Please try again.');
    }
  };

  const handlePass = async () => {
    if (!currentProfile) return;

    try {
      await likeActionMutation.mutateAsync({
        targetUserId: currentProfile.userId,
        action: 'PASS',
      });

      if (currentProfileIndex < (profiles?.length ?? 0) - 1) {
        setCurrentProfileIndex((prev) => prev + 1);
      } else {
        setCurrentProfileIndex(0);
        refetch();
      }
    } catch (error) {
      console.error('Failed to pass profile:', error);
      toast.error('Failed to pass profile. Please try again.');
    }
  };

  const handleApplyFilters = (newFilters: DiscoverFilters) => {
    setFilters(newFilters);
    setCurrentProfileIndex(0);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-end border-b border-border-main bg-bg-card px-6 py-4">
        <div className="container mx-auto flex justify-end gap-3 px-4 sm:px-6 lg:px-8">
          <FilterPanel filters={filters} onApplyFilters={handleApplyFilters} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center bg-bg-main p-6">
        {isLoading && (
          <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary-main" />
            <p className="text-text-muted">Loading profiles...</p>
          </div>
        )}

        {error && (
          <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4">
            {locationRequired ? (
              <div role="alert" className="flex flex-col items-center gap-3 text-center">
                <p className="text-text-muted">
                  Enable or refresh your location in Settings to use a distance filter.
                </p>
                <Link href="/settings" className="text-primary-main underline">
                  Location settings
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFilters((previous) => ({ ...previous, distance: undefined }))}
                >
                  Remove distance filter
                </Button>
              </div>
            ) : (
              <p role="alert" className="text-error">
                Failed to load profiles
              </p>
            )}
          </div>
        )}

        {!isLoading && !error && profiles && profiles.length === 0 && (
          <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4 text-center">
            <p className="text-xl text-text-heading">No more profiles</p>
            <p className="text-text-muted">Check back later or adjust your filters</p>
          </div>
        )}

        {!isLoading && !error && currentProfile && (
          <div className="relative h-[calc(100vh-200px)] w-full max-w-md">
            <SwipeCard
              key={currentProfile.id}
              profile={currentProfile}
              onLike={handleLike}
              onPass={handlePass}
            />
          </div>
        )}
      </div>

      {/* Match Modal */}
      {matchNotification && (
        <MatchModal
          key={matchNotification.matchId}
          match={matchNotification}
          onClose={() => setMatchNotification(null)}
        />
      )}
    </div>
  );
}
