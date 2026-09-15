"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { RouteLoading } from "@/components/route-loading";
import { StoryWatchPlayer } from "@/components/stories/story-watch-player";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Clapperboard } from "lucide-react";
import Link from "next/link";

export function StoryWatchRoute() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const part = Number(search.get("part") ?? "0") || undefined;
  const doc = useQuery(
    api.stories.getPublicBySlug,
    slug ? { slug } : "skip"
  );

  if (!slug || doc === undefined) {
    return <RouteLoading variant="detail" />;
  }

  if (doc === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          icon={Clapperboard}
          title="Story not found"
          description="This story is missing or not public yet."
          action={
            <Button asChild>
              <Link href="/stories">Back to stories</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <StoryWatchPlayer
      storyId={doc.story._id}
      storySlug={doc.story.slug}
      initialPart={part}
    />
  );
}
