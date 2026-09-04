"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { CreatorCard } from "@/components/creators/creator-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { toUiCreator } from "@/lib/creators/query";
import { topics } from "@/lib/data";
import { platformMeta } from "@/lib/meta";
import type { Creator, SourcePlatform } from "@/lib/types";

const PAGE_SIZE = 6;
const ANY = "any";

type SortKey = "followers" | "barks" | "response" | "name";
type StatusKey = typeof ANY | "verified" | "claimed" | "unclaimed";

export function CreatorsDirectory({
  initialCreators,
}: {
  initialCreators: Creator[];
}) {
  const docs = useQuery(api.creators.listPublic);
  const creators = docs ? docs.map(toUiCreator) : initialCreators;
  const [query, setQuery] = React.useState("");
  const [topic, setTopic] = React.useState(ANY);
  const [platform, setPlatform] = React.useState(ANY);
  const [status, setStatus] = React.useState<StatusKey>(ANY);
  const [sort, setSort] = React.useState<SortKey>("followers");
  const [page, setPage] = React.useState(0);

  const platforms = React.useMemo(() => {
    const set = new Set<SourcePlatform>();
    creators.forEach((c) => c.platforms.forEach((p) => set.add(p)));
    return [...set];
  }, [creators]);

  const featured = React.useMemo(
    () =>
      [...creators]
        .filter((c) => c.totalBarksReceived > 0)
        .sort((a, b) => b.totalBarksReceived - a.totalBarksReceived)
        .slice(0, 3),
    [creators]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = creators.filter((c) => {
      if (
        q &&
        ![c.name, c.handle, c.bio, ...c.topics]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (topic !== ANY && !c.topics.includes(topic)) return false;
      if (platform !== ANY && !c.platforms.includes(platform as SourcePlatform))
        return false;
      if (status === "verified" && !c.verified) return false;
      if (status === "claimed" && !c.hasTeaBarksProfile) return false;
      if (status === "unclaimed" && c.hasTeaBarksProfile) return false;
      return true;
    });

    list.sort((a, b) => {
      switch (sort) {
        case "barks":
          return b.totalBarksReceived - a.totalBarksReceived;
        case "response":
          return b.responseRate - a.responseRate;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return b.followers - a.followers;
      }
    });
    return list;
  }, [creators, query, topic, platform, status, sort]);

  React.useEffect(() => {
    setPage(0);
  }, [query, topic, platform, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const filtersActive =
    query.trim() !== "" ||
    topic !== ANY ||
    platform !== ANY ||
    status !== ANY;
  const resultLabel = filtersActive
    ? `${filtered.length} of ${creators.length}`
    : `${filtered.length} creators`;

  if (creators.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No approved creators yet"
        description="Applications stay hidden until an admin approves them. Claim your channels to appear here."
        action={
          <Button asChild>
            <Link href="/creators/apply">
              <BadgeCheck className="size-4" />
              Become a Creator
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Most discussed
            </h2>
            <Badge variant="outline" className="text-[10px]">
              By reactions
            </Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {featured.map((c) => (
              <CreatorCard key={c.id} creator={c} featured />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Browse all creators
            <Badge variant="secondary" className="tabular-nums">
              {resultLabel}
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground">
            Filter by topic, platform, or claim status.
          </p>
        </div>

        <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, handle, topic…"
              className="pl-9"
              aria-label="Search creators"
            />
          </div>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger aria-label="Filter by topic" className="w-full">
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All topics</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger aria-label="Filter by platform" className="w-full">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>
                  {platformMeta[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusKey)}
          >
            <SelectTrigger aria-label="Filter by status" className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="claimed">Claimed profiles</SelectItem>
              <SelectItem value="unclaimed">Unclaimed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger aria-label="Sort creators" className="w-full">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="followers">Most followers</SelectItem>
              <SelectItem value="barks">Most reactions</SelectItem>
              <SelectItem value="response">Best response rate</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {slice.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No creators match"
            description="Try clearing a filter or searching a different handle."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Page {safePage + 1} of {totalPages} · {filtered.length} creators
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
