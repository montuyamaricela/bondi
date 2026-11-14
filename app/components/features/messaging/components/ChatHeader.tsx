'use client';

import { useState } from 'react';
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
import { useOnlineStatus } from '../useOnlineStatus';
import { useRealtime } from '@/app/components/providers/realtime-provider';

interface ChatHeaderProps {
  name: string;
  age: number | null;
  image: string | null;
  userId: string;
  matchId: string;
  isUnmatched?: boolean;
}

export function ChatHeader({
  name,
  age,
  image,
  userId,
  matchId,
  isUnmatched = false,
}: ChatHeaderProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { enabled: native } = useRealtime();
  const presence = useOnlineStatus(userId, !isUnmatched);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUnmatchModalOpen, setIsUnmatchModalOpen] = useState(false);
  const unmatchMutation = useUnmatchMutation();

  const handleUnmatchClick = () => {
    setIsDropdownOpen(false);
    setIsUnmatchModalOpen(true);
  };

  const handleUnmatchConfirm = async () => {
    try {
      await unmatchMutation.mutateAsync(matchId);
      toast.success(`You've unmatched with ${name}`);
      setIsUnmatchModalOpen(false);
      if (!native && socket && isConnected) socket.emit('match:leave', { matchId });
    } catch {
      toast.error('Failed to unmatch. Please try again.');
    }
  };

  const handleViewProfile = () => {
    router.push(`/profile/${userId}`);
  };

  return (
    <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-border-main bg-bg-card p-4 shadow-sm">
      <Link
        href="/messages"
        className="-ml-2 rounded-lg p-2 text-text-muted transition-all duration-200 hover:bg-bg-hover hover:text-text-heading"
        aria-label="Back to messages"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <button
        onClick={handleViewProfile}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition-opacity hover:opacity-80"
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-bg-input ring-2 ring-border-main transition-all duration-200 hover:ring-primary-main">
          {image ? (
            <Image src={image} alt={name} fill className="object-cover" sizes="48px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-main text-xl font-semibold text-primary-text">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-text-heading">
            {name}
            {age && <span className="font-normal text-text-muted">, {age}</span>}
          </h2>
          {presence.visible && (
            <div className="flex items-center gap-1.5">
              {presence.online && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              )}
              <p className="text-xs text-text-muted">
                {presence.online ? 'Active now' : 'Offline'}
              </p>
            </div>
          )}
          {presence.unavailable && (
            <p role="status" className="text-xs text-text-muted">
              Online status unavailable
            </p>
          )}
        </div>
      </button>

      {presence.unavailable && (
        <button type="button" className="text-xs underline" onClick={presence.retry}>
          Retry status
        </button>
      )}

      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-lg p-2 text-text-muted transition-all duration-200 hover:bg-bg-hover hover:text-text-heading"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-border-main bg-bg-card">
          <DropdownMenuItem onClick={handleViewProfile} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            View Profile
          </DropdownMenuItem>
          {!isUnmatched && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleUnmatchClick}
                variant="destructive"
                className="cursor-pointer"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Unmatch
              </DropdownMenuItem>
            </>
          )}
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
