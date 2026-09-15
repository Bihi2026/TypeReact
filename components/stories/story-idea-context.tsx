"use client";

import { Lightbulb } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function StoryIdeaContext({ storyId }: { storyId: Id<"stories"> }) {
  const { isAuthenticated } = useConvexAuth();
  const idea = useQuery(
    api.storyIdeas.getIdeaForStory,
    isAuthenticated ? { storyId } : "skip"
  );

  if (idea === undefined || idea === null) return null;

  return (
    <aside className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Lightbulb className="size-3.5 text-primary" aria-hidden />
          From story idea
        </p>
        <Badge variant="secondary" className="font-mono text-xs">
          {idea.ideaCode}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Pitched by {idea.submitterName}
      </p>
      <p className="whitespace-pre-wrap text-muted-foreground">{idea.pitch}</p>
      {idea.notes ? (
        <p className="border-t pt-2 text-xs italic text-muted-foreground">
          Editor notes from submitter: {idea.notes}
        </p>
      ) : null}
      {idea.reviewNote ? (
        <p className="text-xs italic text-muted-foreground">
          Review note: {idea.reviewNote}
        </p>
      ) : null}
    </aside>
  );
}
