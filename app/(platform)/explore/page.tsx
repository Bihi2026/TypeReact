import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorePageContent } from "@/components/explore/explore-page-content";
import { RightPanel } from "@/components/shell/right-panel";
import { listPublicBarks, listPublicSources } from "@/app/actions/barks";

export const metadata: Metadata = {
  title: "Explore",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [publishedBarks, publishedSources] = await Promise.all([
    listPublicBarks(),
    listPublicSources(),
  ]);

  return (
    <div className="flex">
      <Suspense
        fallback={
          <div className="min-w-0 flex-1 px-4 py-8 lg:px-6">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          </div>
        }
      >
        <ExplorePageContent
          initialBarks={publishedBarks}
          initialSources={publishedSources}
        />
      </Suspense>
      <RightPanel />
    </div>
  );
}
