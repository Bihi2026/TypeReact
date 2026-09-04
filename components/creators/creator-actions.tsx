"use client";

import Link from "next/link";
import { Check, Scale, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { StartMessageButton } from "@/components/messages/start-message-button";
import { ReportButton } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function CreatorFollowButton({
  creatorId,
  name,
  size = "default",
  followable = true,
}: {
  creatorId: string;
  name: string;
  size?: "default" | "sm";
  followable?: boolean;
}) {
  const { isSignedIn } = useAuth();
  const id = creatorId as Id<"creators">;
  const state = useQuery(
    api.creators.followState,
    followable ? { creatorId: id } : "skip"
  );
  const toggleFollow = useMutation(api.creators.toggleFollow);

  if (!followable || state === null) return null;
  if (state === undefined) return null;
  if (state.isSelf) return null;

  const following = state.following;

  return (
    <Button
      size={size}
      variant={following ? "outline" : "default"}
      onClick={() => {
        void (async () => {
          if (!isSignedIn) {
            toast.message("Sign in to follow this creator");
            return;
          }
          try {
            const next = await toggleFollow({ creatorId: id });
            toast.success(
              next.following ? `Following ${name}` : `Unfollowed ${name}`,
              {
                description: next.following
                  ? "You'll see new reactions about this creator."
                  : "Removed from your following feed.",
              }
            );
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not update follow"
            );
          }
        })();
      }}
    >
      {following ? (
        <>
          <Check className="size-4" /> Following
        </>
      ) : (
        <>
          <UserPlus className="size-4" /> Follow
        </>
      )}
    </Button>
  );
}

export function CreatorProfileActions({
  creatorId,
  name,
  handle,
  followable = true,
}: {
  creatorId: string;
  name: string;
  handle: string;
  followable?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {followable ? (
        <CreatorFollowButton
          creatorId={creatorId}
          name={name}
          followable={followable}
        />
      ) : null}
      <StartMessageButton kind="creator" creatorHandle={handle} />
      <Button asChild variant="outline">
        <Link href={`/cases/new?creator=${handle}`}>
          <Scale className="size-4" /> Open case
        </Link>
      </Button>
      <ReportButton target={`profile @${handle}`} iconOnly />
    </div>
  );
}
