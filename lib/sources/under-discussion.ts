import { isCountryScopeAll } from "@/lib/country-scope";
import { featuredReactionCodeBySourceUrl } from "@/lib/sources/featured-reaction";
import { sourceStatsFromBarks } from "@/lib/sources/stats";
import type { Bark, Source } from "@/lib/types";

export function barksForCountry(barks: Bark[], countryCode: string): Bark[] {
  if (isCountryScopeAll(countryCode)) return barks;
  return barks.filter((b) => b.country === countryCode);
}

/** Sources linked to reactions published in the given country (or all when scope is All). */
export function sourcesUnderDiscussion(
  barks: Bark[],
  sources: Source[],
  countryCode: string
): Source[] {
  const byCountry = barksForCountry(barks, countryCode);
  const countrySourceUrls = new Set(
    byCountry.map((b) => b.sourceUrl?.trim()).filter(Boolean)
  );
  return sources.filter((s) => countrySourceUrls.has(s.url.trim()));
}

export function underDiscussionContext(barks: Bark[], countryCode: string) {
  const byCountry = barksForCountry(barks, countryCode);
  return {
    byCountry,
    featuredCodeByUrl: featuredReactionCodeBySourceUrl(byCountry),
    statsForSource: (sourceUrl: string) =>
      sourceStatsFromBarks(byCountry, sourceUrl),
  };
}
