"use client";

import { ThumbsUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { barkKeys } from "@/lib/barks/query";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LikeButton({
  code,
  initialUpvotes,
  className,
}: {
  code: string;
  initialUpvotes: number;
  className?: string;
}) {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const state = useQuery(api.barks.likeState, { code });
  const toggleLike = useMutation(api.barks.toggleLike);
  const upvotes = state?.upvotes ?? initialUpvotes;
  const liked = state?.liked ?? false;

  const onClick = async () => {
    if (!isSignedIn) {
      toast.error("Sign in to like this reaction.");
      return;
    }
    try {
      await toggleLike({ code });
      await queryClient.invalidateQueries({ queryKey: barkKeys.public });
      await queryClient.invalidateQueries({ queryKey: barkKeys.detail(code) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not like");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void onClick()}
      aria-pressed={liked}
      className={cn(
        liked && "border-primary/50 bg-primary/10 text-primary",
        className
      )}
    >
      <ThumbsUp className="size-3.5" />
      {formatNumber(upvotes)}
    </Button>
  );
}
