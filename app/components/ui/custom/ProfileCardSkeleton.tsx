import { Skeleton } from '@/app/components/ui/skeleton';

export function ProfileCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border-main bg-bg-card">
      <Skeleton className="h-96 w-full" />
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <div className="flex space-x-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    </div>
  );
}
