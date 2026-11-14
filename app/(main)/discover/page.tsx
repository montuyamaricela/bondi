'use client';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SwipeCard } from '@/app/components/features/discover/components/SwipeCard';
import { MatchModal } from '@/app/components/features/discover/components/MatchModal';
import { FilterPanel } from '@/app/components/features/discover/components/FilterPanel';
import { useDiscoverProfiles, useLikeActionMutation } from '@/lib/client/discover';
import { useNotifications } from '@/app/components/hooks/useNotifications';
import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { FetchError } from '@/lib/fetch-wrapper';
import type { DiscoverFilters, MatchNotification } from '@/app/components/features/discover/types';

export default function DiscoverPage() {
  const [filters, setFilters] = useState<DiscoverFilters>({
    minAge: 18,
    maxAge: 100,
  });
  const [handledUserIds, setHandledUserIds] = useState<Set<string>>(() => new Set());
  const actionInFlight = useRef(false);
  const [matchNotification, setMatchNotification] = useState<MatchNotification | null>(null);

  const { data: profiles, isLoading, isFetching, error } = useDiscoverProfiles(filters);
  const likeActionMutation = useLikeActionMutation();
  const { showMatchNotification, permission } = useNotifications();
  const currentProfile = profiles?.find((profile) => !handledUserIds.has(profile.userId));
  const waitingForProfiles = isLoading || (!currentProfile && isFetching);
  const locationRequired =
    error instanceof FetchError &&
    !!error.data &&
    typeof error.data === 'object' &&
    'code' in error.data &&
    error.data.code === 'LOCATION_REQUIRED';

  const handleAction = async (action: 'LIKE' | 'PASS') => {
    if (!currentProfile || actionInFlight.current) return;
    const targetUserId = currentProfile.userId;
    actionInFlight.current = true;
    try {
      const result = await likeActionMutation.mutateAsync({ targetUserId, action });
      // A late refetch may still contain this candidate; advance by confirmed identity.
      setHandledUserIds((previous) => new Set([...previous, targetUserId]));
      if (action === 'LIKE' && result.matched && result.matchId && result.matchedUser) {
        setMatchNotification({ matchId: result.matchId, matchedUser: result.matchedUser });
        toast.success("It's a Match!");
        try {
          const notificationSettings = localStorage.getItem('notificationSettings');
          const settings = notificationSettings
            ? JSON.parse(notificationSettings)
            : { matchNotifications: true };
          if (permission === 'granted' && settings.matchNotifications)
            showMatchNotification(result.matchedUser.name, result.matchedUser.photo || undefined);
        } catch {
          // Optional browser feedback cannot turn a committed action into a failed swipe.
          console.error('Could not show match notification');
        }
      }
    } catch {
      toast.error(
        action === 'LIKE'
          ? 'Failed to like profile. Please try again.'
          : 'Failed to pass profile. Please try again.',
      );
    } finally {
      actionInFlight.current = false;
    }
  };

  const handleApplyFilters = (newFilters: DiscoverFilters) => {
    setFilters(newFilters);
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
        {waitingForProfiles && (
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

        {!waitingForProfiles && !error && profiles && !currentProfile && (
          <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4 text-center">
            <p className="text-xl text-text-heading">No more profiles</p>
            <p className="text-text-muted">Check back later or adjust your filters</p>
          </div>
        )}

        {!waitingForProfiles && !error && currentProfile && (
          <div className="relative h-[calc(100vh-200px)] w-full max-w-md">
            <SwipeCard
              key={currentProfile.id}
              profile={currentProfile}
              isPending={likeActionMutation.isPending}
              onLike={() => {
                void handleAction('LIKE');
              }}
              onPass={() => {
                void handleAction('PASS');
              }}
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
