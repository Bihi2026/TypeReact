"use client";

import * as React from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { VolumeX } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { caseCategoryMeta } from "@/lib/meta";
import { topicSlugs } from "@/lib/topics";
import type { CaseCategory } from "@/lib/types";
import { formatDate } from "@/lib/format";

function MutesSignedIn() {
  const { isAuthenticated } = useConvexAuth();
  const mutes = useQuery(api.mutes.listMine, isAuthenticated ? {} : "skip");
  const unmute = useMutation(api.mutes.unmute);
  const toggleTopic = useMutation(api.mutes.toggleMuteTopic);
  const [topic, setTopic] = React.useState<CaseCategory>(topicSlugs[0]!);

  if (!isAuthenticated || mutes === undefined) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Loading mutes…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="gap-3 p-4">
        <p className="text-sm font-medium">Mute a topic</p>
        <p className="text-xs text-muted-foreground">
          Hidden from Home and Following. Public Reaction IDs still open normally.
        </p>
        <div className="flex flex-wrap gap-2">
          <Select
            value={topic}
            onValueChange={(value) => setTopic(value as CaseCategory)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topicSlugs.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {caseCategoryMeta[slug].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                try {
                  const next = await toggleTopic({ topic });
                  toast.success(
                    next.muted
                      ? `Muted ${caseCategoryMeta[topic].label}`
                      : `Unmuted ${caseCategoryMeta[topic].label}`
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not update mute"
                  );
                }
              })();
            }}
          >
            Mute topic
          </Button>
        </div>
      </Card>

      {mutes.length === 0 ? (
        <EmptyState
          icon={VolumeX}
          title="No mutes yet"
          description="Mute authors from a Reaction page, or mute topics here to tidy your feeds."
        />
      ) : (
        <ul className="space-y-2">
          {mutes.map((row) => (
            <li key={row._id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {row.kind === "topic" && row.topic
                      ? caseCategoryMeta[row.topic]?.label ?? row.label
                      : row.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.kind === "author" ? "Author" : "Topic"} ·{" "}
                    {formatDate(new Date(row.createdAt).toISOString())}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      try {
                        await unmute({
                          muteId: row._id as Id<"userMutes">,
                        });
                        toast.success("Mute removed");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not unmute"
                        );
                      }
                    })();
                  }}
                >
                  Unmute
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MutesSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mutes</h1>
        <p className="text-sm text-muted-foreground">
          Feed hygiene without blocking lookup of public Reaction IDs.
        </p>
      </div>
      <Show when="signed-out">
        <EmptyState
          icon={VolumeX}
          title="Sign in to manage mutes"
          description="Mute authors and topics to keep Home and Following focused."
          action={
            <SignInButton>
              <Button>Sign in</Button>
            </SignInButton>
          }
        />
      </Show>
      <Show when="signed-in">
        <MutesSignedIn />
      </Show>
    </div>
  );
}
