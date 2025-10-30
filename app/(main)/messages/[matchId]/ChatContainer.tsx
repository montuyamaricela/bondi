"use client"

import { ChatInterface } from "@/app/components/features/messaging/components/ChatInterface"

interface ChatContainerProps {
  matchId: string
  currentUserId: string
  otherUserId: string
}

export function ChatContainer({
  matchId,
  currentUserId,
  otherUserId,
}: ChatContainerProps) {
  return (
    <ChatInterface
      matchId={matchId}
      currentUserId={currentUserId}
      otherUserId={otherUserId}
    />
  )
}
