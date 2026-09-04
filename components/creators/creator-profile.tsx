"use client";

import * as React from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Globe2,
  MessageSquareText,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BarkCard } from "@/components/bark-card";
import { CaseCard } from "@/components/case-card";
import { CreatorProfileActions } from "@/components/creators/creator-actions";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { SourceCard } from "@/components/source-card";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { countries } from "@/lib/data";
import { formatDate, formatNumber, gradientFor } from "@/lib/format";
import { isFollowableCreator } from "@/lib/creators/followable";
import { platformMeta } from "@/lib/meta";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AccountabilityCase, Bark, Creator, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

function responseLabel(rate: number) {
  if (rate >= 70) return { label: "Responsive", className: "text-agree" };
  if (rate >= 40)
    return {
      label: "Selective",
      className: "text-mixed-foreground dark:text-mixed",
    };
  return { label: "Rarely responds", className: "text-disagree" };
}

function TabCount({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 tabular-nums">
      {count}
    </Badge>
  );
}

export function CreatorProfile({
  creator,
  sources,
  barksAbout,
  cases,
}: {
  creator: Creator;
  sources: Source[];
  barksAbout: Bark[];
  cases: AccountabilityCase[];
}) {
  const { isAuthenticated } = useConvexAuth();
  const country = countries.find((c) => c.code === creator.country);
  const response = responseLabel(creator.responseRate);
  const handleLabel = creator.externalHandle
    ? `@${creator.externalHandle}`
    : `@${creator.handle}`;
  const primaryPlatform = creator.externalPlatform ?? creator.platforms[0];
  const openCases = cases.filter(
    (c) => c.status === "open" || c.status === "under-review"
  ).length;
  const [tab, setTab] = React.useState(() =>
    sources.length === 0 ? "barks" : "library"
  );
  const claimEligibility = useQuery(
    api.creators.canClaimCreator,
    !creator.hasTeaBarksProfile && isAuthenticated
      ? { creatorId: creator.id as Id<"creators"> }
      : "skip"
  );

  const barkSort = React.useMemo(
    () =>
      [...barksAbout].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      ),
    [barksAbout]
  );

  return (
    <div className="pb-10">
      <div className="relative overflow-hidden">
        <div
          className={cn(
            "h-44 w-full bg-gradient-to-br sm:h-56",
            gradientFor(creator.id)
          )}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22),transparent_50%),linear-gradient(to_top,rgba(0,0,0,0.25),transparent_55%)]" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-14 space-y-6 sm:-mt-16">
          <div className="rounded-2xl border bg-card/95 p-4 shadow-sm backdrop-blur sm:p-6">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 mb-4 w-fit"
              asChild
            >
              <Link href="/creators">
                <ArrowLeft className="size-3.5" aria-hidden /> All creators
              </Link>
            </Button>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <PersonAvatar
                  id={creator.id}
                  name={creator.name}
                  className="size-24 border-4 border-background text-2xl shadow-md sm:size-28"
                />
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {creator.name}
                    </h1>
                    {creator.verified && <VerifiedBadge className="size-5" />}
                    {creator.hasTeaBarksProfile ? (
                      <Badge
                        variant="outline"
                        className="border-agree/30 bg-agree/10 text-agree"
                      >
                        Active on TypeReact
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="uppercase tracking-wide"
                      >
                        Unclaimed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {handleLabel}
                    {primaryPlatform && (
                      <>
                        {" · "}
                        <PlatformIcon
                          platform={primaryPlatform}
                          className="mr-0.5 inline size-3.5"
                        />
                        {platformMeta[primaryPlatform].label}
                      </>
                    )}
                    {country
                      ? ` · ${country.flag} ${country.name}`
                      : creator.country
                        ? ` · ${creator.country}`
                        : ""}
                    {" · "}
                    Joined {formatDate(creator.joinedAt)}
                  </p>
                  <p className="max-w-2xl text-sm leading-relaxed text-foreground/85">
                    {creator.bio}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {creator.topics.map((t) => (
                      <Link key={t} href={`/topics/${t}`}>
                        <Badge variant="secondary" className="capitalize">
                          {t}
                        </Badge>
                      </Link>
                    ))}
                    {creator.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        <PlatformIcon platform={p} className="size-3" />
                        {platformMeta[p].label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <CreatorProfileActions
                creatorId={creator.id}
                name={creator.name}
                handle={creator.handle}
                followable={isFollowableCreator(creator)}
              />
            </div>

            {!creator.hasTeaBarksProfile && (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    Are you {creator.name}?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {claimEligibility?.allowed
                      ? "Claim this profile to verify your identity and respond officially to reactions and cases."
                      : (claimEligibility?.reason ??
                        "Only the member who first linked this profile by publishing a reaction can start a claim. If you are this creator, publish a reaction about your content while signed in, then return here.")}
                  </p>
                </div>
                {claimEligibility?.allowed ? (
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/creators/apply?claim=${creator.id}`}>
                      Claim this profile
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0 space-y-6">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="library" className="flex-none">
                    Library
                    <TabCount count={sources.length} />
                  </TabsTrigger>
                  <TabsTrigger value="barks" className="flex-none">
                    Reactions
                    <TabCount count={barksAbout.length} />
                  </TabsTrigger>
                  <TabsTrigger value="cases" className="flex-none">
                    Cases
                    <TabCount count={cases.length} />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="library" className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Indexed public content under discussion on TypeReact.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/create">React to a source</Link>
                    </Button>
                  </div>
                  {sources.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No indexed content yet"
                      description="Sources appear when community members start discussions about this creator."
                    />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {sources.map((s) => (
                        <SourceCard key={s.id} source={s} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="barks" className="mt-4 space-y-3">
                  {barkSort.length === 0 ? (
                    <EmptyState
                      icon={MessageSquareText}
                      title="No reactions yet"
                      description="Be the first to write an evidence-based response to this creator's content."
                      action={
                        <Button asChild size="sm">
                          <Link href="/create">Create Reaction</Link>
                        </Button>
                      }
                    />
                  ) : (
                    barkSort.map((b) => <BarkCard key={b.id} bark={b} />)
                  )}
                </TabsContent>

                <TabsContent value="cases" className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/cases/new?creator=${creator.handle}`}>
                        <Scale className="size-3.5" /> Open a case
                      </Link>
                    </Button>
                  </div>
                  {cases.length === 0 ? (
                    <EmptyState
                      icon={Scale}
                      title="No accountability cases"
                      description="This creator has no open or historical cases on record."
                    />
                  ) : (
                    cases.map((c) => (
                      <CaseCard key={c.id} accountabilityCase={c} />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
              <div className="space-y-4 rounded-xl border p-4">
                <h2 className="text-sm font-semibold">Profile snapshot</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Followers</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatNumber(creator.followers)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Sources</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {creator.totalSources}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">
                      Reactions received
                    </dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatNumber(creator.totalBarksReceived)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">
                      Official creator responses
                    </dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {formatNumber(creator.officialResponseCount ?? 0)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Open cases</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {openCases}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Response rate
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        response.className
                      )}
                    >
                      {creator.responseRate}% · {response.label}
                    </span>
                  </div>
                  <Progress
                    value={creator.responseRate}
                    aria-label="Response rate"
                  />
                  <p className="text-xs text-muted-foreground">
                    How often this creator officially replies to reactions and
                    cases about them.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <h2 className="text-sm font-semibold">Official links</h2>
                {creator.officialLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No official links on file.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {creator.officialLinks.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Globe2 className="size-3.5" aria-hidden />
                          {link.label}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {country && (
                <div className="space-y-2 rounded-xl border p-4">
                  <h2 className="text-sm font-semibold">Local context</h2>
                  <Link
                    href={`/countries/${country.code}`}
                    className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="text-2xl" aria-hidden>
                      {country.flag}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {country.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(country.barkCount)} local reactions
                      </span>
                    </span>
                  </Link>
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-dashed p-4">
                <h2 className="text-sm font-semibold">Quick actions</h2>
                <div className="grid gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/create">Start a Reaction</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/search?q=${encodeURIComponent(creator.name)}&creator=${creator.id}`}
                    >
                      Search discussions
                    </Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
