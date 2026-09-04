"use client";

import * as React from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin/admin-gate";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { reportCategoryMeta, reportSeverityMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

const kindFilters = [
  { id: "all", label: "All" },
  { id: "bark", label: "Reactions" },
  { id: "case", label: "Cases" },
  { id: "story", label: "Stories" },
] as const;

const kindBadge: Record<"bark" | "case" | "story", string> = {
  bark: "Reaction",
  case: "Case",
  story: "Story",
};

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

export function AdminInbox() {
  const { isAuthenticated } = useConvexAuth();
  const dismissReport = useMutation(api.admin.dismissReport);
  const [kind, setKind] = React.useState<(typeof kindFilters)[number]["id"]>(
    "all"
  );
  const reports = useQuery(
    api.admin.listReports,
    isAuthenticated
      ? kind === "all"
        ? {}
        : { kind }
      : "skip"
  );

  return (
    <AdminGate loading="Loading inbox…" allowed={reports}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {kindFilters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={kind === filter.id ? "default" : "outline"}
              onClick={() => setKind(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {reports && reports.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No open reports"
            description="Reaction, case, and story reports appear here until you dismiss them."
          />
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reports ?? []).map((r) => {
                  const categoryMeta = reportCategoryMeta[r.category];
                  const severity = reportSeverityMeta[categoryMeta.severity];
                  return (
                    <TableRow key={`${r.kind}-${r.id}`}>
                      <TableCell>
                        <Badge variant="secondary">{kindBadge[r.kind]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate font-medium">
                        <Link href={r.href} className="hover:underline">
                          {r.target}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-72 md:table-cell">
                        <p className="truncate text-sm">{categoryMeta.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.reporterName}
                          {r.details ? ` · ${r.details}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(severity.badgeClass)}
                        >
                          {severity.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {relativeTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={r.href}>Review</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await dismissReport({
                                    kind: r.kind,
                                    reportId: r.id,
                                  });
                                  toast.success("Report dismissed");
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
                            Dismiss
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminGate>
  );
}
