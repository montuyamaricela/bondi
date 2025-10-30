import { Skeleton } from '@/app/components/ui/skeleton';

export function ProfileCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border-main rounded-lg overflow-hidden">
      <Skeleton className="w-full h-96" />
      <div className="p-6 space-y-4">
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
