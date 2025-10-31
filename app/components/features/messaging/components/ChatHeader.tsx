'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, User, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/app/components/providers/socket-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import { useUnmatchMutation } from '@/app/components/features/matching/hooks';
import { UnmatchModal } from '@/app/components/features/messaging/components/UnmatchModal';

interface ChatHeaderProps {
  name: string;
  age: number | null;
  image: string | null;
  userId: string;
  matchId: string;
  showOnlineStatus?: boolean;
}

export function ChatHeader({
  name,
  age,
  image,
  userId,
  matchId,
  showOnlineStatus = true,
}: ChatHeaderProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [isOnline, setIsOnline] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUnmatchModalOpen, setIsUnmatchModalOpen] = useState(false);
  const unmatchMutation = useUnmatchMutation();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleUserOnline = (data: { userId: string }) => {
      if (data.userId === userId) {
        setIsOnline(true);
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      if (data.userId === userId) {
        setIsOnline(false);
      }
    };

    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    return () => {
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, [socket, isConnected, userId]);

  const handleUnmatchClick = () => {
    setIsDropdownOpen(false);
    setIsUnmatchModalOpen(true);
  };

  const handleUnmatchConfirm = async () => {
    try {
      await unmatchMutation.mutateAsync(matchId);
      toast.success(`You've unmatched with ${name}`);
      setIsUnmatchModalOpen(false);
      router.push('/messages');
    } catch {
      toast.error('Failed to unmatch. Please try again.');
    }
  };

  const handleViewProfile = () => {
    router.push(`/profile/${userId}`);
  };

  return (
    <div className='flex items-center gap-4 p-4 border-b border-border-main bg-bg-card shadow-sm sticky top-0 z-20'>
      <Link
        href='/messages'
        className='text-text-muted hover:text-text-heading hover:bg-bg-hover rounded-lg p-2 -ml-2 transition-all duration-200'
        aria-label='Back to messages'
      >
        <ArrowLeft className='w-5 h-5' />
      </Link>

      <button
        onClick={handleViewProfile}
        className='flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer'
      >
        <div className='w-12 h-12 rounded-full overflow-hidden bg-bg-input shrink-0 relative ring-2 ring-border-main hover:ring-primary-main transition-all duration-200'>
          {image ? (
            <Image
              src={image}
              alt={name}
              fill
              className='object-cover'
              sizes='48px'
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center bg-primary-main text-primary-text text-xl font-semibold'>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <h2 className='font-semibold text-text-heading text-lg truncate'>
            {name}
            {age && (
              <span className='text-text-muted font-normal'>, {age}</span>
            )}
          </h2>
          {showOnlineStatus && (
            <div className='flex items-center gap-1.5'>
              {isOnline && (
                <span className='w-2 h-2 rounded-full bg-success animate-pulse' />
              )}
              <p className='text-xs text-text-muted'>
                {isOnline ? 'Active now' : 'Offline'}
              </p>
            </div>
          )}
        </div>
      </button>

      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className='text-text-muted hover:text-text-heading hover:bg-bg-hover rounded-lg p-2 transition-all duration-200'
            aria-label='More options'
          >
            <MoreVertical className='w-5 h-5' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='w-56 bg-bg-card border-border-main'
        >
          <DropdownMenuItem
            onClick={handleViewProfile}
            className='cursor-pointer'
          >
            <User className='w-4 h-4 mr-2' />
            View Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleUnmatchClick}
            variant='destructive'
            className='cursor-pointer'
          >
            <AlertTriangle className='w-4 h-4 mr-2' />
            Unmatch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UnmatchModal
        open={isUnmatchModalOpen}
        onOpenChange={setIsUnmatchModalOpen}
        onConfirm={handleUnmatchConfirm}
        userName={name}
        isLoading={unmatchMutation.isPending}
      />
    </div>
  );
}
