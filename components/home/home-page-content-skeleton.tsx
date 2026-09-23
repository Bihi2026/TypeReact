import { Skeleton } from "@/components/ui/skeleton";

export function HomeFilteredSectionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading feed" className="space-y-3">
      <Skeleton className="h-8 w-72 rounded-lg" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function HomePageContentSkeleton() {
  return (
    <div className="min-w-0 flex-1 space-y-6 px-4 py-8 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <HomeFilteredSectionsSkeleton />
    </div>
  );
}
