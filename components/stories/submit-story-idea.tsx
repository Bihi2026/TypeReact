"use client";

import * as React from "react";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Lightbulb,
  XCircle,
} from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { genreMeta } from "@/lib/story-meta";
import type { StoryGenre } from "@/lib/story-types";

const MIN_PITCH = 80;

const statusMeta = {
  pending: {
    label: "Under review",
    icon: Clock3,
    variant: "secondary" as const,
  },
  accepted: {
    label: "Accepted",
    icon: CheckCircle2,
    variant: "default" as const,
  },
  rejected: {
    label: "Not accepted",
    icon: XCircle,
    variant: "outline" as const,
  },
};

export function SubmitStoryIdea() {
  const { isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(
    api.storyIdeas.listMine,
    isAuthenticated ? {} : "skip"
  );
  const submit = useMutation(api.storyIdeas.submit);
  const genres = React.useMemo(
    () => Object.keys(genreMeta) as StoryGenre[],
    []
  );

  const [title, setTitle] = React.useState("");
  const [pitch, setPitch] = React.useState("");
  const [genre, setGenre] = React.useState<StoryGenre | "">("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const hasPending = mine?.some((row) => row.status === "pending") ?? false;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error("Sign in to submit a story idea.");
      return;
    }
    if (!title.trim()) {
      toast.error("Add a title for your idea.");
      return;
    }
    if (pitch.trim().length < MIN_PITCH) {
      toast.error(`Your pitch needs at least ${MIN_PITCH} characters.`, {
        description: `Currently ${pitch.trim().length}.`,
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await submit({
        title: title.trim(),
        pitch: pitch.trim(),
        genre: genre || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Idea submitted", {
        description: `Tracking code ${result.ideaCode}. We'll notify you after review.`,
      });
      setTitle("");
      setPitch("");
      setGenre("");
      setNotes("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit idea"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="size-4" aria-hidden />
          Story ideas
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Submit a story idea
        </h1>
        <p className="text-muted-foreground">
          Pitch a true-crime, mystery, or human story concept. Editorial may
          accept it for public browse and assign an approved writer to draft it.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href="/stories/ideas">Browse accepted ideas</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/stories">
              Back to stories <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your pitch</CardTitle>
        </CardHeader>
        <CardContent>
          {!isSignedIn ? (
            <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to submit an idea. Anyone with an account can pitch —
                you do not need to be an approved writer.
              </p>
              <SignInButton mode="modal">
                <Button>Sign in to submit</Button>
              </SignInButton>
            </div>
          ) : hasPending ? (
            <div className="space-y-2 rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">You already have an idea under review</p>
              <p className="text-sm text-muted-foreground">
                Wait for a decision on your pending idea before submitting
                another. Rejected ideas free the queue so you can try again.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="idea-title">Title</Label>
                <Input
                  id="idea-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Working title for the story"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idea-pitch">Pitch</Label>
                <Textarea
                  id="idea-pitch"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="What happened, why it matters, and what makes it worth telling…"
                  rows={6}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {pitch.trim().length}/{MIN_PITCH} characters minimum
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idea-genre">Genre (optional)</Label>
                <Select
                  value={genre || undefined}
                  onValueChange={(value) => setGenre(value as StoryGenre)}
                >
                  <SelectTrigger id="idea-genre" aria-label="Genre">
                    <SelectValue placeholder="Choose a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((g) => (
                      <SelectItem key={g} value={g}>
                        {genreMeta[g].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idea-notes">Notes for editors (optional)</Label>
                <Textarea
                  id="idea-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sources, sensitivity notes, or why you're pitching this"
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit idea"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="my-ideas-heading">
        <h2 id="my-ideas-heading" className="text-lg font-semibold">
          My ideas
        </h2>
        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground">
            Sign in to see ideas you have submitted.
          </p>
        ) : mine === undefined ? (
          <p className="text-sm text-muted-foreground">Loading your ideas…</p>
        ) : mine.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No ideas yet"
            description="Your submissions will show here with review status."
          />
        ) : (
          <ul className="space-y-3">
            {mine.map((row) => {
              const meta = statusMeta[row.status];
              const Icon = meta.icon;
              return (
                <li key={row._id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{row.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {row.ideaCode}
                          {row.genre
                            ? ` · ${genreMeta[row.genre as StoryGenre]?.label ?? row.genre}`
                            : null}
                        </p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {row.pitch}
                        </p>
                        {row.reviewNote ? (
                          <p className="text-xs italic text-muted-foreground">
                            Review note: {row.reviewNote}
                          </p>
                        ) : null}
                        {row.status === "accepted" && row.assignedPenName ? (
                          <p className="text-xs text-muted-foreground">
                            Assigned to {row.assignedPenName}
                            {row.assignedWriterHandle
                              ? ` (@${row.assignedWriterHandle})`
                              : null}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={meta.variant} className="gap-1">
                        <Icon className="size-3" aria-hidden />
                        {meta.label}
                      </Badge>
                    </div>
                    {row.status === "accepted" && row.storySlug ? (
                      <Button asChild variant="link" className="mt-2 h-auto px-0">
                        <Link href={`/stories/write/${row.storySlug}`}>
                          Open draft story
                        </Link>
                      </Button>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
