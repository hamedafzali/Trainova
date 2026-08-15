export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-surface2 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface shadow-card p-6 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface shadow-card p-5 text-center space-y-2">
      <Skeleton className="h-3 w-1/2 mx-auto" />
      <Skeleton className="h-8 w-2/3 mx-auto" />
    </div>
  );
}

export function ListSkeleton({
  count = 4,
  variant = "card",
}: {
  count?: number;
  variant?: "card" | "row";
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) =>
        variant === "row" ? (
          <div
            key={i}
            className="flex items-center gap-3 rounded-card border border-border bg-surface shadow-card p-4"
          >
            <Skeleton className="h-10 w-10 rounded-control shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ) : (
          <CardSkeleton key={i} />
        ),
      )}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface shadow-card p-5">
      <Skeleton className="h-3 w-24 mb-4" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-control" />
        ))}
      </div>
    </div>
  );
}
