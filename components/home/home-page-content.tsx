"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, FileText, MessageSquare } from "lucide-react";
import { BarkCard } from "@/components/bark-card";
import { CountryScopeBar } from "@/components/country/country-scope-bar";
import { EmptyState } from "@/components/empty-state";
import { HomeFilteredSectionsSkeleton } from "@/components/home/home-page-content-skeleton";
import { HomeSourceCard } from "@/components/home/home-source-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useSelectedCountry } from "@/hooks/use-selected-country";
import { toUiBark, sortBarksByPublishedAt } from "@/lib/barks/query";
import { isCountryScopeAll } from "@/lib/country-scope";
import { topics as topicCatalog } from "@/lib/topics";
import {
  sourcesUnderDiscussion,
  underDiscussionContext,
} from "@/lib/sources/under-discussion";
import { toUiSource } from "@/lib/sources/query";
import { formatNumber } from "@/lib/format";
import type { Bark, Source } from "@/lib/types";

function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href={href}>
          View all <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}

export function HomePageContent({
  published: initialPublished,
  publicSources: initialPublicSources,
}: {
  published: Bark[];
  publicSources: Source[];
}) {
  const {
    selectedCountry,
    countryMeta,
    countryLabel,
    isCountryRefreshing,
    handleCountryChange,
  } = useSelectedCountry("/");
  const barkDocs = useQuery(api.barks.listPublic, {});
  const sourceDocs = useQuery(api.barks.listPublicSources);
  const topicStats = useQuery(api.barks.topicStats);
  const published = barkDocs
    ? barkDocs.map(toUiBark)
    : initialPublished;
  const publicSources = sourceDocs
    ? sourceDocs.map(toUiSource)
    : initialPublicSources;
  const trendingTopics = React.useMemo(() => {
    const bySlug = new Map(
      (topicStats ?? []).map((row) => [row.topic as string, row] as const)
    );
    return topicCatalog
      .map((t) => {
        const live = bySlug.get(t.slug);
        return {
          ...t,
          barkCount: live?.barkCount ?? 0,
          caseCount: live?.caseCount ?? t.caseCount,
          trending: live?.trending ?? false,
        };
      })
      .sort((a, b) => b.barkCount - a.barkCount)
      .slice(0, 6);
  }, [topicStats]);

  const { byCountry, featuredCodeByUrl, statsForSource } =
    underDiscussionContext(published, selectedCountry);
  const worldwide = sortBarksByPublishedAt(published);
  const underDiscussionSources = sourcesUnderDiscussion(
    published,
    publicSources,
    selectedCountry
  ).slice(0, 6);
  const trendingBarks = [...byCountry]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5);
  const localFeed = byCountry.slice(0, 4);
  const globalFeed = worldwide.slice(0, 4);
  const scopeIsAll = isCountryScopeAll(selectedCountry);
  const scopePlace = scopeIsAll
    ? "worldwide"
    : (countryMeta?.name ?? "this country");
  const scopeFrom = scopeIsAll
    ? "anywhere"
    : (countryMeta?.name ?? "your selected country");

  return (
    <div className="min-w-0 flex-1 space-y-10 px-4 py-8 lg:px-6">
      <CountryScopeBar
        id="home-country"
        value={selectedCountry}
        onChange={handleCountryChange}
      />

      {isCountryRefreshing ? (
        <HomeFilteredSectionsSkeleton />
      ) : (
        <div key={selectedCountry} className="space-y-10">
          <section aria-labelledby="under-discussion">
            <SectionHeader
              title="Under Discussion"
              description={`Sources drawing the most analysis in ${countryLabel}`}
              href={`/explore?country=${selectedCountry}`}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {underDiscussionSources.length === 0 ? (
                <div className="sm:col-span-2 xl:col-span-3">
                  <EmptyState
                    icon={FileText}
                    title={`No sources in ${scopePlace} yet`}
                    description={`When reactions from ${scopeFrom} are published, the sources drawing the most analysis will show up here.`}
                  />
                </div>
              ) : (
                underDiscussionSources.map((s) => {
                  const stats = statsForSource(s.url);
                  return (
                    <HomeSourceCard
                      key={s.id}
                      source={s}
                      views={stats.views}
                      creatorId={stats.creatorId}
                      discussionCode={featuredCodeByUrl.get(s.url.trim())}
                    />
                  );
                })
              )}
            </div>
          </section>

          <section aria-labelledby="trending-barks">
            <SectionHeader
              title="Trending Reactions"
              description={`The most upvoted evidence-based responses in ${countryLabel}`}
              href="/barks"
            />
            <div className="mt-4 space-y-3">
              {trendingBarks.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={`No trending reactions ${scopeIsAll ? "yet" : `in ${scopePlace}`}`}
                  description={`When reactions from ${scopeFrom} are published, the most upvoted will appear here.`}
                />
              ) : (
                trendingBarks.map((b) => <BarkCard key={b.id} bark={b} />)
              )}
            </div>
          </section>

          <section aria-labelledby="feeds">
            <Tabs defaultValue="local">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Your Feeds
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Local is {countryLabel}; Global is newest worldwide
                  </p>
                </div>
                <TabsList>
                  <TabsTrigger value="local">Local</TabsTrigger>
                  <TabsTrigger value="global">Global</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="local" className="mt-4 space-y-3">
                {localFeed.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title={`No reactions ${scopeIsAll ? "yet" : `in ${scopePlace} yet`}`}
                    description={
                      scopeIsAll
                        ? "Published reactions will show up here."
                        : `Reactions from ${scopeFrom} will show up here when they include a location.`
                    }
                  />
                ) : (
                  localFeed.map((b) => <BarkCard key={b.id} bark={b} />)
                )}
              </TabsContent>
              <TabsContent value="global" className="mt-4 space-y-3">
                {globalFeed.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No reactions yet"
                    description="Newest published reactions from everywhere will appear here."
                  />
                ) : (
                  globalFeed.map((b) => <BarkCard key={b.id} bark={b} />)
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}

      <section aria-labelledby="trending-topics">
        <SectionHeader
          title="Trending Topics"
          description="Where the discussion is concentrating"
          href="/topics"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trendingTopics.map((t) => (
            <Link key={t.slug} href={`/topics/${t.slug}`} className="group">
              <Card className="gap-1.5 p-4 transition-colors group-hover:border-primary/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t.name}</span>
                  {t.trending && (
                    <Badge variant="secondary" className="text-[10px]">
                      Trending
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {t.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(t.barkCount)} reactions ·{" "}
                  {formatNumber(t.caseCount)} cases
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
