"use client";

import Link from "next/link";
import { Bookmark, MessageSquare, ThumbsUp } from "lucide-react";
import { FollowBarkAuthorButton } from "@/components/barks/follow-author-button";
import { LikeButton } from "@/components/bark/like-button";
import { BarkCode } from "@/components/bark-code";
import { BarkTypeBadge } from "@/components/bark-type-badge";
import { EvidenceRating } from "@/components/evidence-rating";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { SaveBarkButton } from "@/components/save-bark-button";
import { Card } from "@/components/ui/card";
import { formatNumber, timeAgo } from "@/lib/format";
import { barkTypeMeta } from "@/lib/meta";
import type { Bark } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BarkCard({
  bark,
  className,
  compactActions = false,
}: {
  bark: Bark;
  className?: string;
  /** When true, show icon-only like/save on the card. */
  compactActions?: boolean;
}) {
  const authorName = bark.authorName;
  const sourceTitle = bark.sourceTitle;
  const sourcePlatform = bark.sourcePlatform;
  const creatorName = bark.sourceCreatorName;
  const showActions = Boolean(bark.live);

  return (
    <Card
      className={cn(
        "gap-0 border-l-2 p-0",
        barkTypeMeta[bark.type].borderClass,
        className
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <BarkTypeBadge type={bark.type} />
          <BarkCode code={bark.code} size="sm" />
          {bark.status === "draft" ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Draft
            </span>
          ) : null}
          {sourceTitle && sourcePlatform && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PlatformIcon platform={sourcePlatform} className="size-3.5" />
              <span className="max-w-56 truncate">
                {creatorName ? `${creatorName} — ` : ""}
                {sourceTitle}
              </span>
            </span>
          )}
          <span aria-hidden>·</span>
          <span>{timeAgo(bark.publishedAt)}</span>
        </div>

        <Link
          href={`/barks/${bark.code}`}
          className="group rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <h3 className="text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
            {bark.title}
          </h3>
        </Link>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {bark.excerpt}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {authorName && (
            <span className="flex items-center gap-2 text-sm">
              <Link
                href={`/profile/${bark.authorId}`}
                className="flex min-w-0 items-center gap-2 hover:text-primary"
              >
                <PersonAvatar
                  id={bark.authorId}
                  name={authorName}
                  className="size-6"
                />
                <span className="truncate font-medium">{authorName}</span>
              </Link>
              {bark.live ? (
                <FollowBarkAuthorButton
                  authorClerkId={bark.authorId}
                  name={authorName}
                />
              ) : null}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
            <EvidenceRating rating={bark.evidenceRating} showLabel={false} />
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden />
              {formatNumber(bark.replyCount)}
            </span>
            {showActions ? (
              <>
                <LikeButton
                  code={bark.code}
                  initialUpvotes={bark.upvotes}
                  className={compactActions ? "h-7 px-2" : undefined}
                />
                <SaveBarkButton
                  barkCode={bark.code}
                  className={cn(
                    compactActions ? "h-7 px-2" : undefined,
                    "gap-1"
                  )}
                  iconOnly={compactActions}
                  initialSaves={bark.saves}
                />
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="size-3.5" aria-hidden />
                  {formatNumber(bark.upvotes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bookmark className="size-3.5" aria-hidden />
                  {formatNumber(bark.saves)}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
