"use client";

import * as React from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export function ContestBlindReview({
  contestId,
}: {
  contestId: Id<"contests">;
}) {
  const { isAuthenticated } = useConvexAuth();
  const contests = useQuery(
    api.contests.listAdmin,
    isAuthenticated ? {} : "skip"
  );
  const entries = useQuery(
    api.contests.listBlindEntries,
    isAuthenticated ? { contestId } : "skip"
  );
  const [selectedId, setSelectedId] = React.useState<Id<"contestEntries"> | null>(
    null
  );
  const detail = useQuery(
    api.contests.getBlindEntry,
    isAuthenticated && selectedId ? { entryId: selectedId } : "skip"
  );
  const scoreEntry = useMutation(api.contests.scoreEntry);
  const pickWinner = useMutation(api.contests.pickWinner);

  const [score, setScore] = React.useState("7");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [winnerConfirmOpen, setWinnerConfirmOpen] = React.useState(false);

  const contest = contests?.find((row) => row._id === contestId);

  React.useEffect(() => {
    if (!detail) return;
    setScore(String(detail.myScore ?? 7));
    setNotes(detail.notes ?? "");
  }, [detail]);

  const saveScore = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await scoreEntry({
        entryId: selectedId,
        score: Number(score),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      toast.success("Score saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save score"
      );
    } finally {
      setSaving(false);
    }
  };

  const chooseWinner = async () => {
    if (!selectedId) return;
    try {
      const result = await pickWinner({ contestId, entryId: selectedId });
      toast.success(`Winner set: ${result.winnerSlug}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not pick a winner"
      );
    }
  };

  if (!isAuthenticated || contests === undefined || entries === undefined) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Loading review…
      </p>
    );
  }

  if (contests === null || entries === null) {
    return (
      <EmptyState
        icon={Trophy}
        title="Admins only"
        description="Blind review is limited to site admins."
      />
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Admin
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {contest?.name ?? "Blind review"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Authors are hidden. Score the writing, then pick a winner.
        </p>
        {contest?.winnerSlug ? (
          <p className="text-sm">
            Winner slug:{" "}
            <span className="font-mono">{contest.winnerSlug}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.entryId}
                type="button"
                onClick={() => setSelectedId(entry.entryId)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50",
                  selectedId === entry.entryId && "border-primary bg-primary/5"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{entry.label}</span>
                  {entry.myScore !== null ? (
                    <Badge variant="secondary">{entry.myScore}/10</Badge>
                  ) : (
                    <Badge variant="outline">Unscored</Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {entry.publishedChapterCount} parts · {entry.wordCount} words
                  {entry.averageScore !== null
                    ? ` · avg ${entry.averageScore}`
                    : ""}
                </span>
              </button>
            ))
          )}
        </div>

        {!selectedId ? (
          <p className="text-sm text-muted-foreground">
            Select an entry to read it without author details.
          </p>
        ) : detail === undefined ? (
          <p className="text-sm text-muted-foreground">Loading entry…</p>
        ) : detail === null ? (
          <p className="text-sm text-muted-foreground">Entry not found.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {detail.label}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {detail.title}
              </h2>
            </div>
            <div className="space-y-6">
              {detail.chapters.map((chapter) => (
                <article key={chapter.number} className="space-y-3">
                  <h3 className="font-medium">
                    Part {chapter.number}: {chapter.title}
                  </h3>
                  <div className="break-words whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground/90">
                    {chapter.body}
                  </div>
                </article>
              ))}
            </div>
            <Card className="gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="space-y-1.5">
                  <Label>Score</Label>
                  <Select value={score} onValueChange={setScore}>
                    <SelectTrigger aria-label="Score">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="judge-notes">Notes (optional)</Label>
                  <Textarea
                    id="judge-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveScore} disabled={saving}>
                  {saving ? "Saving…" : "Save score"}
                </Button>
                {!contest?.winnerSlug ? (
                  <Button
                    variant="outline"
                    onClick={() => setWinnerConfirmOpen(true)}
                  >
                    Pick winner
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={winnerConfirmOpen}
        onOpenChange={setWinnerConfirmOpen}
        title="Pick this entry as the winner?"
        description="The contest will close and the author’s story slug will be published."
        confirmLabel="Pick winner"
        onConfirm={chooseWinner}
      />
    </div>
  );
}
