'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, UserX } from 'lucide-react';
import { useMatches, useUnmatchMutation } from '../hooks';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { formatMatchDate } from '@/lib/date-utils';
import { getInitials } from '@/lib/utils/initials';

export function MatchesList() {
  const { data: matchesData, isLoading, error } = useMatches();
  const { mutate: unmatch, isPending } = useUnmatchMutation();
  const [confirmingUnmatch, setConfirmingUnmatch] = useState<string | null>(
    null
  );

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-12'>
        <Loader2 className='w-8 h-8 animate-spin text-primary-main' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-bg-card rounded-lg p-12 text-center shadow-md'>
        <p className='text-error text-lg'>Failed to load matches</p>
        <p className='text-text-muted mt-2'>Please try again later</p>
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
      <div className='bg-bg-card rounded-lg p-12 text-center shadow-md'>
        <p className='text-text-muted text-lg'>No matches yet</p>
        <p className='text-text-muted mt-2'>
          Start swiping in{' '}
          <Link href='/discover' className='text-primary-main hover:underline'>
            Discover
          </Link>{' '}
          to find your matches!
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
      {matchesData.map((match) => (
        <div
          key={match.matchId}
          className='bg-bg-card border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all'
        >
          <div className='aspect-4/3 relative overflow-hidden bg-bg-hover'>
            {match.user.image ? (
              <Image
                src={match.user.image}
                alt={match.user.name}
                fill
                className='object-cover'
                sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              />
            ) : (
              <div className='w-full h-full bg-primary-main flex items-center justify-center'>
                <span className='text-6xl font-bold text-primary-text'>
                  {getInitials(match.user.name)}
                </span>
              </div>
            )}
          </div>
          <div className='p-4 flex flex-col'>
            <div className='flex items-baseline gap-2 mb-2'>
              <h3 className='text-xl font-semibold text-text-heading'>
                {match.user.name}
              </h3>
              {match.user.age && (
                <span className='text-text-body'>{match.user.age}</span>
              )}
            </div>
            <p className='text-text-muted text-sm line-clamp-2 mb-3 min-h-10'>
              {match.user.bio || '\u00A0'}
            </p>
            <div className='flex flex-wrap gap-1 mb-3 min-h-7'>
              {match.user.interests &&
                match.user.interests.length > 0 &&
                match.user.interests.slice(0, 3).map((interest, index) => (
                  <span
                    key={index}
                    className='text-xs bg-primary-main/10 text-primary-main px-2 flex items-center justify-center py-1 rounded-full dark:bg-text-muted/10 dark:text-text-muted'
                  >
                    {interest}
                  </span>
                ))}
            </div>

            <div className=' pt-4 border-t border-border-main flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setConfirmingUnmatch(match.matchId)}
                disabled={isPending || confirmingUnmatch === match.matchId}
                className='flex-1 text-text-muted border border-border-main hover:bg-bg-hover'
              >
                <UserX className='h-4 w-4 mr-2' />
                Unmatch
              </Button>
              <Button
                size='sm'
                asChild
                className='flex-1 bg-primary-main hover:bg-primary-hover text-white'
              >
                <Link href={`/messages/${match.matchId}`}>Message</Link>
              </Button>
            </div>

            {confirmingUnmatch === match.matchId && (
              <div className='mt-3 p-3 bg-bg-hover rounded-lg space-y-2'>
                <p className='text-sm text-text-muted'>
                  Remove chat access? (Chat history stays)
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setConfirmingUnmatch(null)}
                    className='flex-1'
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size='sm'
                    onClick={() =>
                      handleUnmatch(match.matchId, match.user.name)
                    }
                    className='flex-1 bg-primary-main hover:bg-primary-hover text-white'
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
