"use client";

import Link from "next/link";
import {
  BookOpen,
  Eye,
  FileEdit,
  Heart,
  PenLine,
  Users,
} from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CoverPicker } from "@/components/stories/cover-picker";
import { EmptyState } from "@/components/empty-state";
import { AssignedIdeasInbox } from "@/components/stories/assigned-ideas-inbox";
import { NewStoryDialog } from "@/components/stories/new-story-dialog";
import { StorySettingsDialog } from "@/components/stories/story-settings-dialog";
import { StoryVideosForSlug } from "@/components/stories/story-videos-for-slug";
import { WriterNotifications } from "@/components/stories/writer-notifications";
import { WriterReadsChart } from "@/components/stories/writer-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatNumber, timeAgo } from "@/lib/format";
import { toMineStory, type MineStory } from "@/lib/stories/query";
import { getGenreMeta, storyStatusMeta } from "@/lib/story-meta";
import type { StoryStatus } from "@/lib/story-types";
import type { WriterProfile } from "@/lib/writers/query";

export function ApprovedWriterDashboard({
  writer,
  initialStories,
}: {
  writer: WriterProfile;
  initialStories: MineStory[];
}) {
  const { isAuthenticated } = useConvexAuth();
  const docs = useQuery(
    api.stories.listMine,
    isAuthenticated ? {} : "skip"
  );
  const mine = useQuery(
    api.writers.getMine,
    isAuthenticated ? {} : "skip"
  );
  const setStatus = useMutation(api.stories.setStatus);
  const assignedIdeas = useQuery(
    api.storyIdeas.listAssignedToMe,
    isAuthenticated ? {} : "skip"
  );
  const stories = docs ? docs.map(toMineStory) : initialStories;
  const ideaStoryIds = new Set(
    (assignedIdeas ?? []).map((row) => row.storyId as string)
  );
  const published = stories.filter((s) => s.publishedChapterCount > 0);
  const drafts = stories.filter((s) => s.publishedChapterCount === 0);
  const publishedParts = stories.reduce(
    (n, s) => n + s.publishedChapterCount,
    0
  );
  const totalReads = stories.reduce((n, s) => n + s.reads, 0);
  const totalVotes = stories.reduce((n, s) => n + s.votes, 0);
  const followers = mine?.followers ?? writer.followers;

  const stats = [
    { label: "Total reads", value: totalReads, icon: Eye },
    { label: "Total votes", value: totalVotes, icon: Heart },
    { label: "Followers", value: followers, icon: Users },
    { label: "Published parts", value: publishedParts, icon: BookOpen },
  ];

  const updateStatus = async (
    storyId: string,
    status: StoryStatus
  ) => {
    try {
      await setStatus({ storyId: storyId as Id<"stories">, status });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update status"
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Writer Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Writing as {writer.penName} · @{writer.handle}
          </p>
        </div>
        <NewStoryDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {formatNumber(s.value)}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reads &amp; votes</CardTitle>
            <CardDescription>
              Across all stories, last six months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WriterReadsChart />
          </CardContent>
        </Card>
        <WriterNotifications />
      </div>

      <AssignedIdeasInbox />

      {published.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Watch films</h2>
          {published.map((s) => (
            <div key={s.id} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {s.title}
              </p>
              <StoryVideosForSlug slug={s.slug} />
            </div>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your stories</CardTitle>
          <CardDescription>
            Manage parts, status, and visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No published stories yet"
              description="Create a draft and publish your first part to appear here."
              className="py-10"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Story</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Parts</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Last updated
                    </TableHead>
                    <TableHead className="w-10" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {published.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/stories/${s.slug}`}
                          className="font-medium hover:text-primary"
                        >
                          {s.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {getGenreMeta(s.genre).label}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Select
                          value={s.status}
                          onValueChange={(value) =>
                            updateStatus(s.id, value as StoryStatus)
                          }
                        >
                          <SelectTrigger
                            className="h-8 w-[140px]"
                            aria-label={`Status for ${s.title}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(storyStatusMeta) as StoryStatus[]).map(
                              (status) => (
                                <SelectItem key={status} value={status}>
                                  {storyStatusMeta[status].label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {s.publishedChapterCount}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {timeAgo(s.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <CoverPicker
                            storyTitle={s.title}
                            storyId={s.id as Id<"stories">}
                          />
                          <StorySettingsDialog
                            slug={s.slug}
                            title={s.title}
                            blurb={s.blurb}
                            genre={s.genre}
                            tags={s.tags}
                            mature={s.mature}
                            status={s.status}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Edit ${s.title}`}
                              >
                                <FileEdit className="size-4" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Write ${s.title}`}
                            asChild
                          >
                            <Link href={`/stories/write/${s.slug}`}>
                              <PenLine className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drafts</CardTitle>
          <CardDescription>Unpublished work in progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drafts.length === 0 ? (
            <EmptyState
              icon={FileEdit}
              title="No drafts"
              description="Start a new story to open a draft."
              className="py-10"
            />
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileEdit
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {d.title}
                      {ideaStoryIds.has(d.id) ? (
                        <Badge
                          variant="secondary"
                          className="ml-2 align-middle text-[10px]"
                        >
                          From idea
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getGenreMeta(d.genre).label} · edited {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CoverPicker
                    storyTitle={d.title}
                    storyId={d.id as Id<"stories">}
                  />
                  <StorySettingsDialog
                    slug={d.slug}
                    title={d.title}
                    blurb={d.blurb}
                    genre={d.genre}
                    tags={d.tags}
                    mature={d.mature}
                    status={d.status}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${d.title}`}
                      >
                        <FileEdit className="size-4" />
                      </Button>
                    }
                  />
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/stories/write/${d.slug}`}>Write</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
