"use client";

import * as React from "react";
import { ExternalLink, Play } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { SourceThumb } from "@/components/source-thumb";
import { Button } from "@/components/ui/button";
import {
  resolveSourceEmbed,
  sourceEmbedIsPlayable,
  type SourceEmbedAspect,
} from "@/lib/sources/embed";
import { platformMeta } from "@/lib/meta";
import type { Source, SourcePlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const aspectClass: Record<SourceEmbedAspect, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-[min(70vh,36rem)] mx-auto w-full max-w-sm",
  "1:1": "aspect-square max-w-md mx-auto w-full",
};

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

export function SourceVideoPlayer({
  source,
  className,
  autoLoad = false,
  compact = false,
}: {
  source: Source;
  className?: string;
  /** Skip click-to-load (e.g. create wizard preview). */
  autoLoad?: boolean;
  /** Smaller chrome for cards. */
  compact?: boolean;
}) {
  const embed = React.useMemo(
    () => resolveSourceEmbed(source.url, source.platform),
    [source.url, source.platform]
  );
  const [loaded, setLoaded] = React.useState(autoLoad);
  const playable = sourceEmbedIsPlayable(embed);
  const platformLabel =
    platformMeta[source.platform]?.label ?? source.platform;

  React.useEffect(() => {
    setLoaded(autoLoad);
  }, [source.url, autoLoad]);

  if (!playable || embed.kind === "none") {
    return (
      <div className={cn("space-y-2", className)}>
        <SourceThumb
          source={source}
          className={cn(
            "w-full rounded-none",
            compact ? "aspect-video" : "aspect-video"
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">
            {embed.kind === "none"
              ? embed.reason
              : "This source can’t be embedded"}
            . Open on {platformLabel} instead.
          </p>
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
    );
  }

  const frameClass = cn(
    "relative w-full overflow-hidden bg-black",
    aspectClass[embed.aspect],
    !compact && "rounded-none"
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className={frameClass}>
        {!loaded ? (
          <button
            type="button"
            className="group absolute inset-0 flex items-center justify-center"
            onClick={() => setLoaded(true)}
            aria-label={`Play ${platformLabel} source in TypeReact`}
          >
            <SourceThumb
              source={source}
              className="absolute inset-0 h-full w-full rounded-none"
            />
            <span className="relative z-10 flex size-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-transform group-hover:scale-105">
              <Play className="size-7 fill-current" aria-hidden />
            </span>
            <span className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white">
              <PlatformIcon platform={source.platform} className="size-3.5" />
              Play in TypeReact
            </span>
          </button>
        ) : embed.kind === "html5" ? (
          <video
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-contain"
            src={embed.src}
          >
            {embed.contentType ? (
              <source src={embed.src} type={embed.contentType} />
            ) : null}
          </video>
        ) : (
          <iframe
            title={embed.title}
            src={embed.src}
            className="absolute inset-0 size-full border-0"
            allow={IFRAME_ALLOW}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <PlatformIcon platform={source.platform as SourcePlatform} className="size-3.5" />
          Watching on TypeReact · {platformLabel}
        </p>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open on {platformLabel}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
