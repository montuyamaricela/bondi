"use client"

import { formatDistanceToNow } from "date-fns"
import { Check, CheckCheck } from "lucide-react"
import type { Message } from "../types"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const formattedTime = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  })

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isOwnMessage ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
          isOwnMessage
            ? "bg-primary-main text-primary-text rounded-br-sm"
            : "bg-bg-card text-text-body border border-border-main rounded-bl-sm"
        )}
      >
        <p className="text-sm break-all whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-xs",
            isOwnMessage ? "text-primary-text/70" : "text-text-muted"
          )}
        >
          <span>{formattedTime}</span>
          {isOwnMessage && (
            <span className="ml-1">
              {message.readAt ? (
                <CheckCheck className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
