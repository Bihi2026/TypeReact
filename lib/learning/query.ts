import type { Doc } from "@/convex/_generated/dataModel";
import type { ContentBlock, LearningResource } from "@/lib/types";

type LearningDoc = Doc<"learningResources"> & { downloadUrl?: string };

function toUiBlocks(
  blocks: LearningDoc["contentBlocks"]
): ContentBlock[] | undefined {
  if (!blocks?.length) return undefined;
  return blocks.filter(
    (b): b is ContentBlock => b.kind !== "evidence"
  ) as ContentBlock[];
}

export function toUiLearningResource(doc: LearningDoc): LearningResource {
  return {
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    type: doc.type,
    category: doc.category,
    status: doc.status,
    sortOrder: doc.sortOrder,
    durationMinutes: doc.durationMinutes,
    thumbnailUrl: doc.thumbnailUrl,
    videoUrl: doc.videoUrl,
    videoPlatform: doc.videoPlatform,
    contentBlocks: toUiBlocks(doc.contentBlocks),
    fileName: doc.fileName,
    fileContentType: doc.fileContentType,
    externalDownloadUrl: doc.externalDownloadUrl,
    publishedAt: doc.publishedAt
      ? new Date(doc.publishedAt).toISOString()
      : undefined,
    updatedAt: new Date(doc.updatedAt).toISOString(),
    downloadUrl: doc.downloadUrl,
  };
}
