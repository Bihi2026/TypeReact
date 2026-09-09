import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { platformMeta } from "@/lib/meta";
import type { Source, SourcePlatform } from "@/lib/types";

export type PublicSourceRow = FunctionReturnType<
  typeof api.barks.listPublicSources
>[number];

export function sortSourcesByPublishedAt(sources: Source[]): Source[] {
  return [...sources].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function toUiSource(row: PublicSourceRow): Source {
  const platform = row.sourcePlatform as SourcePlatform;
  return {
    id: `source:${row.sourceUrl}`,
    platform,
    url: row.sourceUrl,
    title: row.sourceTitle,
    creatorId: "",
    creatorName: row.sourceCreatorName,
    publishedAt: new Date(row.publishedAt).toISOString(),
    category: platformMeta[platform]?.label ?? "Discussion",
    language: "",
    barkCount: row.barkCount,
    replyChainCount: row.replyCount,
    caseCount: 0,
    engagement: row.engagement,
    evidenceRating: row.evidenceRating,
    thumbnailUrl: row.sourceThumbnailUrl ?? undefined,
  };
}
