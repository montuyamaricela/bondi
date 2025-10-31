"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, UserX } from "lucide-react"
import { useMatches, useUnmatchMutation } from "../hooks"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"

export function MatchesList() {
  const { data: matchesData, isLoading, error } = useMatches()
  const { mutate: unmatch, isPending } = useUnmatchMutation()
  const [confirmingUnmatch, setConfirmingUnmatch] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-main" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-bg-card border border-border-main rounded-lg p-12 text-center">
        <p className="text-error text-lg">Failed to load matches</p>
        <p className="text-text-muted mt-2">Please try again later</p>
      </div>
    )
  }

  const handleUnmatch = (matchId: string, userName: string) => {
    unmatch(matchId, {
      onSuccess: () => {
        toast.success(`Unmatched with ${userName}`)
        setConfirmingUnmatch(null)
      },
      onError: () => {
        toast.error("Failed to unmatch")
      },
    })
  }

  if (!matchesData || matchesData.length === 0) {
    return (
      <div className="bg-bg-card border border-border-main rounded-lg p-12 text-center">
        <p className="text-text-muted text-lg">No matches yet</p>
        <p className="text-text-muted mt-2">
          Start swiping in{" "}
          <Link href="/discover" className="text-primary-main hover:underline">
            Discover
          </Link>{" "}
          to find your matches!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {matchesData.map((match) => (
        <div
          key={match.matchId}
          className="bg-bg-card border border-border-main rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group"
        >
          <Link href={`/messages/${match.matchId}`}>
            <div className="aspect-[3/4] relative overflow-hidden bg-bg-hover">
              <img
                src={match.user.image}
                alt={match.user.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </Link>
          <div className="p-4">
            <Link href={`/messages/${match.matchId}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-xl font-semibold text-text-heading">
                  {match.user.name}
                </h3>
                {match.user.age && (
                  <span className="text-text-body">{match.user.age}</span>
                )}
              </div>
              {match.user.bio && (
                <p className="text-text-muted text-sm line-clamp-2">
                  {match.user.bio}
                </p>
              )}
              <p className="text-text-muted text-xs mt-3">
                Matched {new Date(match.matchedAt).toLocaleDateString()}
              </p>
            </Link>

            <div className="mt-4 pt-4 border-t border-border-main">
              {confirmingUnmatch === match.matchId ? (
                <div className="space-y-2">
                  <p className="text-sm text-text-muted">
                    Remove chat access? (Chat history stays)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmingUnmatch(null)}
                      className="flex-1"
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUnmatch(match.matchId, match.user.name)}
                      className="flex-1 bg-error hover:bg-error/90 text-white"
                      disabled={isPending}
                    >
                      {isPending ? "Unmatching..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingUnmatch(match.matchId)}
                  className="w-full text-error border-error hover:bg-error/10"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Unmatch
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
