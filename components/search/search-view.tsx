"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FilterX, Search, SlidersHorizontal } from "lucide-react";
import { BarkCard } from "@/components/bark-card";
import { BarkCode } from "@/components/bark-code";
import { CaseCard } from "@/components/case-card";
import { CaseCode } from "@/components/case-code";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/person-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CountrySelect } from "@/components/profile/country-select";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { toUiCase } from "@/lib/cases/query";
import {
  creators,
  getCreator,
  getSource,
  getUser,
  topics,
  users,
} from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { platformMeta } from "@/lib/meta";
import type { AccountabilityCase, Bark, SourcePlatform } from "@/lib/types";

const ANY = "any";
const CODE_RE = /^(TR|BRK|CASE)-\d{4}-\d{3,5}$/i;

function resolveCodePath(
  code: string,
  publishedBarks: Bark[],
  publishedCases: AccountabilityCase[]
): string | null {
  const normalized = code.trim().toUpperCase();
  if (!CODE_RE.test(normalized)) return null;
  const bark = publishedBarks.find((b) => b.code.toUpperCase() === normalized);
  if (bark) return `/barks/${bark.code}`;
  const accountabilityCase = publishedCases.find(
    (c) => c.code.toUpperCase() === normalized
  );
  if (accountabilityCase) return `/cases/${accountabilityCase.code}`;
  return null;
}

function paramOrAny(value: string | null) {
  return value && value.length > 0 ? value : ANY;
}

export function SearchView({
  initialCases,
  initialBarks,
}: {
  initialCases: AccountabilityCase[];
  initialBarks: Bark[];
}) {
  const barkDocs = useQuery(api.barks.listPublic, {});
  const publishedBarks = barkDocs ? barkDocs.map(toUiBark) : initialBarks;
  const caseDocs = useQuery(api.cases.list);
  const publishedCases = caseDocs ? caseDocs.map(toUiCase) : initialCases;
  const router = useRouter();
  const platforms = React.useMemo(
    () => Object.keys(platformMeta) as SourcePlatform[],
    []
  );
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [creatorFilter, setCreatorFilter] = React.useState(
    paramOrAny(params.get("creator"))
  );
  const [barkerFilter, setBarkerFilter] = React.useState(
    paramOrAny(params.get("barker"))
  );
  const [topicFilter, setTopicFilter] = React.useState(
    paramOrAny(params.get("topic"))
  );
  const [countryFilter, setCountryFilter] = React.useState(
    paramOrAny(params.get("country"))
  );
  const [platformFilter, setPlatformFilter] = React.useState(
    paramOrAny(params.get("platform"))
  );
  const [evidenceFilter, setEvidenceFilter] = React.useState(
    paramOrAny(params.get("evidence"))
  );
  const [dateFilter, setDateFilter] = React.useState(
    paramOrAny(params.get("date"))
  );

  // Deep-link: /search?q=TR-… (or legacy BRK-…) or CASE-… jumps straight to the record.
  React.useEffect(() => {
    const fromUrl = params.get("q")?.trim() ?? "";
    const path = resolveCodePath(fromUrl, publishedBarks, publishedCases);
    if (path) router.replace(path);
  }, [params, publishedBarks, publishedCases, router]);

  // Keep filters & query in the URL so shares/bookmarks restore state.
  React.useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    const pairs: [string, string][] = [
      ["creator", creatorFilter],
      ["barker", barkerFilter],
      ["topic", topicFilter],
      ["country", countryFilter],
      ["platform", platformFilter],
      ["evidence", evidenceFilter],
      ["date", dateFilter],
    ];
    for (const [key, value] of pairs) {
      if (value !== ANY) next.set(key, value);
    }
    const qs = next.toString();
    const current = params.toString();
    if (qs === current) return;
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }, [
    query,
    creatorFilter,
    barkerFilter,
    topicFilter,
    countryFilter,
    platformFilter,
    evidenceFilter,
    dateFilter,
    router,
    params,
  ]);

  const resetFilters = () => {
    setCreatorFilter(ANY);
    setBarkerFilter(ANY);
    setTopicFilter(ANY);
    setCountryFilter(ANY);
    setPlatformFilter(ANY);
    setEvidenceFilter(ANY);
    setDateFilter(ANY);
  };

  const goToExactCode = () => {
    const path = resolveCodePath(query, publishedBarks, publishedCases);
    if (path) router.push(path);
  };

  const q = query.trim().toLowerCase();
  const exactBark = q
    ? publishedBarks.find((b) => b.code.toLowerCase() === q)
    : undefined;
  const exactCase = q
    ? publishedCases.find((c) => c.code.toLowerCase() === q)
    : undefined;

  const matchedBarks = publishedBarks.filter((b) => {
    const source = getSource(b.sourceId);
    const author = getUser(b.authorId);
    const creator = source ? getCreator(source.creatorId) : undefined;
    if (
      q &&
      ![
        b.title,
        b.excerpt,
        b.code,
        b.authorName,
        b.sourceCreatorName,
        b.sourceTitle,
        author?.name,
        creator?.name,
        source?.title,
      ]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q))
    )
      return false;
    if (creatorFilter !== ANY && creator?.id !== creatorFilter) return false;
    if (barkerFilter !== ANY && b.authorId !== barkerFilter) return false;
    if (topicFilter !== ANY && !b.topics.includes(topicFilter)) return false;
    if (countryFilter !== ANY && b.country !== countryFilter) return false;
    if (
      platformFilter !== ANY &&
      (b.sourcePlatform ?? source?.platform) !== platformFilter
    )
      return false;
    if (evidenceFilter !== ANY) {
      const min = Number(evidenceFilter);
      if (b.evidenceRating < min) return false;
    }
    if (dateFilter !== ANY) {
      const days = Number(dateFilter);
      const cutoff = new Date("2026-08-06").getTime() - days * 86400000;
      if (new Date(b.publishedAt).getTime() < cutoff) return false;
    }
    return true;
  });

  const matchedCases = publishedCases.filter((c) => {
    const creator = getCreator(c.creatorId);
    if (
      q &&
      ![c.title, c.summary, c.code, c.creatorName, creator?.name]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q))
    )
      return false;
    if (creatorFilter !== ANY && c.creatorId !== creatorFilter) return false;
    return true;
  });

  const matchedCreators = creators.filter((c) => {
    if (creatorFilter !== ANY && c.id !== creatorFilter) return false;
    if (q && ![c.name, c.handle, c.bio].some((s) => s.toLowerCase().includes(q)))
      return false;
    return true;
  });

  const activeFilters = [
    creatorFilter,
    barkerFilter,
    topicFilter,
    countryFilter,
    platformFilter,
    evidenceFilter,
    dateFilter,
  ].filter((f) => f !== ANY).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Find reactions, cases, and creators by claim, code, or keyword.
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToExactCode();
          }}
          placeholder="Search claims, titles, Reaction IDs (TR-…), Case Codes (CASE-…)…"
          className="h-11 pl-9"
          aria-label="Search query"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <Card className="h-fit gap-0 p-0 lg:sticky lg:top-24">
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
              </h2>
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={resetFilters}
                >
                  <FilterX className="size-3.5" /> Clear ({activeFilters})
                </Button>
              )}
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <CountrySelect
                value={countryFilter === ANY ? "" : countryFilter}
                onChange={(code) => setCountryFilter(code || ANY)}
                allowEmpty
                emptyLabel="Any"
                className="h-8 text-xs md:h-8 md:text-xs"
              />
            </div>
            {(
              [
                {
                  label: "Creator",
                  value: creatorFilter,
                  set: setCreatorFilter,
                  options: creators.map((c) => ({ value: c.id, label: c.name })),
                },
                {
                  label: "Author",
                  value: barkerFilter,
                  set: setBarkerFilter,
                  options: users.map((u) => ({ value: u.id, label: u.name })),
                },
                {
                  label: "Topic",
                  value: topicFilter,
                  set: setTopicFilter,
                  options: topics.map((t) => ({ value: t.slug, label: t.name })),
                },
                {
                  label: "Source type",
                  value: platformFilter,
                  set: setPlatformFilter,
                  options: platforms.map((p) => ({
                    value: p,
                    label: platformMeta[p].label,
                  })),
                },
                {
                  label: "Evidence level",
                  value: evidenceFilter,
                  set: setEvidenceFilter,
                  options: [
                    { value: "85", label: "Strong (85+)" },
                    { value: "65", label: "Moderate (65+)" },
                    { value: "40", label: "Weak (40+)" },
                  ],
                },
                {
                  label: "Date",
                  value: dateFilter,
                  set: setDateFilter,
                  options: [
                    { value: "7", label: "Past week" },
                    { value: "30", label: "Past month" },
                    { value: "90", label: "Past 3 months" },
                  ],
                },
              ] as const
            ).map((f) => (
              <div key={f.label} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Select value={f.value} onValueChange={f.set}>
                  <SelectTrigger
                    aria-label={`Filter by ${f.label}`}
                    className="h-8 w-full text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any</SelectItem>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>

        {/* Results */}
        <div className="min-w-0 space-y-4">
          {exactBark && (
            <Card className="gap-0 border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-agree/15 text-agree border-agree/30"
                    >
                      Exact Reaction ID
                    </Badge>
                    <BarkCode code={exactBark.code} size="md" />
                  </div>
                  <p className="truncate font-semibold tracking-tight">
                    {exactBark.title}
                  </p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {exactBark.excerpt}
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link href={`/barks/${exactBark.code}`}>
                    Go to reaction <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          )}

          {exactCase && (
            <Card className="gap-0 border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-agree/15 text-agree border-agree/30"
                    >
                      Exact Case Code
                    </Badge>
                    <CaseCode code={exactCase.code} size="md" />
                  </div>
                  <p className="truncate font-semibold tracking-tight">
                    {exactCase.title}
                  </p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {exactCase.summary}
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link href={`/cases/${exactCase.code}`}>
                    Go to case <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          )}

          <Tabs defaultValue="barks">
            <TabsList>
              <TabsTrigger value="barks">
                Reactions ({matchedBarks.length})
              </TabsTrigger>
              <TabsTrigger value="cases">
                Cases ({matchedCases.length})
              </TabsTrigger>
              <TabsTrigger value="creators">
                Creators ({matchedCreators.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="barks" className="mt-4 space-y-3">
              {matchedBarks.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No reactions match"
                  description="Try broadening your query or clearing some filters. Paste a full Reaction ID (TR-…) for a direct match."
                />
              ) : (
                matchedBarks.map((b) => <BarkCard key={b.id} bark={b} />)
              )}
            </TabsContent>
            <TabsContent value="cases" className="mt-4 space-y-3">
              {matchedCases.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No cases match"
                  description="Try broadening your query or clearing some filters."
                />
              ) : (
                matchedCases.map((c) => (
                  <CaseCard key={c.id} accountabilityCase={c} />
                ))
              )}
            </TabsContent>
            <TabsContent value="creators" className="mt-4 space-y-3">
              {matchedCreators.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No creators match"
                  description="Try broadening your query or clearing some filters."
                />
              ) : (
                matchedCreators.map((c) => (
                  <Card key={c.id} className="flex-row items-center gap-3 p-4">
                    <PersonAvatar id={c.id} name={c.name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/creators/${c.handle}`}
                        className="flex items-center gap-1 font-medium hover:underline"
                      >
                        {c.name}
                        {c.verified && <VerifiedBadge className="size-3.5" />}
                      </Link>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {c.bio}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatNumber(c.followers)} followers
                    </span>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
