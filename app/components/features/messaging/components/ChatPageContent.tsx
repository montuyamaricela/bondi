'use client';

import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle } from 'lucide-react';
import { useMatch } from '@/app/components/features/matching/hooks';
import { useProfileWithPhotosQuery } from '@/lib/client/profile';
import { ConversationList } from './ConversationList';
import { ChatHeader } from './ChatHeader';
import { ChatInterface } from '@/app/components/features/messaging/components/ChatInterface';

interface ChatPageContentProps {
  matchId: string;
  currentUserId: string;
}

export function ChatPageContent({
  matchId,
  currentUserId,
}: ChatPageContentProps) {
  const router = useRouter();
  const { data: match, isLoading, error } = useMatch(matchId);
  const { data: currentUserProfile } = useProfileWithPhotosQuery();

  if (isLoading) {
    return (
      <div className='h-[calc(100vh-4rem)] flex items-center justify-center bg-bg-main'>
        <Loader2 className='w-8 h-8 animate-spin text-primary-main' />
      </div>
    );
  }

  if (error || !match) {
    router.push('/messages');
    return null;
  }

  return (
    <div className='h-[calc(100vh-4rem)] container mx-auto px-4 sm:px-6 lg:px-8 flex bg-bg-main'>
      {/* Left Sidebar - Conversation List (hidden on mobile) */}
      <div className='hidden md:flex w-96 border-r border-border-main bg-bg-card flex-col shadow-sm'>
        <div className='p-4 border-b border-border-main bg-bg-card sticky top-0 z-10'>
          <div className='flex items-center gap-2 mb-1'>
            <MessageCircle className='w-6 h-6 text-primary-main dark:text-primary-text' />
            <h1 className='text-2xl font-bold text-text-heading'>Messages</h1>
          </div>
          <p className='text-text-muted text-sm'>Chat with your matches</p>
        </div>
        <div className='flex-1 overflow-hidden'>
          <ConversationList currentUserId={currentUserId} />
        </div>
      </div>

      {/* Right Side - Chat */}
      <div className='flex-1 flex flex-col bg-bg-main h-full'>
        <ChatHeader
          name={match.otherUser.name}
          age={match.otherUser.age}
          image={match.otherUser.image}
          userId={match.otherUser.id}
          matchId={matchId}
          showOnlineStatus={match.otherUser.showOnlineStatus}
        />
        <ChatInterface
          matchId={matchId}
          currentUserId={currentUserId}
          otherUserId={match.otherUser.id}
          otherUserImage={match.otherUser.image}
          otherUserName={match.otherUser.name}
          currentUserImage={currentUserProfile?.profile?.photos?.[0]?.url}
          currentUserName={currentUserProfile?.profile?.name}
          isUnmatched={match.status === 'UNMATCHED'}
        />
      </div>
    </div>
  );
}
