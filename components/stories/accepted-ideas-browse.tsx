"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useQuery } from "convex/react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { genreMeta } from "@/lib/story-meta";
import type { StoryGenre } from "@/lib/story-types";

function excerpt(text: string, max = 220) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export function AcceptedIdeasBrowse() {
  const ideas = useQuery(api.storyIdeas.listAcceptedPublic);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="size-4" aria-hidden />
          Editorial picks
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Accepted story ideas
        </h1>
        <p className="text-muted-foreground">
          Concepts the editorial team has greenlit. Open ideas are waiting for a
          writer assignment; in-progress ideas already have a draft. Publishing
          still happens through the writer dashboard.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild>
            <Link href="/stories/submit-idea">
              Submit a story idea <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/stories">Back to stories</Link>
          </Button>
        </div>
      </div>

      {ideas === undefined ? (
        <p className="text-sm text-muted-foreground">Loading accepted ideas…</p>
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No accepted ideas yet"
          description="When editorial accepts a pitch, it will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li key={idea._id}>
              <Card className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{idea.title}</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={idea.assigned ? "outline" : "default"}
                      className="text-xs"
                    >
                      {idea.assigned ? "In progress" : "Open"}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {idea.ideaCode}
                    </Badge>
                  </div>
                </div>
                {idea.genre ? (
                  <p className="text-xs text-muted-foreground">
                    {genreMeta[idea.genre as StoryGenre]?.label ?? idea.genre}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {excerpt(idea.pitch)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
