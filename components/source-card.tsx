import Link from "next/link";
import type { ReactNode } from "react";
import { Eye, MessageSquare, Scale } from "lucide-react";
import { EvidenceRating } from "@/components/evidence-rating";
import { CreatorClaimBadge } from "@/components/creators/creator-claim-badge";
import { PersonAvatar } from "@/components/person-avatar";
import { ViewOriginalSourceLink } from "@/components/sources/view-original-source-link";
import { SourceActionBar } from "@/components/sources/source-action-bar";
import { SourceThumb } from "@/components/source-thumb";
import { VerifiedBadge } from "@/components/verified-badge";
import { Card } from "@/components/ui/card";
import { getCreator } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { platformMeta } from "@/lib/meta";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

function SourceLink({
  href,
  external,
  className,
  children,
}: {
  href: string;
  external: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function CreatorStatusBadge({
  status,
}: {
  status: "unclaimed" | "claimed" | "pending";
}) {
  return <CreatorClaimBadge state={status} className="shrink-0" />;
}

export function SourceCard({
  source,
  className,
  mobileSourceLinkActions = false,
  showActionBar = false,
  showWatch = true,
  discussionCode,
  discussionHref,
  views,
  creatorStatus,
  creatorHandle,
}: {
  source: Source;
  className?: string;
  /** Mobile: inline watch/copy panel instead of navigating straight to the URL. */
  mobileSourceLinkActions?: boolean;
  /** Always-visible watch / copy / read discussion row (home page). */
  showActionBar?: boolean;
  /** When showActionBar is set, hide the Watch/Open button. */
  showWatch?: boolean;
  discussionCode?: string;
  /** When set with showActionBar, thumb/title navigate here instead of external URL. */
  discussionHref?: string;
  views?: number;
  creatorStatus?: "unclaimed" | "claimed" | "pending";
  creatorHandle?: string;
}) {
  const creator = source.creatorId
    ? getCreator(source.creatorId)
    : undefined;
  const creatorName = creator?.name ?? source.creatorName;
  const resolvedHandle = creatorHandle ?? creator?.handle;
  const creatorHref = resolvedHandle
    ? `/creators/${resolvedHandle}`
    : creator
      ? `/creators/${creator.handle}`
      : undefined;

  const useDiscussionLink = showActionBar && Boolean(discussionHref);
  const mediaHref = useDiscussionLink
    ? discussionHref!
    : creatorHref ?? (source.url || "#");
  const mediaExternal = useDiscussionLink
    ? false
    : !creatorHref && Boolean(source.url);
  const deferExternalOnMobile =
    mobileSourceLinkActions && mediaExternal && Boolean(source.url);

  const thumb = (
    <SourceThumb source={source} className="aspect-video w-full rounded-none" />
  );

  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      {deferExternalOnMobile ? (
        <>
          <div className="block lg:hidden">{thumb}</div>
          <SourceLink
            href={mediaHref}
            external={mediaExternal}
            className="hidden focus-visible:outline-2 focus-visible:outline-ring lg:block"
          >
            {thumb}
          </SourceLink>
        </>
      ) : (
        <SourceLink
          href={mediaHref}
          external={mediaExternal}
          className="block focus-visible:outline-2 focus-visible:outline-ring"
        >
          {thumb}
        </SourceLink>
      )}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {platformMeta[source.platform]?.label ?? source.platform}
          </Badge>
          {source.category &&
          source.category !== platformMeta[source.platform].label ? (
            <Badge variant="outline" className="text-[11px]">
              {source.category}
            </Badge>
          ) : null}
        </div>
        {deferExternalOnMobile ? (
          <>
            <p className="line-clamp-2 font-semibold leading-snug tracking-tight text-sm lg:hidden">
              {source.title}
            </p>
            <SourceLink
              href={mediaHref}
              external={mediaExternal}
              className="line-clamp-2 hidden font-semibold leading-snug tracking-tight text-sm hover:underline lg:block"
            >
              {source.title}
            </SourceLink>
          </>
        ) : (
          <SourceLink
            href={mediaHref}
            external={mediaExternal}
            className="line-clamp-2 font-semibold leading-snug tracking-tight text-sm hover:underline"
          >
            {source.title}
          </SourceLink>
        )}
        {showActionBar && source.url ? (
          <SourceActionBar
            url={source.url}
            platform={source.platform}
            discussionCode={discussionCode}
            showWatch={showWatch}
          />
        ) : null}
        {mobileSourceLinkActions && source.url && !showActionBar ? (
          <ViewOriginalSourceLink
            url={source.url}
            platform={source.platform}
          />
        ) : null}
        {creatorName ? (
          creatorHref ? (
            <Link
              href={creatorHref}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <PersonAvatar
                id={creator?.id ?? source.creatorId ?? source.id}
                name={creatorName}
                className="size-5 shrink-0"
              />
              <span className="min-w-0 truncate">{creatorName}</span>
              {creator?.verified && (
                <VerifiedBadge className="size-3.5 shrink-0" />
              )}
              {creatorStatus ? (
                <CreatorStatusBadge status={creatorStatus} />
              ) : null}
            </Link>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PersonAvatar
                id={source.id}
                name={creatorName}
                className="size-5 shrink-0"
              />
              <span className="min-w-0 truncate">{creatorName}</span>
              {creatorStatus ? (
                <CreatorStatusBadge status={creatorStatus} />
              ) : null}
            </p>
          )
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden />
            {formatNumber(source.barkCount)} Reactions
          </span>
          {views !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden />
              {formatNumber(views)} views
            </span>
          )}
          {source.caseCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Scale className="size-3.5" aria-hidden />
              {source.caseCount} {source.caseCount === 1 ? "Case" : "Cases"}
            </span>
          )}
          <EvidenceRating rating={source.evidenceRating} showLabel={false} />
        </div>
      </div>
    </Card>
  );
}
