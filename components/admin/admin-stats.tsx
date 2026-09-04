"use client";

import * as React from "react";
import { BadgeCheck, Building2, Flag, Users } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatValue(value: number, capped: boolean) {
  return `${formatNumber(value)}${capped ? "+" : ""}`;
}

function deltaText(stats: unknown, value: string | undefined) {
  if (stats === null) return "Admins only";
  if (stats === undefined) return "Loading…";
  return value ?? "Loading…";
}

export function AdminStats({
  onOpenReports,
}: {
  onOpenReports?: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  const nowMs = React.useMemo(() => Date.now(), []);
  const stats = useQuery(
    api.admin.stats,
    isAuthenticated ? { nowMs } : "skip"
  );

  const cards = [
    {
      label: "Total Users",
      icon: Users,
      value: stats
        ? formatValue(stats.users.value, stats.users.capped)
        : "—",
      delta: deltaText(stats, stats?.usersDelta),
    },
    {
      label: "Verified Creators",
      icon: BadgeCheck,
      value: stats
        ? formatValue(
            stats.verifiedCreators.value,
            stats.verifiedCreators.capped
          )
        : "—",
      delta: deltaText(stats, stats?.verifiedCreatorsDelta),
    },
    {
      label: "Organizations",
      icon: Building2,
      value: stats
        ? formatValue(stats.organizations.value, stats.organizations.capped)
        : "—",
      delta: deltaText(stats, stats?.organizationsDelta),
    },
    {
      label: "Open Reports",
      icon: Flag,
      value: stats
        ? formatValue(stats.openReports.value, stats.openReports.capped)
        : "—",
      delta: deltaText(stats, stats?.openReportsDelta),
      onClick: onOpenReports,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((s) => {
        const Icon = s.icon;
        const clickable = "onClick" in s && Boolean(s.onClick);
        return (
          <Card
            key={s.label}
            className={cn(
              "gap-1 p-4",
              clickable && "cursor-pointer transition-colors hover:bg-muted/40"
            )}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? s.onClick : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      s.onClick?.();
                    }
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <Icon className="size-4 text-primary" aria-hidden />
            </div>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.delta}</p>
          </Card>
        );
      })}
    </div>
  );
}
