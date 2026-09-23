import { Suspense } from "react";
import { listPublicBarks } from "@/app/actions/barks";
import { listCaseCategoryStats } from "@/app/actions/cases";
import { HomeHero } from "@/components/home/home-hero";
import { HomePageContent } from "@/components/home/home-page-content";
import { HomePageContentSkeleton } from "@/components/home/home-page-content-skeleton";
import { HomeTopicGrid } from "@/components/home/home-topic-grid";
import { RightPanel } from "@/components/shell/right-panel";
import { caseCategoryMeta } from "@/lib/meta";
import { topics } from "@/lib/topics";
import type { CaseCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [published, stats] = await Promise.all([
    listPublicBarks(),
    listCaseCategoryStats(),
  ]);
  const bySlug = new Map(stats.map((row) => [row.slug, row.caseCount]));
  const ranked = [...topics]
    .map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      group: caseCategoryMeta[topic.slug as CaseCategory].group,
      caseCount: bySlug.get(topic.slug) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.caseCount - a.caseCount || a.name.localeCompare(b.name, "en")
    );
  const trending = new Set(
    ranked.filter((topic) => topic.caseCount > 0).slice(0, 3).map((topic) => topic.slug)
  );
  const caseTopics = ranked.map((topic) => ({
    ...topic,
    trending: trending.has(topic.slug),
  }));

  return (
    <>
      <HomeHero />
      <Suspense
        fallback={
          <div className="border-b px-4 py-6 sm:px-6">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </div>
        }
      >
        <HomeTopicGrid published={published} caseTopics={caseTopics} />
      </Suspense>
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Suspense fallback={<HomePageContentSkeleton />}>
          <HomePageContent
            published={published}
            rail={<RightPanel published={published} embedded />}
          />
        </Suspense>
      </div>
    </>
  );
}
