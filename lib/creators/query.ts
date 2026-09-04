import type { Doc } from "@/convex/_generated/dataModel";
import { getTopic } from "@/lib/data";
import type { Creator, SourcePlatform } from "@/lib/types";

export const creatorKeys = {
  approved: ["creators", "approved"] as const,
  pending: ["creators", "pending"] as const,
  detail: (handle: string) => ["creators", handle] as const,
};

export function toUiCreator(doc: Doc<"creators">): Creator {
  return {
    id: doc._id,
    handle: doc.handle,
    name: doc.name,
    bio: doc.bio,
    verified: doc.verified,
    hasTeaBarksProfile: doc.status === "approved",
    status: doc.status,
    externalHandle: doc.externalHandle,
    externalPlatform: doc.externalPlatform as SourcePlatform | undefined,
    profileImageUrl: doc.profileImageUrl,
    officialResponseCount: doc.officialResponseCount ?? 0,
    platforms: doc.platforms as SourcePlatform[],
    officialLinks: doc.officialLinks,
    followers: doc.followers,
    country: doc.country,
    topics: doc.category ? [doc.category] : [],
    totalSources: doc.totalSources,
    totalBarksReceived: doc.totalBarksReceived,
    responseRate: doc.responseRate,
    joinedAt: new Date(doc.createdAt).toISOString(),
  };
}

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function topicsFromCreators(creators: Creator[], limit = 5) {
  const counts = new Map<string, number>();
  for (const creator of creators) {
    const slug = creator.topics[0]?.trim();
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + creator.totalBarksReceived);
  }
  return [...counts.entries()]
    .map(([slug, barkCount]) => ({
      slug,
      name: getTopic(slug)?.name ?? titleCaseSlug(slug),
      barkCount,
    }))
    .sort((a, b) => b.barkCount - a.barkCount)
    .slice(0, limit);
}
