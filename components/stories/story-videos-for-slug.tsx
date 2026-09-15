"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { StoryVideoPanel } from "@/components/stories/story-video-panel";
import { api } from "@/convex/_generated/api";

export function StoryVideosForSlug({ slug }: { slug: string }) {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(
    api.stories.getMineBySlug,
    isAuthenticated ? { slug } : "skip"
  );

  if (!live) return null;

  const chapters = live.publishedChapters.map((c) => ({
    number: c.number,
    title: c.title,
    wordCount: c.wordCount,
  }));

  return (
    <StoryVideoPanel
      storyId={live.story._id}
      storySlug={live.story.slug}
      chapters={chapters}
      settings={{
        autoGenerateVideos: live.story.autoGenerateVideos !== false,
        autoGenerateFilm: live.story.autoGenerateFilm === true,
        allowReaderFilmRequests: live.story.allowReaderFilmRequests === true,
        autoPostTikTok: live.story.autoPostTikTok === true,
        autoPostYouTube: live.story.autoPostYouTube === true,
      }}
    />
  );
}
