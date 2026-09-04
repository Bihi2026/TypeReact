import type { Bark } from "@/lib/types";

export function sourceStatsFromBarks(barks: Bark[], sourceUrl: string) {
  const normalized = sourceUrl.trim();
  const matching = barks.filter((b) => b.sourceUrl?.trim() === normalized);
  return {
    views: matching.reduce((sum, b) => sum + (b.views ?? 0), 0),
    creatorId: matching.find((b) => b.sourceCreatorId)?.sourceCreatorId,
  };
}
