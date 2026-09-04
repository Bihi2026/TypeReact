"use client";

import * as React from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CommunityNotesSection({ code }: { code: string }) {
  const { isSignedIn } = useAuth();
  const notes = useQuery(api.barkNotes.listCommunityNotes, { code });
  const addNote = useMutation(api.barkNotes.addCommunityNote);
  const voteNote = useMutation(api.barkNotes.voteCommunityNote);
  const [text, setText] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  return (
    <section id="community-notes" className="scroll-mt-24 space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Community context
        </h2>
        <p className="text-sm text-muted-foreground">
          Consensus-minded notes that add context — not a second reply thread.
        </p>
      </div>

      {!isSignedIn ? (
        <Card className="gap-0 p-0">
          <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Sign in to add community context.
            </p>
            <SignInButton>
              <Button size="sm">Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add missing context, caveats, or clarifying sources…"
            className="min-h-20"
          />
          <Button
            size="sm"
            disabled={posting || !text.trim()}
            onClick={() => {
              void (async () => {
                setPosting(true);
                try {
                  await addNote({ code, text });
                  setText("");
                  toast.success("Context note posted");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not post note"
                  );
                } finally {
                  setPosting(false);
                }
              })();
            }}
          >
            {posting ? "Posting…" : "Post note"}
          </Button>
        </div>
      )}

      {notes === undefined ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No community context yet. Be the first to add a careful note.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note._id}>
              <Card className="gap-0 p-0">
                <div className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <PersonAvatar
                      id={note.authorClerkId}
                      name={note.authorName}
                      className="size-7"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{note.authorName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(new Date(note.createdAt).toISOString())}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {note.text}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={note.myVote === "helpful" ? "secondary" : "outline"}
                      className={cn("h-7 text-xs")}
                      disabled={!isSignedIn}
                      onClick={() => {
                        void (async () => {
                          if (!isSignedIn) {
                            toast.message("Sign in to rate notes");
                            return;
                          }
                          try {
                            await voteNote({
                              noteId: note._id as Id<"barkCommunityNotes">,
                              vote: "helpful",
                            });
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not vote"
                            );
                          }
                        })();
                      }}
                    >
                      <ThumbsUp className="size-3.5" />
                      Helpful {note.helpfulCount}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={note.myVote === "not" ? "secondary" : "outline"}
                      className="h-7 text-xs"
                      disabled={!isSignedIn}
                      onClick={() => {
                        void (async () => {
                          if (!isSignedIn) {
                            toast.message("Sign in to rate notes");
                            return;
                          }
                          try {
                            await voteNote({
                              noteId: note._id as Id<"barkCommunityNotes">,
                              vote: "not",
                            });
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not vote"
                            );
                          }
                        })();
                      }}
                    >
                      <ThumbsDown className="size-3.5" />
                      Not helpful {note.notHelpfulCount}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
