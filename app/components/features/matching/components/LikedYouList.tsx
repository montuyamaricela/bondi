'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Heart, X } from 'lucide-react';
import { useReceivedLikes } from '../hooks';
import { useLikeActionMutation } from '@/lib/client/discover';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { getInitials } from '@/lib/utils/initials';

export function LikedYouList() {
  const { data: likedByUsers, isLoading, error } = useReceivedLikes();
  const likeActionMutation = useLikeActionMutation();
  const [actingOnUser, setActingOnUser] = useState<string | null>(null);

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
        <p className='text-error text-lg'>Failed to load likes</p>
        <p className='text-text-muted mt-2'>Please try again later</p>
      </div>
    );
  }

  const handleAction = async (
    userId: string,
    action: 'LIKE' | 'PASS',
    userName: string
  ) => {
    setActingOnUser(userId);
    try {
      const response = await likeActionMutation.mutateAsync({
        targetUserId: userId,
        action,
      });

      if (action === 'LIKE') {
        if (response.matched) {
          toast.success(`It's a Match! 🎉 You matched with ${userName}`);
        } else {
          toast.success(`Liked ${userName}`);
        }
      } else {
        toast.success(`Passed on ${userName}`);
      }
      setActingOnUser(null);
    } catch (error) {
      toast.error(`Failed to ${action === 'LIKE' ? 'like' : 'pass'}`);
      setActingOnUser(null);
    }
  };

  if (!likedByUsers || likedByUsers.length === 0) {
    return (
      <div className='bg-bg-card rounded-lg p-12 text-center '>
        <p className='text-text-muted text-lg'>No one has liked you yet</p>
        <p className='text-text-muted mt-2'>
          Keep swiping in{' '}
          <Link
            href='/discover'
            className='text-primary-main hover:underline dark:text-primary-text'
          >
            Discover
          </Link>{' '}
          to get more matches!
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
      {likedByUsers.map((user) => (
        <div
          key={user.userId}
          className='bg-bg-card border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all'
        >
          <div className='aspect-4/3 relative overflow-hidden bg-bg-hover'>
            {user.photos.length > 0 ? (
              <Image
                src={user.photos[0].url}
                alt={user.name}
                fill
                className='object-cover'
                sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              />
            ) : (
              <div className='w-full h-full bg-primary-main flex items-center justify-center'>
                <span className='text-6xl font-bold text-primary-text'>
                  {getInitials(user.name)}
                </span>
              </div>
            )}
          </div>
          <div className='p-4 flex flex-col'>
            <div className='flex items-baseline gap-2 mb-2'>
              <h3 className='text-xl font-semibold text-text-heading'>
                {user.name}
              </h3>
              {user.age && <span className='text-text-body'>{user.age}</span>}
            </div>
            <p className='text-text-muted text-sm line-clamp-2 mb-3 min-h-10'>
              {user.bio || '\u00A0'}
            </p>
            <div className='flex flex-wrap gap-1 mb-3 min-h-7'>
              {user.interests &&
                user.interests.length > 0 &&
                user.interests.slice(0, 3).map((interest, index) => (
                  <span
                    key={index}
                    className='text-xs bg-primary-main/10 text-primary-main px-2 py-1 flex items-center justify-center rounded-full'
                  >
                    {interest}
                  </span>
                ))}
            </div>

            <div className='mt-4 pt-4 border-t border-border-main flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => handleAction(user.userId, 'PASS', user.name)}
                disabled={
                  likeActionMutation.isPending && actingOnUser === user.userId
                }
                className='flex-1 text-text-muted border border-border-main hover:bg-primary-main/20 hover:text-primary-main'
              >
                <X className='h-4 w-4 mr-2' />
                Pass
              </Button>
              <Button
                size='sm'
                onClick={() => handleAction(user.userId, 'LIKE', user.name)}
                disabled={
                  likeActionMutation.isPending && actingOnUser === user.userId
                }
                className='flex-1 bg-primary-main hover:bg-primary-hover text-white'
              >
                <Heart className='h-4 w-4 mr-2' />
                {likeActionMutation.isPending && actingOnUser === user.userId
                  ? 'Liking...'
                  : 'Like Back'}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
