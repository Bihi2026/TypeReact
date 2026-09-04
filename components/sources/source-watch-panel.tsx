"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { SaveSourceButton } from "@/components/sources/save-source-button";
import { SourceThumb } from "@/components/source-thumb";
import { SourceVideoPlayer } from "@/components/sources/source-video-player";
import { Button } from "@/components/ui/button";
import {
  resolveSourceEmbed,
  sourceEmbedIsPlayable,
} from "@/lib/sources/embed";
import { formatDate } from "@/lib/format";
import { platformMeta } from "@/lib/meta";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Compact source header for Reaction detail: thumb by default.
 * Embeddable sources get an opt-in "Watch in TypeReact" control.
 * Owns its tree (no RSC children) so opt-in expand stays a local client update.
 */
export function SourceWatchPanel({
  source,
  creatorName,
  creatorHandle,
  creatorHasProfile,
  showSave,
  className,
}: {
  source: Source;
  creatorName: string;
  creatorHandle?: string;
  creatorHasProfile?: boolean;
  showSave?: boolean;
  className?: string;
}) {
  const embed = React.useMemo(
    () => resolveSourceEmbed(source.url, source.platform),
    [source.url, source.platform]
  );
  const playable = sourceEmbedIsPlayable(embed);
  const [watching, setWatching] = React.useState(false);
  const platformLabel =
    platformMeta[source.platform]?.label ?? source.platform;

  return (
    <div className={cn("min-w-0 gap-0 overflow-hidden", className)}>
      {watching && playable ? (
        <SourceVideoPlayer key="player" source={source} autoLoad />
      ) : (
        <SourceThumb
          key="thumb"
          source={source}
          className="aspect-video w-full rounded-none"
        />
      )}
      <div className="min-w-0 space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Responding to
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {source.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <PlatformIcon platform={source.platform} className="size-3.5" />
          {platformLabel}
          <span aria-hidden>·</span>
          {creatorHasProfile && creatorHandle ? (
            <Link
              href={`/creators/${creatorHandle}`}
              className="font-medium text-foreground hover:underline"
            >
              {creatorName}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{creatorName}</span>
          )}
          <span aria-hidden>·</span>
          {formatDate(source.publishedAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {playable && !watching ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setWatching(true)}
            >
              <Play className="size-3.5 fill-current" aria-hidden />
              Watch in TypeReact
            </Button>
          ) : null}
          {showSave && source.url ? (
            <SaveSourceButton
              sourceUrl={source.url}
              sourceTitle={source.title}
              sourcePlatform={source.platform}
              sourceCreatorName={creatorName}
              sourceThumbnailUrl={source.thumbnailUrl}
            />
          ) : null}
          {source.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden />
                Open on {platformLabel}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
