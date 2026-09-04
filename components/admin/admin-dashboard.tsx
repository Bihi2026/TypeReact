"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminCreators } from "@/components/admin/admin-creators";
import { AdminInbox } from "@/components/admin/admin-inbox";
import { AdminLearningPanel } from "@/components/admin/admin-learning";
import { AdminModeration } from "@/components/admin/admin-moderation";
import { AdminStats } from "@/components/admin/admin-stats";
import { AdminUsers } from "@/components/admin/admin-users";
import { CaseReviewQueue } from "@/components/admin/case-review-queue";
import { ClerkSyncPanel } from "@/components/admin/clerk-sync-panel";
import { ContestAdminPanel } from "@/components/admin/contest-admin";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { WriterApplicationsQueue } from "@/components/admin/writer-applications-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";

const tabs = ["overview", "inbox", "people", "content", "system"] as const;
type AdminTab = (typeof tabs)[number];

const panelsByTab: Record<AdminTab, readonly string[]> = {
  overview: ["analytics"],
  inbox: ["reports", "activity"],
  people: ["users", "creators", "verification"],
  content: ["evidence", "stories", "contests", "learning"],
  system: ["sync"],
};

const panelLabels: Record<string, string> = {
  analytics: "Analytics",
  reports: "Reports",
  activity: "Activity",
  users: "Users",
  creators: "Creators",
  verification: "Verification",
  evidence: "Evidence",
  stories: "Stories",
  contests: "Contests",
  learning: "Learning",
  sync: "Sync",
};

function isTab(value: string | null): value is AdminTab {
  return tabs.includes(value as AdminTab);
}

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 tabular-nums">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const counts = useQuery(
    api.admin.queueCounts,
    isAuthenticated ? {} : "skip"
  );

  const tabParam = params.get("tab");
  const tab: AdminTab = isTab(tabParam) ? tabParam : "overview";
  const allowedPanels = panelsByTab[tab];
  const panelParam = params.get("panel");
  const panel = allowedPanels.includes(panelParam ?? "")
    ? panelParam!
    : allowedPanels[0]!;

  const setLocation = (nextTab: AdminTab, nextPanel?: string) => {
    const resolved = nextPanel ?? panelsByTab[nextTab][0]!;
    const search = new URLSearchParams();
    search.set("tab", nextTab);
    if (resolved !== panelsByTab[nextTab][0]) {
      search.set("panel", resolved);
    }
    router.replace(`/admin?${search.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LayoutDashboard className="size-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Platform health, moderation, and verification oversight.
          </p>
        </div>
      </div>

      <AdminStats onOpenReports={() => setLocation("inbox", "reports")} />

      <Tabs
        value={tab}
        onValueChange={(value) => setLocation(value as AdminTab)}
        className="min-w-0"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="overview" className="flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="inbox" className="flex-none">
            Inbox
            <CountBadge count={counts?.reports} />
          </TabsTrigger>
          <TabsTrigger value="people" className="flex-none">
            People
            <CountBadge count={counts?.verification} />
          </TabsTrigger>
          <TabsTrigger value="content" className="flex-none">
            Content
            <CountBadge
              count={
                (counts?.casesUnderReview ?? 0) + (counts?.writerApps ?? 0) ||
                undefined
              }
            />
          </TabsTrigger>
          <TabsTrigger value="system" className="flex-none">
            System
          </TabsTrigger>
        </TabsList>

        {allowedPanels.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {allowedPanels.map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={panel === id ? "default" : "outline"}
                onClick={() => setLocation(tab, id)}
              >
                {panelLabels[id]}
                {id === "verification" ? (
                  <CountBadge count={counts?.verification} />
                ) : null}
                {id === "evidence" ? (
                  <CountBadge count={counts?.casesUnderReview} />
                ) : null}
                {id === "stories" ? (
                  <CountBadge count={counts?.writerApps} />
                ) : null}
              </Button>
            ))}
          </div>
        ) : null}

        <TabsContent value="overview" className="mt-4 min-w-0">
          <AdminAnalytics />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4 min-w-0">
          {panel === "activity" ? <AdminModeration /> : <AdminInbox />}
        </TabsContent>

        <TabsContent value="people" className="mt-4 min-w-0">
          {panel === "creators" ? (
            <AdminCreators />
          ) : panel === "verification" ? (
            <VerificationQueue />
          ) : (
            <AdminUsers />
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-4 min-w-0">
          {panel === "stories" ? (
            <WriterApplicationsQueue />
          ) : panel === "contests" ? (
            <ContestAdminPanel />
          ) : panel === "learning" ? (
            <AdminLearningPanel />
          ) : (
            <CaseReviewQueue />
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4 min-w-0">
          <ClerkSyncPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
