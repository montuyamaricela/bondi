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
    <div className='sm:h-[calc(100vh-4rem)] container mx-auto px-0 sm:px-6 lg:px-8 flex flex-col md:flex-row bg-bg-main '>
      {/* Left Sidebar - Conversation List */}
      <div className='w-full md:w-96 border-r border-border-main bg-bg-card flex flex-col shadow-sm'>
        <div className='p-4 border-b border-border-main bg-bg-card sticky top-0 z-10'>
          <div className='flex items-center gap-2 mb-1'>
            <MessageCircle className='w-6 h-6 text-primary-main' />
            <h1 className='text-2xl font-bold text-text-heading'>Messages</h1>
          </div>
          <p className='text-text-muted text-sm'>Chat with your matches</p>
        </div>
        <div className='flex-1 overflow-hidden'>
          <ConversationList currentUserId={session.user.id} />
        </div>
      </div>

      {/* Right Side - Empty State (Select a conversation) */}
      <div className='hidden md:flex flex-1 items-center justify-center bg-bg-main relative overflow-hidden'>
        <div className='text-center px-4 relative z-10 max-w-md'>
          <div className='relative inline-block mb-6'>
            <MessageCircle className='w-24 h-24 text-text-muted opacity-20 dark:text-primary-text' />
            <Sparkles className='w-8 h-8 text-primary-main absolute -top-2 -right-2 animate-pulse dark:text-primary-text' />
          </div>

          <h2 className='text-3xl font-bold text-text-heading mb-3'>
            Select a conversation
          </h2>
          <p className='text-text-muted text-lg leading-relaxed'>
            Choose a conversation from the list to start chatting with your
            matches
          </p>

          <div className='mt-1 flex items-center justify-center gap-2 text-sm text-text-muted'>
            <div className='w-2 h-2 rounded-full bg-success animate-pulse' />
            <span>Your matches are waiting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
