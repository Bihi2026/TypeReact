"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { CircleHelp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AskForEvidenceButton({
  barkCode,
  blockIndex,
  claimSnippet,
  className,
}: {
  barkCode: string;
  blockIndex: number;
  claimSnippet: string;
  className?: string;
}) {
  const { isSignedIn } = useAuth();
  const requestEvidence = useMutation(api.barks.requestEvidence);
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/anchor:opacity-100 focus-visible:opacity-100",
        className
      )}
      aria-label="Ask for evidence"
      disabled={busy}
      onClick={() => {
        void (async () => {
          if (!isSignedIn) {
            toast.message("Sign in to ask for evidence");
            return;
          }
          setBusy(true);
          try {
            await requestEvidence({
              code: barkCode,
              blockIndex,
              claimSnippet: claimSnippet.slice(0, 280),
            });
            toast.success("Evidence requested", {
              description: "The author was notified.",
            });
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not send request"
            );
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <CircleHelp className="size-3" aria-hidden />
      Source?
    </button>
  );
}

export function EvidenceRequestsPanel({
  code,
  authorClerkId,
}: {
  code: string;
  authorClerkId: string;
}) {
  const { isSignedIn, userId } = useAuth();
  const isAuthor = Boolean(userId && userId === authorClerkId);
  const requests = useQuery(
    api.barks.listEvidenceRequests,
    isSignedIn ? { code } : "skip"
  );
  const resolve = useMutation(api.barks.resolveEvidenceRequest);

  if (!isSignedIn || requests === undefined) return null;
  const open = requests.filter((r) => r.status === "open");
  const recent = requests.filter((r) => r.status !== "open").slice(0, 3);
  if (open.length === 0 && recent.length === 0) return null;

  return (
    <Card className="gap-0 p-0">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Evidence requests</h3>
        <p className="text-xs text-muted-foreground">
          Readers asking for sources on specific claims.
        </p>
      </div>
      <ul className="divide-y">
        {open.map((req) => (
          <li key={req._id} className="space-y-2 px-4 py-3">
            <a
              href={`#${req.blockHash}`}
              className="text-sm font-medium hover:underline"
            >
              “{req.claimSnippet}”
            </a>
            <p className="text-[11px] text-muted-foreground">
              {req.requesterName} · {formatDate(new Date(req.createdAt).toISOString())}
              {req.note ? ` · ${req.note}` : ""}
            </p>
            {isAuthor ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => {
                    void (async () => {
                      try {
                        await resolve({
                          requestId: req._id as Id<"evidenceRequests">,
                          action: "resolved",
                        });
                        toast.success("Marked resolved");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not resolve"
                        );
                      }
                    })();
                  }}
                >
                  <Check className="size-3.5" />
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    void (async () => {
                      try {
                        await resolve({
                          requestId: req._id as Id<"evidenceRequests">,
                          action: "dismissed",
                        });
                        toast.success("Request dismissed");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not dismiss"
                        );
                      }
                    })();
                  }}
                >
                  <X className="size-3.5" />
                  Dismiss
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {recent.map((req) => (
          <li
            key={req._id}
            className="px-4 py-2 text-[11px] text-muted-foreground"
          >
            {req.status}: “{req.claimSnippet.slice(0, 60)}
            {req.claimSnippet.length > 60 ? "…" : ""}”
          </li>
        ))}
      </ul>
    </Card>
  );
}
