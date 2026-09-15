"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { genreMeta } from "@/lib/story-meta";
import type { StoryGenre } from "@/lib/story-types";
import { timeAgo } from "@/lib/format";

function excerpt(text: string, max = 160) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export function AssignedIdeasInbox() {
  const { isAuthenticated } = useConvexAuth();
  const assigned = useQuery(
    api.storyIdeas.listAssignedToMe,
    isAuthenticated ? {} : "skip"
  );

  if (assigned === undefined) {
    return (
      <p className="text-sm text-muted-foreground">Loading assigned ideas…</p>
    );
  }

  if (assigned.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" aria-hidden />
          Assigned ideas
        </CardTitle>
        <CardDescription>
          Editorial pitches assigned to you as drafts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assigned.map((idea) => (
          <div
            key={idea._id}
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{idea.title}</p>
                <Badge variant="secondary" className="font-mono text-xs">
                  {idea.ideaCode}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                From {idea.submitterName}
                {idea.genre
                  ? ` · ${genreMeta[idea.genre as StoryGenre]?.label ?? idea.genre}`
                  : null}
                {idea.assignedAt
                  ? ` · assigned ${timeAgo(new Date(idea.assignedAt).toISOString())}`
                  : null}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {excerpt(idea.pitch)}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href={`/stories/write/${idea.storySlug}`}>
                Open draft <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
