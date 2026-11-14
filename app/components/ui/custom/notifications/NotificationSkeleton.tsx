import { Skeleton } from '@/app/components/ui/skeleton';

export function NotificationListSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="mt-1 h-4 w-4 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
