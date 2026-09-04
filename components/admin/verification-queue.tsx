"use client";

import { BadgeCheck, Clock3, X } from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { platformMeta } from "@/lib/meta";
import type { SourcePlatform } from "@/lib/types";

function waitingLabel(createdAt: number) {
  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000));
  if (hours < 1) return "less than an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function basisLabel(row: {
  verificationMethod: "connect" | "code";
  platforms: SourcePlatform[];
}) {
  const platforms = row.platforms
    .map((p) => platformMeta[p]?.label ?? p)
    .join(", ");
  if (row.verificationMethod === "connect") {
    return platforms
      ? `Connected accounts (${platforms})`
      : "Connected accounts";
  }
  return platforms
    ? `Verification code in bio (${platforms})`
    : "Verification code in bio";
}

function PendingApplicationRow({
  row,
  onAct,
}: {
  row: {
    _id: Id<"creators">;
    name: string;
    applicationCode: string;
    createdAt: number;
    verificationMethod: "connect" | "code";
    platforms: SourcePlatform[];
  };
  onAct: (creatorId: Id<"creators">, action: "approve" | "reject") => void;
}) {
  const verification = useQuery(api.creatorVerifications.getByCreatorId, {
    creatorId: row._id,
  });

  return (
    <Card className="flex-row items-start gap-4 p-4">
      <PersonAvatar id={row._id} name={row.name} className="size-10" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {row.name}{" "}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {row.applicationCode}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Creator application · {basisLabel(row)} · waiting{" "}
          {waitingLabel(row.createdAt)}
        </p>
        {verification && (
          <div className="mt-2 space-y-0.5 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">TR ID:</span>{" "}
              <span className="font-mono">{verification.verificationId}</span>
            </p>
            <p>
              <span className="font-medium text-foreground">Legal name:</span>{" "}
              {verification.legalName}
            </p>
            <p>
              <span className="font-medium text-foreground">Contacts:</span>{" "}
              {verification.emergencyContacts.length} emergency ·{" "}
              {verification.email}
            </p>
            {verification.proofPostUrl ? (
              <p className="truncate">
                <span className="font-medium text-foreground">Proof:</span>{" "}
                {verification.proofPostUrl}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => onAct(row._id, "approve")}>
          <BadgeCheck className="size-3.5" /> Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAct(row._id, "reject")}
        >
          <X className="size-3.5" /> Reject
        </Button>
      </div>
    </Card>
  );
}

export function VerificationQueue() {
  const { isAuthenticated } = useConvexAuth();
  const pending = useQuery(
    api.creators.listPending,
    isAuthenticated ? {} : "skip"
  );
  const approve = useMutation(api.creators.approve);
  const reject = useMutation(api.creators.reject);

  const act = async (
    creatorId: Id<"creators">,
    action: "approve" | "reject"
  ) => {
    try {
      if (action === "approve") await approve({ creatorId });
      else await reject({ creatorId });
      toast.success(
        action === "approve" ? "Creator approved" : "Application rejected"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update application"
      );
    }
  };

  if (pending === undefined) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading applications…
      </p>
    );
  }

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={Clock3}
        title="No pending applications"
        description="Creator applications appear here until they are approved or rejected."
      />
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((row) => (
        <PendingApplicationRow key={row._id} row={row} onAct={act} />
      ))}
    </div>
  );
}
