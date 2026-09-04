import { Skeleton } from "@/components/ui/skeleton";

export function HomeFilteredSectionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading country content" className="space-y-10">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function HomePageContentSkeleton() {
  return (
    <div className="min-w-0 flex-1 space-y-10 px-4 py-8 lg:px-6">
      <Skeleton className="h-24 w-full rounded-lg" />
      <HomeFilteredSectionsSkeleton />
    </div>
  );
}
