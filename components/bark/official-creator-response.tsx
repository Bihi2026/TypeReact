"use client";

import * as React from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { playNotificationChime } from "@/components/notifications/notification-sound";
import { PersonAvatar } from "@/components/person-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { formatDate } from "@/lib/format";
import type { BarkDialogueTurn, Creator, CreatorOfficialResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OfficialCreatorResponse({
  barkCode,
  creator,
  creatorResponse,
  className,
}: {
  barkCode: string;
  creator?: Creator;
  creatorResponse?: CreatorOfficialResponse;
  className?: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const { userId } = useAuth();
  const { user } = useUser();
  const live = useQuery(api.barks.getByCode, { code: barkCode });
  const prefs = useQuery(
    api.notifications.getPrefs,
    isAuthenticated ? {} : "skip"
  );
  const mine = useQuery(api.creators.getMine, isAuthenticated ? {} : "skip");
  const respond = useMutation(api.barks.respondOfficially);
  const authorReply = useMutation(api.barks.replyToCreator);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const responsePrimed = React.useRef(false);
  const hadResponse = React.useRef(false);

  const ui = live ? toUiBark(live) : null;
  const dialogue: BarkDialogueTurn[] =
    ui?.creatorDialogue && ui.creatorDialogue.length > 0
      ? ui.creatorDialogue
      : creatorResponse
        ? [
            {
              role: "creator",
              content: creatorResponse.content,
              respondedAt: creatorResponse.respondedAt,
              verified: creatorResponse.verified,
            },
          ]
        : [];

  const soundEnabled = !isAuthenticated || prefs?.soundEnabled !== false;
  const last = dialogue[dialogue.length - 1];
  const isAuthor = Boolean(userId && ui?.authorId === userId);
  const isNamedCreator =
    Boolean(mine) && Boolean(creator) && mine?._id === creator?.id;
  const canCreatorSpeak =
    isNamedCreator && (!last || last.role === "author") && dialogue.length < 8;
  const canAuthorSpeak =
    isAuthor && last?.role === "creator" && dialogue.length < 8;

  React.useEffect(() => {
    if (live == null) return;
    const hasResponse = Boolean(
      live.creatorResponse || (live.creatorDialogue?.length ?? 0) > 0
    );
    if (!responsePrimed.current) {
      responsePrimed.current = true;
      hadResponse.current = hasResponse;
      return;
    }
    if (!hadResponse.current && hasResponse && soundEnabled) {
      void playNotificationChime();
    }
    hadResponse.current = hasResponse;
  }, [live, soundEnabled]);

  const submit = async () => {
    if (!draft.trim()) {
      toast.error("Write a response first.");
      return;
    }
    setPosting(true);
    try {
      if (canCreatorSpeak) {
        await respond({ code: barkCode, content: draft });
        toast.success("Official response posted");
      } else if (canAuthorSpeak) {
        await authorReply({ code: barkCode, content: draft });
        toast.success("Author reply posted");
      }
      setDraft("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post response"
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <section
      aria-labelledby="bark-creator-response"
      className={cn("space-y-3", className)}
    >
      {dialogue.length > 0 ? (
        <div className="space-y-3">
          <h2
            id="bark-creator-response"
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-verified"
          >
            <BadgeCheck className="size-4" aria-hidden />
            Official dialogue
          </h2>
          {dialogue.map((turn, i) => {
            const isCreator = turn.role === "creator";
            const name = isCreator
              ? creator?.name ?? "Creator"
              : ui?.authorName ?? user?.fullName ?? "Author";
            const id = isCreator
              ? creator?.id ?? "creator"
              : ui?.authorId ?? "author";
            return (
              <div
                key={`${turn.respondedAt}-${i}`}
                className={cn(
                  "rounded-lg border p-4",
                  isCreator
                    ? "border-verified/40 bg-verified/[0.04]"
                    : "border-border bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2">
                  <PersonAvatar id={id} name={name} className="size-8" />
                  <div>
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {name}
                      {turn.verified && <VerifiedBadge className="size-3.5" />}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        · {isCreator ? "Creator" : "Author"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(turn.respondedAt)}
                    </p>
                  </div>
                </div>
                <blockquote className="mt-3 border-l-2 border-verified/40 pl-4 text-sm leading-relaxed">
                  {turn.content}
                </blockquote>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Official Creator Response
          </p>
          <p className="mt-1">
            The creator has not responded to this reaction.
          </p>
        </div>
      )}

      {(canCreatorSpeak || canAuthorSpeak) && (
        <Card className="space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="size-4 text-verified" aria-hidden />
            {canCreatorSpeak
              ? dialogue.length === 0
                ? "Post official response"
                : "Creator follow-up"
              : "Author rebuttal"}
          </h3>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              canCreatorSpeak
                ? "Respond on the record to this community reaction."
                : "Reply to the creator on the record."
            }
            className="min-h-28"
          />
          <Button size="sm" disabled={posting} onClick={() => void submit()}>
            {posting ? "Posting…" : "Publish"}
          </Button>
        </Card>
      )}
    </section>
  );
}
