import { Skeleton } from '@/app/components/ui/skeleton';

export function MessageSkeleton({ sent = false }: { sent?: boolean }) {
  return (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs ${sent ? 'items-end' : 'items-start'} flex flex-col space-y-1`}>
        <Skeleton className="h-16 w-48 rounded-2xl" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4">
      <MessageSkeleton sent={false} />
      <MessageSkeleton sent={true} />
      <MessageSkeleton sent={false} />
      <MessageSkeleton sent={true} />
      <MessageSkeleton sent={false} />
    </div>
  );
}
