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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-bg-card p-12 text-center shadow-md">
        <p className="text-lg text-error">Failed to load likes</p>
        <p className="mt-2 text-text-muted">Please try again later</p>
      </div>
    );
  }

  const handleAction = async (userId: string, action: 'LIKE' | 'PASS', userName: string) => {
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
    } catch {
      toast.error(`Failed to ${action === 'LIKE' ? 'like' : 'pass'}`);
      setActingOnUser(null);
    }
  };

  if (!likedByUsers || likedByUsers.length === 0) {
    return (
      <div className="rounded-lg bg-bg-card p-12 text-center">
        <p className="text-lg text-text-muted">No one has liked you yet</p>
        <p className="mt-2 text-text-muted">
          Keep swiping in{' '}
          <Link
            href="/discover"
            className="text-primary-main hover:underline dark:text-primary-text"
          >
            Discover
          </Link>{' '}
          to get more matches!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {likedByUsers.map((user) => (
        <div
          key={user.userId}
          className="overflow-hidden rounded-lg border bg-bg-card shadow-md transition-all hover:shadow-xl"
        >
          <div className="relative aspect-4/3 overflow-hidden bg-bg-hover">
            {user.photos.length > 0 ? (
              <Image
                src={user.photos[0].url}
                alt={user.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-main">
                <span className="text-6xl font-bold text-primary-text">
                  {getInitials(user.name)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-xl font-semibold text-text-heading">{user.name}</h3>
              {user.age && <span className="text-text-body">{user.age}</span>}
            </div>
            <p className="mb-3 line-clamp-2 min-h-10 text-sm text-text-muted">
              {user.bio || '\u00A0'}
            </p>
            <div className="mb-3 flex min-h-7 flex-wrap gap-1">
              {user.interests &&
                user.interests.length > 0 &&
                user.interests.slice(0, 3).map((interest, index) => (
                  <span
                    key={index}
                    className="flex items-center justify-center rounded-full bg-primary-main/10 px-2 py-1 text-xs text-primary-main"
                  >
                    {interest}
                  </span>
                ))}
            </div>

            <div className="mt-4 flex gap-2 border-t border-border-main pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(user.userId, 'PASS', user.name)}
                disabled={likeActionMutation.isPending && actingOnUser === user.userId}
                className="flex-1 border border-border-main text-text-muted hover:bg-primary-main/20 hover:text-primary-main"
              >
                <X className="mr-2 h-4 w-4" />
                Pass
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction(user.userId, 'LIKE', user.name)}
                disabled={likeActionMutation.isPending && actingOnUser === user.userId}
                className="flex-1 bg-primary-main text-white hover:bg-primary-hover"
              >
                <Heart className="mr-2 h-4 w-4" />
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
