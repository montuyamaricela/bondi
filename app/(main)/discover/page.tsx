"use client"

import { useState, useEffect } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { SwipeCard } from "@/app/components/features/discover/components/SwipeCard"
import { MatchModal } from "@/app/components/features/discover/components/MatchModal"
import { FilterPanel } from "@/app/components/features/discover/components/FilterPanel"
import { Button } from "@/app/components/ui/button"
import { useDiscoverProfiles, useLikeActionMutation } from "@/lib/client/discover"
import { useNotifications } from "@/app/components/hooks/useNotifications"
import type {
  DiscoverFilters,
  MatchNotification,
} from "@/app/components/features/discover/types"

export default function DiscoverPage() {
  const [filters, setFilters] = useState<DiscoverFilters>({
    minAge: 18,
    maxAge: 100,
    genderPreference: "EVERYONE",
  })
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0)
  const [matchNotification, setMatchNotification] =
    useState<MatchNotification | null>(null)

  const { data: profiles, isLoading, error, refetch } = useDiscoverProfiles(filters)
  const likeActionMutation = useLikeActionMutation()
  const { showMatchNotification, permission } = useNotifications()

  const currentProfile = profiles?.[currentProfileIndex]

  useEffect(() => {
    setCurrentProfileIndex(0)
  }, [profiles])

  const handleLike = async () => {
    if (!currentProfile) return

    try {
      const result = await likeActionMutation.mutateAsync({
        targetUserId: currentProfile.userId,
        action: "LIKE",
      })

      if (result.matched && result.matchId && result.matchedUser) {
        setMatchNotification({
          matchId: result.matchId,
          matchedUser: result.matchedUser,
        })
        toast.success("It's a Match!")

        const notificationSettings = localStorage.getItem('notificationSettings')
        const settings = notificationSettings ? JSON.parse(notificationSettings) : { matchNotifications: true }

        if (permission === 'granted' && settings.matchNotifications) {
          showMatchNotification(
            result.matchedUser.name,
            result.matchedUser.photo || undefined
          )
        }
      }

      if (currentProfileIndex < (profiles?.length ?? 0) - 1) {
        setCurrentProfileIndex((prev) => prev + 1)
      } else {
        refetch()
      }
    } catch (error) {
      console.error("Failed to like profile:", error)
      toast.error("Failed to like profile. Please try again.")
    }
  }

  const handlePass = async () => {
    if (!currentProfile) return

    try {
      await likeActionMutation.mutateAsync({
        targetUserId: currentProfile.userId,
        action: "PASS",
      })

      if (currentProfileIndex < (profiles?.length ?? 0) - 1) {
        setCurrentProfileIndex((prev) => prev + 1)
      } else {
        refetch()
      }
    } catch (error) {
      console.error("Failed to pass profile:", error)
      toast.error("Failed to pass profile. Please try again.")
    }
  }

  const handleApplyFilters = (newFilters: DiscoverFilters) => {
    setFilters(newFilters)
    setCurrentProfileIndex(0)
  }

  const handleRefresh = () => {
    setCurrentProfileIndex(0)
    refetch()
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-main bg-bg-card px-6 py-4">
        <h1 className="text-2xl font-bold text-text-heading">Discover</h1>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <FilterPanel filters={filters} onApplyFilters={handleApplyFilters} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center bg-bg-main p-6">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary-main" />
            <p className="text-text-muted">Loading profiles...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-error">Failed to load profiles</p>
            <Button onClick={handleRefresh}>Try Again</Button>
          </div>
        )}

        {!isLoading && !error && profiles && profiles.length === 0 && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-xl text-text-heading">No more profiles</p>
            <p className="text-text-muted">
              Check back later or adjust your filters
            </p>
            <Button onClick={handleRefresh}>Refresh</Button>
          </div>
        )}

        {!isLoading && !error && currentProfile && (
          <div className="relative h-[calc(100vh-200px)] w-full max-w-md">
            <SwipeCard
              key={currentProfile.id}
              profile={currentProfile}
              onLike={handleLike}
              onPass={handlePass}
            />
          </div>
        )}
      </div>

      {/* Match Modal */}
      <MatchModal
        match={matchNotification}
        onClose={() => setMatchNotification(null)}
      />
    </div>
  )
}
