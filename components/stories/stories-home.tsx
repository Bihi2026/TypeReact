"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Eye,
  Heart,
} from "lucide-react";
import { useQuery } from "convex/react";
import { ContinueReadingRail } from "@/components/stories/continue-reading-rail";
import { WriterHomeBanner } from "@/components/stories/writer-cta";
import { HomeContests } from "@/components/stories/home-contests";
import { RankingsStrip } from "@/components/stories/rankings-strip";
import {
  StoriesCurated,
  StoriesDiscover,
} from "@/components/stories/stories-discover";
import { StoryCard, StoryCover } from "@/components/stories/story-card";
import { WritersToFollow } from "@/components/stories/writers-to-follow";
import { PersonAvatar } from "@/components/person-avatar";
import { EmptyState } from "@/components/empty-state";
import { RouteLoading } from "@/components/route-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatNumber } from "@/lib/format";
import { toUiStory, totalReadingMinutes, type UiStory } from "@/lib/stories/query";
import { getGenreMeta, genreMeta, storyStatusMeta } from "@/lib/story-meta";
import type { UiContest } from "@/lib/contests/query";
import type { StoryGenre } from "@/lib/story-types";

export function StoriesHome({
  initialStories,
  contests,
}: {
  initialStories: UiStory[];
  contests: UiContest[];
}) {
  const docs = useQuery(api.stories.listPublic);
  const stories = useMemo(
    () => (docs ? docs.map((doc) => toUiStory(doc)) : initialStories),
    [docs, initialStories]
  );
  const genres = Object.keys(genreMeta) as StoryGenre[];
  const featured = stories[0];
  const excludeFeaturedIds = useMemo(
    () => (featured ? [featured.id] : []),
    [featured]
  );
  const trending = stories.slice(0, 6);
  const rising = [...stories]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const completed = stories.filter((s) => s.status === "completed").slice(0, 3);
  const [filtering, setFiltering] = useState(false);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <Suspense fallback={<RouteLoading variant="grid" />}>
        <StoriesDiscover
          stories={stories}
          onFilteringChange={setFiltering}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StoriesCurated filtering={filtering}>
          <div className="space-y-10">
            <ContinueReadingRail
              stories={stories}
              excludeStoryIds={excludeFeaturedIds}
            />

            <WriterHomeBanner />

            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold">Have a story idea?</p>
                <p className="text-sm text-muted-foreground">
                  Pitch a concept for editorial review. Accepted ideas appear in
                  the public browse, and writers may be assigned a draft.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/stories/ideas">Browse accepted ideas</Link>
                </Button>
                <Button asChild>
                  <Link href="/stories/submit-idea">
                    Submit a story idea <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </Card>

            {featured ? (
              <section aria-labelledby="featured-heading" className="space-y-4">
                <h2
                  id="featured-heading"
                  className="text-xl font-semibold tracking-tight"
                >
                  Featured story
                </h2>
                <Card className="gap-0 overflow-hidden p-0">
                  <div className="grid md:grid-cols-[320px_1fr]">
                    <StoryCover
                      story={featured}
                      className="min-h-48 md:min-h-full md:rounded-none"
                      showTitle={false}
                    />
                    <div className="space-y-3 p-6">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">
                          {getGenreMeta(featured.genre).label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={storyStatusMeta[featured.status].badgeClass}
                        >
                          {storyStatusMeta[featured.status].label}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">
                        {featured.title}
                      </h3>
                      {featured.blurb ? (
                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {featured.blurb}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 text-sm">
                        <PersonAvatar
                          id={featured.authorId}
                          name={featured.authorName}
                          className="size-7"
                        />
                        <span className="font-medium">{featured.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          @{featured.authorHandle}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="size-4" aria-hidden />
                          {formatNumber(featured.reads)} reads
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Heart className="size-4" aria-hidden />
                          {formatNumber(featured.votes)} votes
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="size-4" aria-hidden />
                          {featured.partCount} parts ·{" "}
                          {totalReadingMinutes(featured)} min
                        </span>
                      </div>
                      <Button asChild>
                        <Link href={`/stories/${featured.slug}`}>
                          Start reading <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              </section>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No published stories yet"
                description="Approved writers can create a draft and publish the first part from the dashboard."
              />
            )}

            <RankingsStrip stories={stories} />

            {trending.length > 0 && (
              <section aria-labelledby="trending-heading" className="space-y-4">
                <h2
                  id="trending-heading"
                  className="text-xl font-semibold tracking-tight"
                >
                  Trending now
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {trending.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="genres-heading" className="space-y-4">
              <h2
                id="genres-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Browse by genre
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {genres.map((g) => {
                  const meta = genreMeta[g];
                  const Icon = meta.icon;
                  return (
                    <Link
                      key={g}
                      href={`/stories?genre=${g}`}
                      className="group"
                    >
                      <div
                        className={`flex h-full flex-col justify-between rounded-xl bg-gradient-to-br p-4 text-white transition-transform group-hover:-translate-y-0.5 ${meta.gradient}`}
                      >
                        <Icon className="size-6 opacity-80" aria-hidden />
                        <p className="mt-6 font-semibold drop-shadow-sm">
                          {meta.label}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <HomeContests contests={contests} />

            <WritersToFollow stories={stories} />

            {rising.length > 0 && (
              <section aria-labelledby="rising-heading" className="space-y-4">
                <h2
                  id="rising-heading"
                  className="text-xl font-semibold tracking-tight"
                >
                  New &amp; rising
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {rising.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section aria-labelledby="completed-heading" className="space-y-4">
                <h2
                  id="completed-heading"
                  className="text-xl font-semibold tracking-tight"
                >
                  Binge a completed story
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completed.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </StoriesCurated>
      </Suspense>
    </div>
  );
}
