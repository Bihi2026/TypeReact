"use client";

import Link from "next/link";
import { Eye, MessageSquare } from "lucide-react";
import { FollowBarkAuthorButton } from "@/components/barks/follow-author-button";
import { LikeButton } from "@/components/bark/like-button";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { SaveBarkButton } from "@/components/save-bark-button";
import { ShareMenu } from "@/components/share-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countries } from "@/lib/countries";
import { formatNumber, gradientFor, timeAgo } from "@/lib/format";
import { homeTopicChipLabel } from "@/lib/home-discovery";
import { platformMeta } from "@/lib/meta";
import type { Bark } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeDiscussionCard({ bark }: { bark: Bark }) {
  const authorName = bark.authorName?.trim() || "Someone";
  const country = countries.find((row) => row.code === bark.country);
  const topicLabel = homeTopicChipLabel(bark);
  const thumb = bark.sourceThumbnailUrl;
  const href = `/barks/${bark.code}`;
  const platform = bark.sourcePlatform;

  return (
    <Card className="gap-0 p-0">
      <div className="rounded-xl p-3 sm:p-5">
        <div className="flex gap-3">
          <Link
            href={`/profile/${bark.authorId}`}
            className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PersonAvatar
              id={bark.authorId}
              name={authorName}
              className="size-10"
            />
            <span className="sr-only">{authorName}</span>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/profile/${bark.authorId}`}
                className="text-sm font-semibold hover:text-primary"
              >
                {authorName}
              </Link>
              <span className="text-xs text-muted-foreground">
                {country
                  ? `${country.flag} ${country.name}`
                  : bark.country || "Worldwide"}
                <span aria-hidden> · </span>
                {timeAgo(bark.publishedAt)}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {topicLabel}
              </Badge>
              {bark.live ? (
                <FollowBarkAuthorButton
                  authorClerkId={bark.authorId}
                  name={authorName}
                  size="sm"
                />
              ) : null}
            </div>
            <Link
              href={href}
              className="mt-2 block rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <h3 className="text-base font-semibold leading-snug tracking-tight hover:text-primary">
                {bark.title}
              </h3>
              {bark.excerpt ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {bark.excerpt}
                </p>
              ) : null}
            </Link>
          </div>
        </div>

        <Link
          href={href}
          className="relative mt-3 block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <div
            className={cn(
              "relative aspect-video w-full bg-gradient-to-br",
              gradientFor(bark.id)
            )}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            ) : null}
            {platform ? (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                <PlatformIcon platform={platform} className="size-3" />
                {platformMeta[platform].label}
              </span>
            ) : null}
          </div>
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {bark.live ? (
            <LikeButton
              code={bark.code}
              initialUpvotes={bark.upvotes}
              className="h-7 px-2"
            />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {formatNumber(bark.upvotes)} likes
            </span>
          )}
          <Button asChild variant="outline" size="sm" className="h-7 px-2">
            <Link href={`${href}#replies`}>
              <MessageSquare className="size-3.5" />
              {formatNumber(bark.replyCount)}
              <span className="sr-only"> replies</span>
            </Link>
          </Button>
          {bark.live ? (
            <SaveBarkButton
              barkCode={bark.code}
              iconOnly
              initialSaves={bark.saves}
              className="h-7 px-2"
            />
          ) : null}
          <ShareMenu
            code={bark.code}
            title={bark.title}
            kind="bark"
            path={href}
          />
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" aria-hidden />
            <span className="sr-only">Views </span>
            {formatNumber(bark.views)}
          </span>
        </div>
      </div>
    </Card>
  );
}
