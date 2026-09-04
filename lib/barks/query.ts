import type { Doc } from "@/convex/_generated/dataModel";
import {
  parseBodyToBlocks,
  resolveBlockEvidenceIds,
} from "@/lib/barks/content-blocks";
import type {
  Bark,
  BarkClaim,
  BarkDialogueTurn,
  BarkType,
  Evidence,
  SourcePlatform,
} from "@/lib/types";

export const barkKeys = {
  public: ["barks", "public"] as const,
  detail: (code: string) => ["barks", code] as const,
};

export function sortBarksByPublishedAt(barks: Bark[]): Bark[] {
  return [...barks].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function sortBarksByViews(barks: Bark[]): Bark[] {
  return [...barks].sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });
}

function mapEvidence(doc: Doc<"barks">): Evidence[] {
  return (doc.evidence ?? []).map((item, i) => {
    const isTimestamp = item.type === "timestamp";
    const looksLikeUrl =
      typeof item.url === "string" && /^https?:\/\//i.test(item.url);
    const attestCount = item.attestCount ?? 0;
    const challengeCount = item.challengeCount ?? 0;
    return {
      id: `${doc.code}-ev-${i}`,
      type: item.type,
      title: item.title,
      description: item.title,
      url: !isTimestamp && looksLikeUrl ? item.url : undefined,
      timestamp: isTimestamp ? item.url || undefined : undefined,
      fileName: item.fileName,
      contentType: item.contentType,
      addedById: doc.authorClerkId,
      addedByName: doc.authorName,
      addedAt: doc.publishedAt
        ? new Date(doc.publishedAt).toISOString()
        : new Date().toISOString(),
      verified: attestCount > challengeCount && attestCount > 0,
      attestCount,
      challengeCount,
    };
  });
}

export function toUiBark(doc: Doc<"barks">): Bark {
  const evidence = mapEvidence(doc);
  const rawBlocks =
    doc.contentBlocks && doc.contentBlocks.length > 0
      ? doc.contentBlocks
      : parseBodyToBlocks(doc.body || "", evidence.length);
  const content = resolveBlockEvidenceIds(rawBlocks, doc.code);

  const dialogue: BarkDialogueTurn[] | undefined = doc.creatorDialogue?.map(
    (turn) => ({
      role: turn.role,
      content: turn.content,
      respondedAt: new Date(turn.respondedAt).toISOString(),
      verified: turn.verified,
      evidence: (turn.evidence ?? []).map((item, i) => ({
        id: `${doc.code}-dialogue-ev-${i}`,
        type: item.type,
        title: item.title,
        description: item.title,
        url: item.url || undefined,
        fileName: item.fileName,
        contentType: item.contentType,
        addedById: doc.authorClerkId,
        addedAt: new Date(turn.respondedAt).toISOString(),
        verified: turn.verified,
      })),
    })
  );

  const firstCreator =
    dialogue?.find((t) => t.role === "creator") ??
    (doc.creatorResponse
      ? {
          role: "creator" as const,
          content: doc.creatorResponse.content,
          respondedAt: new Date(doc.creatorResponse.respondedAt).toISOString(),
          verified: doc.creatorResponse.verified,
        }
      : undefined);

  return {
    id: doc._id,
    code: doc.code,
    type: (doc.type || "mixed") as BarkType,
    title: doc.title || "Untitled Reaction",
    authorId: doc.authorClerkId,
    sourceId: `convex-source:${doc.code}`,
    publishedAt: doc.publishedAt
      ? new Date(doc.publishedAt).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.amendedAt
      ? new Date(doc.amendedAt).toISOString()
      : undefined,
    excerpt: doc.excerpt || "",
    content,
    evidence,
    evidenceRating: doc.evidenceRating ?? 0,
    replyCount: doc.replyCount ?? 0,
    upvotes: doc.upvotes ?? 0,
    saves: doc.saves ?? 0,
    views: doc.views ?? 0,
    topics: doc.topics ?? [],
    country: doc.country ?? "",
    authorName: doc.authorName,
    sourceTitle: doc.sourceTitle,
    sourcePlatform: doc.sourcePlatform as SourcePlatform,
    sourceUrl: doc.sourceUrl,
    sourceCreatorName: doc.sourceCreatorName,
    sourceCreatorId: doc.sourceCreatorId,
    sourceThumbnailUrl: doc.sourceThumbnailUrl,
    creatorResponse: firstCreator
      ? {
          content: firstCreator.content,
          respondedAt: firstCreator.respondedAt,
          verified: firstCreator.verified,
        }
      : undefined,
    creatorDialogue: dialogue,
    version: doc.version ?? 1,
    amendedAt: doc.amendedAt
      ? new Date(doc.amendedAt).toISOString()
      : undefined,
    promotedCaseCode: doc.promotedCaseCode,
    quotedBarkCode: doc.quotedBarkCode,
    claims: (doc.claims ?? []).map(
      (claim): BarkClaim => ({
        id: claim.id,
        text: claim.text,
        status: claim.status,
        evidenceIndexes: claim.evidenceIndexes,
      })
    ),
    live: true,
    status: doc.status,
  };
}
