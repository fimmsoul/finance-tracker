import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/** A single shimmer bar */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-border)] rounded animate-pulse',
        className,
      )}
    />
  );
}

/** Skeleton for the stock table — mimics the header + several rows */
export function StockTableSkeleton() {
  return (
    <div className="space-y-0">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-2 mb-1">
        <Skeleton className="h-3 w-6" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-12 ml-auto" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Table rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border-light)]"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-12 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}

      {/* Footer totals */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the performance summary table */
export function PerformanceSkeleton() {
  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      {/* Table */}
      <div className="space-y-0">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-[var(--color-border)] pb-2 mb-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20 ml-auto" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Metric rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-4 py-2 border-b border-[var(--color-border-light)]',
              i % 2 === 1 && 'bg-[var(--color-border-light)]/30',
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}

        {/* Total row */}
        <div className="flex items-center gap-4 py-2.5 border-t-2 border-[var(--color-border)] bg-[var(--color-border-light)] mt-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24 ml-auto" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  );
}
