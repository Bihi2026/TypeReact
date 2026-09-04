"use client";

import { AlertTriangle, Shield } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { AdminGate } from "@/components/admin/admin-gate";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

const actionLabel = {
  report: "Report received",
  report_dismiss: "Report dismissed",
  creator_approve: "Creator approved",
  creator_reject: "Creator rejected",
  writer_approve: "Writer approved",
  writer_reject: "Writer rejected",
  case_publish: "Case published",
  case_resolve: "Case resolved",
} as const;

function relativeTime(ms: number) {
  const seconds = Math.max(0, (Date.now() - ms) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  if (days < 7) return `${Math.round(days)}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function AdminModeration() {
  const { isAuthenticated } = useConvexAuth();
  const events = useQuery(
    api.admin.listModerationEvents,
    isAuthenticated ? {} : "skip"
  );

  return (
    <AdminGate loading="Loading moderation log…" allowed={events}>
      {events && events.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No moderation activity"
          description="Reports and admin decisions will show up here as they happen."
        />
      ) : (
        <div className="space-y-3">
          {(events ?? []).map((m) => (
            <Card key={m._id} className="flex-row items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <AlertTriangle
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {actionLabel[m.kind]} —{" "}
                  <span className="font-mono text-xs">{m.targetLabel}</span>
                </p>
                <p className="text-sm text-muted-foreground">{m.note}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  By {m.actorName} · {relativeTime(m.createdAt)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminGate>
  );
}
