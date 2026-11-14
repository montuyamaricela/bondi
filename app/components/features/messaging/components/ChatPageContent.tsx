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

export function ChatPageContent({ matchId, currentUserId }: ChatPageContentProps) {
  const router = useRouter();
  const { data: match, isLoading, error } = useMatch(matchId);
  const { data: currentUserProfile } = useProfileWithPhotosQuery();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-bg-main">
        <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
      </div>
    );
  }

  if (error || !match) {
    router.push('/messages');
    return null;
  }

  return (
    <div className="container mx-auto flex h-[calc(100vh-10rem)] bg-bg-main px-0 sm:h-[calc(100vh-4rem)] sm:px-6 lg:px-8">
      {/* Left Sidebar - Conversation List (hidden on mobile) */}
      <div className="hidden w-96 flex-col border-r border-border-main bg-bg-card shadow-sm md:flex">
        <div className="sticky top-0 z-10 border-b border-border-main bg-bg-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary-main dark:text-primary-text" />
            <h1 className="text-2xl font-bold text-text-heading">Messages</h1>
          </div>
          <p className="text-sm text-text-muted">Chat with your matches</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList currentUserId={currentUserId} />
        </div>
      </div>

      {/* Right Side - Chat */}
      <div className="flex h-full flex-1 flex-col bg-bg-main">
        <ChatHeader
          name={match.otherUser.name}
          age={match.otherUser.age}
          image={match.otherUser.image}
          userId={match.otherUser.id}
          matchId={matchId}
          isUnmatched={match.status === 'UNMATCHED'}
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
