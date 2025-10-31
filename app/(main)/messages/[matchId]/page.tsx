import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/session';
import { ChatPageContent } from '../../../components/features/messaging/components/ChatPageContent';

interface ChatPageProps {
  params: Promise<{ matchId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const headersList = await headers();
  const session = await getServerSession(headersList);

  if (!session?.user) {
    redirect('/login');
  }

  const { matchId } = await params;

  return <ChatPageContent matchId={matchId} currentUserId={session.user.id} />;
}
