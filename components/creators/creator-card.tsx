import Link from "next/link";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { countries } from "@/lib/data";
import { BRAND_NAME, REACTION_PLURAL } from "@/lib/brand";
import { formatNumber, gradientFor } from "@/lib/format";
import { platformMeta } from "@/lib/meta";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

function responseTone(rate: number) {
  if (rate >= 70) return "text-agree";
  if (rate >= 40) return "text-mixed-foreground dark:text-mixed";
  return "text-disagree";
}

export function CreatorCard({
  creator,
  featured = false,
  className,
}: {
  creator: Creator;
  featured?: boolean;
  className?: string;
}) {
  const country = countries.find((c) => c.code === creator.country);
  const handleLabel = creator.externalHandle
    ? `@${creator.externalHandle}`
    : `@${creator.handle}`;
  const isUnclaimed =
    creator.status === "unclaimed" || !creator.hasTeaBarksProfile;
  const primaryPlatform = creator.externalPlatform ?? creator.platforms[0];

  return (
    <Link
      href={`/creators/${creator.handle}`}
      className={cn("group block h-full", className)}
    >
      <Card className="h-full gap-0 overflow-hidden p-0 transition-colors group-hover:border-primary/40">
        <div
          className={cn(
            "relative h-20 bg-gradient-to-br sm:h-24",
            gradientFor(creator.id)
          )}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute right-3 top-3 flex gap-1.5">
            {primaryPlatform && (
              <Badge
                variant="secondary"
                className="border-0 bg-background/90 text-[10px] text-foreground backdrop-blur"
              >
                <PlatformIcon platform={primaryPlatform} className="mr-1 size-3" />
                {platformMeta[primaryPlatform].label}
              </Badge>
            )}
            {isUnclaimed ? (
              <Badge
                variant="secondary"
                className="border-0 bg-background/80 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur"
              >
                Unclaimed
              </Badge>
            ) : creator.hasTeaBarksProfile ? (
              <Badge
                variant="secondary"
                className="border-0 bg-background/90 text-[10px] text-foreground backdrop-blur"
              >
                On {BRAND_NAME}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-3 px-4 pb-4 pt-0">
          <PersonAvatar
            id={creator.id}
            name={creator.name}
            className="-mt-8 size-14 border-4 border-background text-base shadow-sm"
          />

          <div className="min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-1.5 font-semibold tracking-tight group-hover:text-primary">
                <span className="truncate">{creator.name}</span>
                {creator.verified && (
                  <VerifiedBadge className="size-4 shrink-0" />
                )}
              </h3>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="text-xs text-muted-foreground">
              {handleLabel}
              {country ? ` · ${country.flag} ${country.name}` : ""}
            </p>
          </div>

          <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {creator.bio}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {creator.topics.slice(0, 2).map((t) => (
              <Badge key={t} variant="secondary" className="capitalize text-[10px]">
                {t}
              </Badge>
            ))}
            {creator.platforms.slice(0, 3).map((p) => (
              <span
                key={p}
                className="inline-flex size-6 items-center justify-center rounded-md border text-muted-foreground"
              >
                <PlatformIcon platform={p} className="size-3.5" />
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
            <div>
              <p className="font-semibold tabular-nums text-foreground">
                {formatNumber(creator.followers)}
              </p>
              <p className="text-muted-foreground">followers</p>
            </div>
            <div>
              <p className="inline-flex items-center justify-center gap-1 font-semibold tabular-nums text-foreground">
                <MessageSquareText className="size-3 text-muted-foreground" />
                {formatNumber(creator.totalBarksReceived)}
              </p>
              <p className="text-muted-foreground">
                {BRAND_NAME} {REACTION_PLURAL.toLowerCase()}
              </p>
            </div>
            <div>
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  responseTone(creator.responseRate)
                )}
              >
                {creator.responseRate}%
              </p>
              <p className="text-muted-foreground">responds</p>
            </div>
          </div>

          {featured && (
            <p className="text-[11px] text-muted-foreground">
              High discussion volume · {creator.totalSources} indexed sources
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
