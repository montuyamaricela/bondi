import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { MessageCircle, Sparkles } from 'lucide-react';
import { getServerSession } from '@/lib/session';
import { ConversationList } from '../../components/features/messaging/components/ConversationList';

export default async function MessagesPage() {
  const headersList = await headers();
  const session = await getServerSession(headersList);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto flex flex-col bg-bg-main px-0 sm:h-[calc(100vh-4rem)] sm:px-6 md:flex-row lg:px-8">
      {/* Left Sidebar - Conversation List */}
      <div className="flex w-full flex-col border-r border-border-main bg-bg-card shadow-sm md:w-96">
        <div className="sticky top-0 z-10 border-b border-border-main bg-bg-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary-main" />
            <h1 className="text-2xl font-bold text-text-heading">Messages</h1>
          </div>
          <p className="text-sm text-text-muted">Chat with your matches</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList currentUserId={session.user.id} />
        </div>
      </div>

      {/* Right Side - Empty State (Select a conversation) */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-bg-main md:flex">
        <div className="relative z-10 max-w-md px-4 text-center">
          <div className="relative mb-6 inline-block">
            <MessageCircle className="h-24 w-24 text-text-muted opacity-20 dark:text-primary-text" />
            <Sparkles className="absolute -top-2 -right-2 h-8 w-8 animate-pulse text-primary-main dark:text-primary-text" />
          </div>

          <h2 className="mb-3 text-3xl font-bold text-text-heading">Select a conversation</h2>
          <p className="text-lg leading-relaxed text-text-muted">
            Choose a conversation from the list to start chatting with your matches
          </p>

          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-text-muted">
            <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <span>Your matches are waiting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
