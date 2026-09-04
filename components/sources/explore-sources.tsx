"use client";

import { FileText } from "lucide-react";
import { useQuery } from "convex/react";
import { EmptyState } from "@/components/empty-state";
import { HomeSourceCard } from "@/components/home/home-source-card";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { isCountryScopeAll } from "@/lib/country-scope";
import {
  sourcesUnderDiscussion,
  underDiscussionContext,
} from "@/lib/sources/under-discussion";
import { toUiSource } from "@/lib/sources/query";
import type { Bark, Source } from "@/lib/types";

export function ExploreSources({
  initialBarks,
  initialSources,
  selectedCountry,
  countryLabel,
  countryName,
}: {
  initialBarks: Bark[];
  initialSources: Source[];
  selectedCountry: string;
  countryLabel: string;
  countryName?: string;
}) {
  const barkDocs = useQuery(api.barks.listPublic, {});
  const sourceDocs = useQuery(api.barks.listPublicSources);
  const published = barkDocs ? barkDocs.map(toUiBark) : initialBarks;
  const publicSources = sourceDocs
    ? sourceDocs.map(toUiSource)
    : initialSources;

  const { featuredCodeByUrl, statsForSource } = underDiscussionContext(
    published,
    selectedCountry
  );
  const sources = sourcesUnderDiscussion(
    published,
    publicSources,
    selectedCountry
  );
  const worldwide = isCountryScopeAll(selectedCountry);

  if (sources.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={
          worldwide
            ? "No sources yet"
            : `No sources in ${countryName ?? "this country"} yet`
        }
        description={
          worldwide
            ? "When reactions are published, the sources drawing the most analysis will show up here."
            : `When reactions from ${countryName ?? "your selected country"} are published, the sources drawing the most analysis in ${countryLabel} will show up here.`
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map((s) => {
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
      })}
    </div>
  );
}
