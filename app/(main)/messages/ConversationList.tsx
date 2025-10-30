"use client"

import { Loader2, MessageCircle } from "lucide-react"
import { useConversations } from "@/app/components/features/messaging/hooks"
import { ConversationCard } from "@/app/components/features/messaging/components/ConversationCard"

interface ConversationListProps {
  currentUserId: string
}

export function ConversationList({ currentUserId }: ConversationListProps) {
  const { data: conversations = [], isLoading, error } = useConversations()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-main" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <p className="text-error font-semibold mb-2">Failed to load conversations</p>
        <p className="text-text-muted text-sm">Please try again later</p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <MessageCircle className="w-16 h-16 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-heading mb-2">
          No conversations yet
        </h3>
        <p className="text-text-muted max-w-sm">
          Start swiping and matching with people to begin chatting!
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border-main">
      {conversations.map((conversation) => (
        <ConversationCard
          key={conversation.matchId}
          conversation={conversation}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}
