"use client";

import * as React from "react";
import { BadgeCheck, Clock3, UserPlus, X } from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { genreMeta } from "@/lib/story-meta";
import type { StoryGenre } from "@/lib/story-types";

function waitingLabel(createdAt: number) {
  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000));
  if (hours < 1) return "less than an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function StoryIdeasQueue() {
  const { isAuthenticated } = useConvexAuth();
  const pending = useQuery(
    api.storyIdeas.listPending,
    isAuthenticated ? {} : "skip"
  );
  const unassigned = useQuery(
    api.storyIdeas.listUnassignedAccepted,
    isAuthenticated ? {} : "skip"
  );
  const recent = useQuery(
    api.storyIdeas.listRecent,
    isAuthenticated ? {} : "skip"
  );
  const writers = useQuery(
    api.storyIdeas.listApprovedWriters,
    isAuthenticated ? {} : "skip"
  );
  const accept = useMutation(api.storyIdeas.accept);
  const reject = useMutation(api.storyIdeas.reject);
  const assign = useMutation(api.storyIdeas.assign);
  const reassign = useMutation(api.storyIdeas.reassign);

  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [writerPick, setWriterPick] = React.useState<Record<string, string>>(
    {}
  );
  const [busy, setBusy] = React.useState<string | null>(null);

  const writerById = React.useMemo(() => {
    const map = new Map<string, { penName: string; handle: string }>();
    for (const w of writers ?? []) {
      map.set(w._id, { penName: w.penName, handle: w.handle });
    }
    return map;
  }, [writers]);

  const assigned =
    recent?.filter((row) => row.status === "accepted" && !!row.storyId) ?? [];

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update idea"
      );
    } finally {
      setBusy(null);
    }
  };

  if (pending === undefined) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading story ideas…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending ideas</h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="No pending ideas"
            description="Story idea submissions appear here until they are accepted or rejected."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((row) => {
              const genreLabel = row.genre
                ? (genreMeta[row.genre as StoryGenre]?.label ?? row.genre)
                : null;
              const note = notes[row._id] ?? "";
              const writerId = writerPick[row._id];
              return (
                <Card key={row._id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <PersonAvatar
                      id={row.submitterClerkId}
                      name={row.submitterName}
                      className="size-10"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">
                        {row.title}{" "}
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {row.ideaCode}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.submitterName}
                        {genreLabel ? ` · ${genreLabel}` : null} · waiting{" "}
                        {waitingLabel(row.createdAt)}
                      </p>
                      <p className="text-sm text-muted-foreground">{row.pitch}</p>
                      {row.notes ? (
                        <p className="text-xs italic text-muted-foreground">
                          Notes: {row.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Input
                    value={note}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [row._id]: e.target.value }))
                    }
                    placeholder="Optional review note"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={writerId}
                      onValueChange={(value) =>
                        setWriterPick((prev) => ({ ...prev, [row._id]: value }))
                      }
                    >
                      <SelectTrigger
                        className="sm:max-w-xs"
                        aria-label="Assign writer"
                      >
                        <SelectValue placeholder="Assign writer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(writers ?? []).map((w) => (
                          <SelectItem key={w._id} value={w._id}>
                            {w.penName} (@{w.handle})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy === row._id}
                        onClick={() =>
                          run(
                            row._id,
                            () =>
                              accept({
                                ideaId: row._id,
                                writerId: writerId
                                  ? (writerId as Id<"writers">)
                                  : undefined,
                                note: note || undefined,
                              }),
                            writerId
                              ? "Idea accepted and draft created"
                              : "Idea accepted"
                          )
                        }
                      >
                        <BadgeCheck className="size-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === row._id}
                        onClick={() =>
                          run(
                            row._id,
                            () =>
                              reject({
                                ideaId: row._id,
                                note: note || undefined,
                              }),
                            "Idea rejected"
                          )
                        }
                      >
                        <X className="size-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Accepted — needs writer</h2>
        {unassigned === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accepted ideas waiting for a writer.
          </p>
        ) : (
          <div className="space-y-3">
            {unassigned.map((row) => {
              const writerId = writerPick[`assign-${row._id}`];
              return (
                <Card
                  key={row._id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.title}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {row.ideaCode}
                      </span>
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {row.pitch}
                    </p>
                  </div>
                  <Select
                    value={writerId}
                    onValueChange={(value) =>
                      setWriterPick((prev) => ({
                        ...prev,
                        [`assign-${row._id}`]: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="sm:max-w-xs"
                      aria-label="Assign writer"
                    >
                      <SelectValue placeholder="Choose writer" />
                    </SelectTrigger>
                    <SelectContent>
                      {(writers ?? []).map((w) => (
                        <SelectItem key={w._id} value={w._id}>
                          {w.penName} (@{w.handle})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!writerId || busy === `assign-${row._id}`}
                    onClick={() => {
                      if (!writerId) return;
                      void run(
                        `assign-${row._id}`,
                        () =>
                          assign({
                            ideaId: row._id,
                            writerId: writerId as Id<"writers">,
                          }),
                        "Writer assigned and draft created"
                      );
                    }}
                  >
                    <UserPlus className="size-4" />
                    Assign
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {assigned.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Assigned</h2>
          <div className="space-y-3">
            {assigned.map((row) => {
              const current = row.assignedWriterId
                ? writerById.get(row.assignedWriterId)
                : null;
              const writerId = writerPick[`reassign-${row._id}`];
              return (
                <Card
                  key={row._id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.title}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {row.ideaCode}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {current
                        ? `Assigned to ${current.penName} (@${current.handle})`
                        : "Assigned"}
                    </p>
                  </div>
                  <Select
                    value={writerId}
                    onValueChange={(value) =>
                      setWriterPick((prev) => ({
                        ...prev,
                        [`reassign-${row._id}`]: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="sm:max-w-xs"
                      aria-label="Reassign writer"
                    >
                      <SelectValue placeholder="Reassign to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(writers ?? [])
                        .filter((w) => w._id !== row.assignedWriterId)
                        .map((w) => (
                          <SelectItem key={w._id} value={w._id}>
                            {w.penName} (@{w.handle})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!writerId || busy === `reassign-${row._id}`}
                    onClick={() => {
                      if (!writerId) return;
                      void run(
                        `reassign-${row._id}`,
                        () =>
                          reassign({
                            ideaId: row._id,
                            writerId: writerId as Id<"writers">,
                          }),
                        "Writer reassigned"
                      );
                    }}
                  >
                    <UserPlus className="size-4" />
                    Reassign
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent decisions</h2>
        {recent === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent decisions.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((row) => (
              <li key={row._id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.title}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {row.ideaCode}
                      </span>
                    </p>
                    {row.reviewNote ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {row.reviewNote}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      row.status === "accepted" ? "default" : "outline"
                    }
                  >
                    {row.status}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
