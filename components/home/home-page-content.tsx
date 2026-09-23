"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { MessageSquare } from "lucide-react";
import { CountrySelect } from "@/components/profile/country-select";
import { EmptyState } from "@/components/empty-state";
import { HomeComposeStrip } from "@/components/home/home-compose-strip";
import { HomeDiscussionCard } from "@/components/home/home-discussion-card";
import { HomeFilteredSectionsSkeleton } from "@/components/home/home-page-content-skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  barkMatchesHomeTopic,
  HOME_TOPIC_PARAM,
  homeTopicFilterOptions,
} from "@/lib/home-discovery";
import type { Bark } from "@/lib/types";

const ALL_TOPICS_VALUE = "all";
const INITIAL_VISIBLE = 8;

function mergeBarks(primary: Bark[], secondary: Bark[]): Bark[] {
  const byId = new Map<string, Bark>();
  for (const bark of [...primary, ...secondary]) {
    if (!byId.has(bark.id)) byId.set(bark.id, bark);
  }
  return sortBarksByPublishedAt([...byId.values()]);
}

function applyTopic(barks: Bark[], topic: string): Bark[] {
  if (!topic) return barks;
  return barks.filter((bark) => barkMatchesHomeTopic(bark, topic));
}

export function HomePageContent({
  published: initialPublished,
  rail,
}: {
  published: Bark[];
  rail?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get(HOME_TOPIC_PARAM)?.trim() ?? "";
  const {
    selectedCountry,
    countryLabel,
    isCountryRefreshing,
    handleCountryChange,
  } = useSelectedCountry("/");
  const { isAuthenticated } = useConvexAuth();
  const barkDocs = useQuery(api.barks.listPublic, {});
  const followingDocs = useQuery(
    api.barks.listFollowing,
    isAuthenticated ? {} : "skip"
  );
  const published = barkDocs ? barkDocs.map(toUiBark) : initialPublished;
  const following = followingDocs ? followingDocs.map(toUiBark) : [];
  const topicOptions = React.useMemo(() => homeTopicFilterOptions(), []);

  const newest = React.useMemo(
    () => sortBarksByPublishedAt(published),
    [published]
  );
  const forYou = React.useMemo(() => {
    if (!isAuthenticated) return applyTopic(newest, topic);
    return applyTopic(mergeBarks(following, newest), topic);
  }, [following, isAuthenticated, newest, topic]);
  const followingFeed = React.useMemo(
    () => applyTopic(sortBarksByPublishedAt(following), topic),
    [following, topic]
  );
  const countryFeed = React.useMemo(() => {
    const scoped = isCountryScopeAll(selectedCountry)
      ? newest
      : newest.filter((bark) => bark.country === selectedCountry);
    return applyTopic(scoped, topic);
  }, [newest, selectedCountry, topic]);
  const trendingFeed = React.useMemo(
    () =>
      applyTopic(
        [...newest].sort((a, b) => {
          const t =
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime();
          if (t !== 0) return t;
          return b.upvotes - a.upvotes;
        }),
        topic
      ),
    [newest, topic]
  );

  const setTopic = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL_TOPICS_VALUE) {
      next.delete(HOME_TOPIC_PARAM);
    } else {
      next.set(HOME_TOPIC_PARAM, value);
    }
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  };

  const [visible, setVisible] = React.useState(INITIAL_VISIBLE);
  React.useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [topic, selectedCountry]);

  const emptyDescription = topic
    ? "No reactions match this topic yet. Try another filter or write the first one."
    : undefined;

  const renderFeed = (items: Bark[]) => {
    if (items.length === 0) return null;
    const shown = items.slice(0, visible);
    return (
      <>
        {shown.map((bark) => (
          <HomeDiscussionCard key={bark.id} bark={bark} />
        ))}
        {items.length > visible ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setVisible(items.length)}
          >
            Show more
          </Button>
        ) : null}
      </>
    );
  };

  return (
    <div className="min-w-0 xl:contents">
    <div className="min-w-0 space-y-6 px-4 py-8 lg:px-6">
      <section aria-labelledby="whats-happening">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="whats-happening"
              className="text-lg font-semibold tracking-tight"
            >
              What&apos;s happening?
            </h2>
            <p className="text-sm text-muted-foreground">
              Evidence-based reactions from the public square
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <Select
              value={topic || ALL_TOPICS_VALUE}
              onValueChange={setTopic}
            >
              <SelectTrigger
                aria-label="Filter by topic"
                className="h-9 w-full min-w-0 bg-background sm:w-auto sm:min-w-40"
              >
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOPICS_VALUE}>All topics</SelectItem>
                <SelectGroup>
                  <SelectLabel>Discovery</SelectLabel>
                  {topicOptions
                    .filter((option) => option.group === "discovery")
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Cases</SelectLabel>
                  {topicOptions
                    .filter((option) => option.group === "cases")
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <CountrySelect
              id="home-country"
              value={selectedCountry}
              onChange={handleCountryChange}
              includeAll
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm sm:w-48"
            />
          </div>
        </div>

        <div className="mt-5">
          <HomeComposeStrip />
        </div>

        {isCountryRefreshing ? (
          <div className="mt-5">
            <HomeFilteredSectionsSkeleton />
          </div>
        ) : (
          <Tabs defaultValue="for-you" className="mt-5">
            <TabsList
              variant="line"
              className="w-full max-w-full justify-start overflow-x-auto"
            >
              <TabsTrigger value="for-you">For you</TabsTrigger>
              <TabsTrigger value="following">Following</TabsTrigger>
              <TabsTrigger value="country">My Country</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
            </TabsList>

            <TabsContent value="for-you" className="mt-4 space-y-3">
              {forYou.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No reactions yet"
                  description={
                    emptyDescription ??
                    "Newest public reactions will appear here."
                  }
                />
              ) : (
                renderFeed(forYou)
              )}
            </TabsContent>

            <TabsContent value="following" className="mt-4 space-y-3">
              {!isAuthenticated ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Sign in to see who you follow"
                  description="Follow authors and creators, then their newest reactions will land here."
                  action={
                    <SignInButton>
                      <Button>Sign in</Button>
                    </SignInButton>
                  }
                />
              ) : followingFeed.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nothing from people you follow"
                  description={
                    emptyDescription ??
                    "Follow authors or creators to build this feed."
                  }
                />
              ) : (
                renderFeed(followingFeed)
              )}
            </TabsContent>

            <TabsContent value="country" className="mt-4 space-y-3">
              {countryFeed.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={`No reactions in ${countryLabel} yet`}
                  description={
                    emptyDescription ??
                    "Published reactions from this country will show up here."
                  }
                />
              ) : (
                renderFeed(countryFeed)
              )}
            </TabsContent>

            <TabsContent value="trending" className="mt-4 space-y-3">
              {trendingFeed.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No trending reactions yet"
                  description={
                    emptyDescription ??
                    "Newest and most upvoted reactions will appear here."
                  }
                />
              ) : (
                renderFeed(trendingFeed)
              )}
            </TabsContent>
          </Tabs>
        )}
      </section>
    </div>
    {rail ? (
      <div className="px-4 pb-8 lg:px-6 xl:px-0 xl:pb-0">{rail}</div>
    ) : null}
    </div>
  );
}
