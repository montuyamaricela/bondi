import { Skeleton } from '@/app/components/ui/skeleton';

export function MatchCardSkeleton() {
  return (
    <div className="flex items-center space-x-4 rounded-lg border border-border-main bg-bg-card p-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}

export function MatchListSkeleton() {
  return (
    <div className="space-y-4">
      <MatchCardSkeleton />
      <MatchCardSkeleton />
      <MatchCardSkeleton />
      <MatchCardSkeleton />
      <MatchCardSkeleton />
    </div>
  );
}
