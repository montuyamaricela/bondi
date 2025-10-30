"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useMatches } from "../hooks"

export function MatchesList() {
  const { data: matchesData, isLoading, error } = useMatches()

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
        <Link
          key={match.matchId}
          href={`/messages/${match.matchId}`}
          className="bg-bg-card border border-border-main rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-primary-main group"
        >
          <div className="aspect-[3/4] relative overflow-hidden bg-bg-hover">
            <img
              src={match.user.image}
              alt={match.user.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="p-4">
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
          </div>
        </Link>
      ))}
    </div>
  )
}
