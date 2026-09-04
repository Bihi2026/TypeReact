import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function ProfilePageSkeleton() {
  return (
    <div className="pb-10">
      <div className="h-36 w-full animate-pulse bg-muted sm:h-44" />
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative -mt-12 space-y-6 sm:-mt-14">
          <div className="rounded-2xl border bg-card p-4 sm:p-6">
            <div className="flex gap-4">
              <div className="size-24 shrink-0 animate-pulse rounded-full bg-muted sm:size-28" />
              <div className="min-w-0 flex-1 space-y-2 pt-8 sm:pt-10">
                <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div className="h-36 animate-pulse rounded-xl bg-muted" />
              <div className="h-36 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileStatusShell({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="pb-10">
      <div className="h-36 w-full bg-muted sm:h-44" aria-hidden />
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative -mt-12 sm:-mt-14">
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <EmptyState icon={icon} title={title} description={description} />
          </div>
        </div>
      </div>
    </div>
  );
}
