import { isCountryScopeAll } from "@/lib/country-scope";
import { featuredReactionCodeBySourceUrl } from "@/lib/sources/featured-reaction";
import { sourceStatsFromBarks } from "@/lib/sources/stats";
import type { Bark, Source } from "@/lib/types";

export function barksForCountry(barks: Bark[], countryCode: string): Bark[] {
  if (isCountryScopeAll(countryCode)) return barks;
  return barks.filter((b) => b.country === countryCode);
}

/** Latest reaction time for a source URL within the given bark set. */
function latestBarkTimeBySourceUrl(barks: Bark[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const bark of barks) {
    const url = bark.sourceUrl?.trim();
    if (!url) continue;
    const t = new Date(bark.publishedAt).getTime();
    const prev = latest.get(url);
    if (prev === undefined || t > prev) {
      latest.set(url, t);
    }
  }
  return latest;
}

/** Sources linked to reactions published in the given country (or all when scope is All). */
export function sourcesUnderDiscussion(
  barks: Bark[],
  sources: Source[],
  countryCode: string
): Source[] {
  const byCountry = barksForCountry(barks, countryCode);
  const latestByUrl = latestBarkTimeBySourceUrl(byCountry);
  const countrySourceUrls = new Set(latestByUrl.keys());

  return sources
    .filter((s) => countrySourceUrls.has(s.url.trim()))
    .map((s) => {
      const latest = latestByUrl.get(s.url.trim());
      if (latest === undefined) return s;
      return {
        ...s,
        publishedAt: new Date(latest).toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
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
