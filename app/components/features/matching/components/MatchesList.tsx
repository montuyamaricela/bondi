'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, UserX } from 'lucide-react';
import { useMatches, useUnmatchMutation } from '../hooks';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { getInitials } from '@/lib/utils/initials';

export function MatchesList() {
  const { data: matchesData, isLoading, error } = useMatches();
  const { mutate: unmatch, isPending } = useUnmatchMutation();
  const [confirmingUnmatch, setConfirmingUnmatch] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-bg-card p-12 text-center shadow-md">
        <p className="text-lg text-error">Failed to load matches</p>
        <p className="mt-2 text-text-muted">Please try again later</p>
      </div>
    );
  }

  const handleUnmatch = (matchId: string, userName: string) => {
    unmatch(matchId, {
      onSuccess: () => {
        toast.success(`Unmatched with ${userName}`);
        setConfirmingUnmatch(null);
      },
      onError: () => {
        toast.error('Failed to unmatch');
      },
    });
  };

  if (!matchesData || matchesData.length === 0) {
    return (
      <div className="rounded-lg bg-bg-card p-12 text-center shadow-md">
        <p className="text-lg text-text-muted">No matches yet</p>
        <p className="mt-2 text-text-muted">
          Start swiping in{' '}
          <Link href="/discover" className="text-primary-main hover:underline">
            Discover
          </Link>{' '}
          to find your matches!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {matchesData.map((match) => (
        <div
          key={match.matchId}
          className="overflow-hidden rounded-lg border bg-bg-card shadow-md transition-all hover:shadow-xl"
        >
          <div className="relative aspect-4/3 overflow-hidden bg-bg-hover">
            {match.user.image ? (
              <Image
                src={match.user.image}
                alt={match.user.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-main">
                <span className="text-6xl font-bold text-primary-text">
                  {getInitials(match.user.name)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-xl font-semibold text-text-heading">{match.user.name}</h3>
              {match.user.age && <span className="text-text-body">{match.user.age}</span>}
            </div>
            <p className="mb-3 line-clamp-2 min-h-10 text-sm text-text-muted">
              {match.user.bio || '\u00A0'}
            </p>
            <div className="mb-3 flex min-h-7 flex-wrap gap-1">
              {match.user.interests &&
                match.user.interests.length > 0 &&
                match.user.interests.slice(0, 3).map((interest, index) => (
                  <span
                    key={index}
                    className="flex items-center justify-center rounded-full bg-primary-main/10 px-2 py-1 text-xs text-primary-main dark:bg-text-muted/10 dark:text-text-muted"
                  >
                    {interest}
                  </span>
                ))}
            </div>

            <div className="flex gap-2 border-t border-border-main pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmingUnmatch(match.matchId)}
                disabled={isPending || confirmingUnmatch === match.matchId}
                className="flex-1 border border-border-main text-text-muted hover:bg-bg-hover"
              >
                <UserX className="mr-2 h-4 w-4" />
                Unmatch
              </Button>
              <Button
                size="sm"
                asChild
                className="flex-1 bg-primary-main text-white hover:bg-primary-hover"
              >
                <Link href={`/messages/${match.matchId}`}>Message</Link>
              </Button>
            </div>

            {confirmingUnmatch === match.matchId && (
              <div className="mt-3 space-y-2 rounded-lg bg-bg-hover p-3">
                <p className="text-sm text-text-muted">Remove chat access? (Chat history stays)</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmingUnmatch(null)}
                    className="flex-1"
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUnmatch(match.matchId, match.user.name)}
                    className="flex-1 bg-primary-main text-white hover:bg-primary-hover"
                    disabled={isPending}
                  >
                    {isPending ? 'Unmatching...' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
