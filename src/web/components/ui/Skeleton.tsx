interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={`bg-surface-hover rounded-[var(--radius-md)] animate-[pulse_1.5s_ease-in-out_infinite] ${className}`}
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="space-y-3" data-slot="post-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface border border-ring rounded-[var(--radius-lg)] p-4 space-y-2">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
