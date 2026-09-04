"use client";

import { useQuery } from "convex/react";
import { SourceCard } from "@/components/source-card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiCreator } from "@/lib/creators/query";
import type { Source } from "@/lib/types";

function mapCreatorStatus(
  creator: ReturnType<typeof toUiCreator> | null
): "unclaimed" | "claimed" | "pending" | undefined {
  if (!creator) return undefined;
  if (creator.status === "pending") return "pending";
  if (creator.status === "unclaimed" || !creator.hasTeaBarksProfile) {
    return "unclaimed";
  }
  return "claimed";
}

export function HomeSourceCard({
  source,
  discussionCode,
  views,
  creatorId,
}: {
  source: Source;
  discussionCode?: string;
  views: number;
  creatorId?: string;
}) {
  const creatorDoc = useQuery(
    api.creators.getById,
    creatorId ? { id: creatorId as Id<"creators"> } : "skip"
  );
  const creator = creatorDoc ? toUiCreator(creatorDoc) : null;
  const creatorStatus = mapCreatorStatus(creator);

  return (
    <SourceCard
      source={
        creator
          ? {
              ...source,
              creatorId: creator.id,
              creatorName: creator.name,
            }
          : source
      }
      showActionBar
      showWatch={false}
      discussionCode={discussionCode}
      views={views}
      creatorStatus={creatorStatus}
      creatorHandle={creator?.handle}
      discussionHref={
        discussionCode ? `/barks/${discussionCode}` : undefined
      }
    />
  );
}
