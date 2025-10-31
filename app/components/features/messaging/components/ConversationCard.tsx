"use client"

import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import type { Conversation } from "../types"
import { cn } from "@/lib/utils"
import { OnlineStatusIndicator } from "@/app/components/ui/custom/OnlineStatusIndicator"

interface ConversationCardProps {
  conversation: Conversation
  currentUserId: string
}

export function ConversationCard({
  conversation,
  currentUserId,
}: ConversationCardProps) {
  const { matchId, otherUser, lastMessage, unreadCount, status } = conversation

  const isOwnMessage = lastMessage?.senderId === currentUserId
  const isUnmatched = status === "UNMATCHED"

  const formattedTime = lastMessage
    ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: true })
    : formatDistanceToNow(new Date(conversation.matchedAt), { addSuffix: true })

  return (
    <Link
      href={`/messages/${matchId}`}
      className="group block hover:bg-primary-main transition-colors"
    >
      <div className="flex items-start gap-4 p-4 border-b border-border-main group-hover:border-white">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-input relative">
            {otherUser.image ? (
              <Image
                src={otherUser.image}
                alt={otherUser.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-main text-primary-text text-xl font-semibold">
                {otherUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0">
            <OnlineStatusIndicator
              userId={otherUser.userId}
              showOnlineStatus={otherUser.showOnlineStatus}
              size="md"
            />
          </div>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-app-accent text-app-accent-text flex items-center justify-center text-xs font-bold">
              {unreadCount}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="font-semibold text-text-heading group-hover:text-white truncate">
              {otherUser.name}
              {otherUser.age && (
                <span className="text-text-muted group-hover:text-white font-normal">, {otherUser.age}</span>
              )}
            </h3>
            <span className="text-xs text-text-muted group-hover:text-white flex-shrink-0">
              {formattedTime}
            </span>
          </div>

          {isUnmatched && (
            <p className="text-xs text-text-muted group-hover:text-white mb-1 italic">Unmatched</p>
          )}
          <p
            className={cn(
              "text-sm truncate group-hover:text-white",
              unreadCount > 0 ? "font-semibold text-text-body" : "text-text-muted"
            )}
          >
            {lastMessage ? (
              <>
                {isOwnMessage && <span className="text-text-muted group-hover:text-white">You: </span>}
                {lastMessage.content}
              </>
            ) : (
              <span className="text-text-muted group-hover:text-white italic">Start a conversation!</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  )
}
