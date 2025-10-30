'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useMatch } from '@/app/components/features/matching/hooks';
import { ConversationList } from '../ConversationList';
import { ChatHeader } from './ChatHeader';
import { ChatContainer } from './ChatContainer';

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

  if (isLoading) {
    return (
      <div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-primary-main' />
      </div>
    );
  }

  if (error || !match) {
    router.push('/messages');
    return null;
  }

  return (
    <div className='flex'>
      {/* Left Sidebar - Conversation List */}
      <div className='w-96 border-r border-border-main bg-bg-card flex flex-col'>
        <div className='p-4 border-b border-border-main'>
          <h1 className='text-2xl font-bold text-text-heading'>Messages</h1>
          <p className='text-text-muted text-sm mt-1'>Chat with your matches</p>
        </div>
        <div className='flex-1 overflow-y-auto'>
          <ConversationList currentUserId={currentUserId} />
        </div>
      </div>

      {/* Right Side - Chat */}
      <div className='flex-1 flex flex-col bg-bg-main h-screen'>
        <ChatHeader
          name={match.otherUser.name}
          age={match.otherUser.age}
          image={match.otherUser.image}
          userId={match.otherUser.id}
        />
        <ChatContainer
          matchId={matchId}
          currentUserId={currentUserId}
          otherUserId={match.otherUser.id}
        />
      </div>
    </div>
  );
}
