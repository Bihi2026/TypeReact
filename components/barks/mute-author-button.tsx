"use client";

import { VolumeX } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export function MuteAuthorButton({
  authorClerkId,
  name,
  size = "sm",
}: {
  authorClerkId: string;
  name: string;
  size?: "default" | "sm";
}) {
  const { isSignedIn, userId } = useAuth();
  const isSelf = Boolean(userId && userId === authorClerkId);
  const state = useQuery(
    api.mutes.authorMuteState,
    isSelf || !authorClerkId ? "skip" : { authorClerkId }
  );
  const toggle = useMutation(api.mutes.toggleMuteAuthor);
  const muted = state?.muted ?? false;

  if (isSelf || !authorClerkId) return null;

  return (
    <Button
      size={size}
      variant={muted ? "secondary" : "outline"}
      aria-pressed={muted}
      onClick={() => {
        void (async () => {
          if (!isSignedIn) {
            toast.message("Sign in to mute authors");
            return;
          }
          try {
            const next = await toggle({ authorClerkId });
            toast.success(
              next.muted ? `Muted ${name}` : `Unmuted ${name}`,
              {
                description: next.muted
                  ? "Their reactions are hidden from your feeds."
                  : "They can appear in your feeds again.",
              }
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not update mute"
            );
          }
        })();
      }}
    >
      <VolumeX className="size-3.5" />
      {muted ? "Muted" : "Mute"}
    </Button>
  );
}
