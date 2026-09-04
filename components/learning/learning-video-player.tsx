"use client";

import { SourceVideoPlayer } from "@/components/sources/source-video-player";
import type { LearningResource } from "@/lib/types";

export function LearningVideoPlayer({ resource }: { resource: LearningResource }) {
  if (!resource.videoUrl) return null;

  return (
    <SourceVideoPlayer
      autoLoad
      source={{
        id: resource.id,
        platform: resource.videoPlatform ?? "youtube",
        url: resource.videoUrl,
        title: resource.title,
        creatorId: "",
        publishedAt: resource.publishedAt ?? resource.updatedAt,
        category: "Learning",
        language: "en",
        barkCount: 0,
        replyChainCount: 0,
        caseCount: 0,
        engagement: 0,
        evidenceRating: 0,
        thumbnailUrl: resource.thumbnailUrl,
      }}
    />
  );
}
