import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  CreatorClaimBadge,
  creatorClaimState,
} from "@/components/creators/creator-claim-badge";
import { PersonAvatar } from "@/components/person-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { REACTION_PLURAL } from "@/lib/brand";
import { formatNumber } from "@/lib/format";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BarkCreatorPanel({ creator }: { creator: Creator }) {
  const handleLabel = creator.externalHandle
    ? `@${creator.externalHandle}`
    : `@${creator.handle}`;
  const claimState = creatorClaimState(creator);
  const isUnclaimed = claimState === "unclaimed";

  return (
    <Card className="gap-0 p-0">
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Source creator</h2>
          <p className="text-xs text-muted-foreground">
            Profile and discussion stats
          </p>
        </div>

        <div className="flex items-start gap-3">
          <PersonAvatar
            id={creator.id}
            name={creator.name}
            className="size-11 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-1.5 font-semibold leading-tight">
              <span className="truncate">{creator.name}</span>
              {creator.verified && (
                <VerifiedBadge className="size-3.5 shrink-0" />
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {handleLabel}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <CreatorClaimBadge state={claimState} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-center text-xs">
          <div>
            <p className="font-semibold tabular-nums text-foreground">
              {formatNumber(creator.followers)}
            </p>
            <p className="text-muted-foreground">followers</p>
          </div>
          <div>
            <p
              className={cn(
                "inline-flex items-center justify-center gap-1 font-semibold tabular-nums text-foreground"
              )}
            >
              <MessageSquareText className="size-3 text-muted-foreground" />
              {formatNumber(creator.totalBarksReceived)}
            </p>
            <p className="text-muted-foreground">
              {REACTION_PLURAL.toLowerCase()}
            </p>
          </div>
        </div>

        <Button
          asChild
          className="w-full"
          size="sm"
          variant={isUnclaimed ? "outline" : "default"}
        >
          <Link href={`/creators/${creator.handle}`}>View profile</Link>
        </Button>
      </div>
    </Card>
  );
}
