import { Badge } from "@/components/ui/badge";
import type { CreatorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CreatorClaimState = "unclaimed" | "claimed" | "pending";

export function creatorClaimState(creator: {
  status?: CreatorStatus;
  hasTeaBarksProfile?: boolean;
}): CreatorClaimState {
  if (creator.status === "pending") return "pending";
  if (creator.status === "unclaimed" || !creator.hasTeaBarksProfile) {
    return "unclaimed";
  }
  return "claimed";
}

export function CreatorClaimBadge({
  state,
  className,
}: {
  state: CreatorClaimState;
  className?: string;
}) {
  if (state === "unclaimed") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-disagree/30 bg-disagree/15 text-[10px] uppercase tracking-wide text-disagree",
          className
        )}
      >
        Unclaimed
      </Badge>
    );
  }

  if (state === "pending") {
    return (
      <Badge
        variant="secondary"
        className={cn("text-[10px]", className)}
      >
        Pending
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-agree/30 bg-agree/10 text-[10px] text-agree",
        className
      )}
    >
      Claimed
    </Badge>
  );
}
