"use client";

import * as React from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { UserPlus, Users } from "lucide-react";
import { BarkCard } from "@/components/bark-card";
import { PersonAvatar } from "@/components/person-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { toUiCreator } from "@/lib/creators/query";
import { formatNumber } from "@/lib/format";
import { profilePath } from "@/lib/profile";

function FollowingHeader({ total }: { total?: number }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <UserPlus className="size-5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          Following
          {typeof total === "number" && total > 0 ? (
            <Badge variant="secondary">{total}</Badge>
          ) : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          The latest reactions from researchers and creators you follow.
        </p>
      </div>
    </div>
  );
}

function FollowingSkeleton() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-10 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-7 w-36 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
      <aside className="hidden space-y-4 lg:block">
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </aside>
    </div>
  );
}

function FollowingSignedIn() {
  const { isAuthenticated } = useConvexAuth();
  const [before, setBefore] = React.useState<number | undefined>(undefined);
  const [items, setItems] = React.useState<ReturnType<typeof toUiBark>[]>([]);
  const barkDocs = useQuery(
    api.barks.listFollowing,
    isAuthenticated
      ? { ...(before !== undefined ? { before } : {}), limit: 20 }
      : "skip"
  );
  const authors = useQuery(
    api.follows.listMineAuthors,
    isAuthenticated ? {} : "skip"
  );
  const creatorDocs = useQuery(
    api.creators.listMineFollows,
    isAuthenticated ? {} : "skip"
  );

  React.useEffect(() => {
    if (!barkDocs) return;
    const mapped = barkDocs.map(toUiBark);
    if (before === undefined) {
      setItems(mapped);
      return;
    }
    setItems((prev) => {
      const seen = new Set(prev.map((b) => b.id));
      return [...prev, ...mapped.filter((b) => !seen.has(b.id))];
    });
  }, [barkDocs, before]);

  if (
    !isAuthenticated ||
    (barkDocs === undefined && before === undefined) ||
    authors === undefined ||
    creatorDocs === undefined
  ) {
    return <FollowingSkeleton />;
  }

  const feed = items;
  const followedCreators = creatorDocs.map(toUiCreator);
  const followedAuthors = authors;
  const hasFollows =
    followedAuthors.length > 0 || followedCreators.length > 0;
  const totalFollows = followedAuthors.length + followedCreators.length;
  const loadingMore = before !== undefined && barkDocs === undefined;
  const canLoadMore =
    (barkDocs !== undefined && barkDocs.length >= 20 && feed.length > 0) ||
    loadingMore;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <FollowingHeader total={totalFollows} />
        <div className="space-y-3">
          {!hasFollows ? (
            <EmptyState
              icon={Users}
              title="You’re not following anyone yet"
              description="Follow a reactor on a reaction, or a creator on their profile, to build this feed."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm">
                    <Link href="/barks">Discover reactions</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/creators">Discover creators</Link>
                  </Button>
                </div>
              }
            />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No followed reactions yet"
              description="Reactions from people you follow will appear here."
            />
          ) : (
            <>
              {feed.map((b) => (
                <BarkCard key={b.id} bark={b} compactActions />
              ))}
              {canLoadMore ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => {
                      const oldest = feed[feed.length - 1];
                      if (!oldest) return;
                      setBefore(new Date(oldest.publishedAt).getTime());
                    }}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Reactors you follow
            {followedAuthors.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {followedAuthors.length}
              </Badge>
            ) : null}
          </h2>
          {followedAuthors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Follow a reaction author to see them here.
            </p>
          ) : (
            <ul className="divide-y">
              {followedAuthors.map((u) => (
                <li key={u.clerkUserId}>
                  <Link
                    href={profilePath(u.clerkUserId)}
                    className="flex items-center gap-2.5 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <PersonAvatar
                      id={u.clerkUserId}
                      name={u.name}
                      imageUrl={u.imageUrl ?? undefined}
                      className="size-8"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Evidence score {u.evidenceScore}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/barks">Discover reactions</Link>
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Creators you follow
            {followedCreators.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {followedCreators.length}
              </Badge>
            ) : null}
          </h2>
          {followedCreators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Follow a creator to see them here.
            </p>
          ) : (
            <ul className="divide-y">
              {followedCreators.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/creators/${c.handle}`}
                    className="flex items-center gap-2.5 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <PersonAvatar id={c.id} name={c.name} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-medium">
                        <span className="truncate">{c.name}</span>
                        {c.verified ? (
                          <VerifiedBadge className="size-3.5 shrink-0" />
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(c.followers)} followers
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/creators">Discover more</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function FollowingFeed() {
  return (
    <>
      <Show when="signed-out">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
          <FollowingHeader />
          <EmptyState
            icon={Users}
            title="Sign in to see your feed"
            description="Follow reactors and creators, then their latest reactions show up here."
            action={
              <SignInButton>
                <Button>Sign in</Button>
              </SignInButton>
            }
          />
        </div>
      </Show>
      <Show when="signed-in">
        <FollowingSignedIn />
      </Show>
    </>
  );
}
