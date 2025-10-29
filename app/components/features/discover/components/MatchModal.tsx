"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Heart, MessageCircle, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import type { MatchNotification } from "../types"

interface MatchModalProps {
  match: MatchNotification | null
  onClose: () => void
}

export function MatchModal({ match, onClose }: MatchModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (match) {
      setIsOpen(true)
    }
  }, [match])

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(onClose, 300)
  }

  const handleSendMessage = () => {
    if (match) {
      router.push(`/messages/${match.matchId}`)
    }
  }

  if (!match) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">It&apos;s a Match!</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Match Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <Heart className="h-20 w-20 fill-primary-main text-primary-main animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-text-heading">
              It&apos;s a Match!
            </h2>
            <p className="mt-2 text-text-body">
              You and {match.matchedUser.name} liked each other
            </p>
          </div>

          {/* Profile Photo */}
          <div className="flex justify-center">
            <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-primary-main">
              {match.matchedUser.photo ? (
                <Image
                  src={match.matchedUser.photo}
                  alt={match.matchedUser.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-bg-hover">
                  <span className="text-4xl font-bold text-text-muted">
                    {match.matchedUser.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Keep Swiping
            </Button>
            <Button
              onClick={handleSendMessage}
              className="flex-1 bg-primary-main text-primary-text hover:bg-primary-hover"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
