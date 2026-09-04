"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, MoreHorizontal, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { MentionField } from "@/components/comments/mention-field";
import { MentionText } from "@/components/comments/mention-text";
import {
  DraftAttachmentChips,
  PostAttachmentList,
  draftToPayload,
  listedToDraft,
  revokeDraftPreviews,
  useCirclePostAttachments,
  type DraftAttachment,
} from "@/components/circles/post-attachments";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { caseCategoryMeta } from "@/lib/meta";
import { formatDate } from "@/lib/format";
import { useRouter } from "next/navigation";

type PendingConfirm =
  | {
      kind: "transfer";
      memberClerkId: string;
      memberName: string;
    }
  | {
      kind: "kick";
      memberClerkId: string;
      memberName: string;
    }
  | { kind: "delete" }
  | { kind: "deletePost"; postId: Id<"researchCirclePosts"> };

function extractInviteUsername(raw: string): string {
  const trimmed = raw.trim();
  const lastAt = trimmed.match(/@([a-zA-Z0-9_]{2,32})\s*$/);
  if (lastAt) return lastAt[1];
  return trimmed.replace(/^@/, "").split(/\s+/)[0] ?? "";
}

export function CircleDetail({
  circleId,
}: {
  circleId: Id<"researchCircles">;
}) {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const detail = useQuery(
    api.researchCircles.get,
    isSignedIn ? { circleId } : "skip"
  );
  const posts = useQuery(
    api.researchCircles.listPosts,
    isSignedIn ? { circleId } : "skip"
  );
  const pendingInvites = useQuery(
    api.researchCircles.listCirclePendingInvites,
    isSignedIn ? { circleId } : "skip"
  );
  const invite = useMutation(api.researchCircles.inviteByUsername);
  const cancelInvite = useMutation(api.researchCircles.cancelInvite);
  const addPost = useMutation(api.researchCircles.addPost);
  const updatePost = useMutation(api.researchCircles.updatePost);
  const deletePost = useMutation(api.researchCircles.deletePost);
  const leave = useMutation(api.researchCircles.leave);
  const remove = useMutation(api.researchCircles.remove);
  const updateCircle = useMutation(api.researchCircles.update);
  const removeMember = useMutation(api.researchCircles.removeMember);
  const transferOwnership = useMutation(api.researchCircles.transferOwnership);

  const [inviteText, setInviteText] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editingPostId, setEditingPostId] =
    React.useState<Id<"researchCirclePosts"> | null>(null);
  const [editPostBody, setEditPostBody] = React.useState("");
  const [savingPost, setSavingPost] = React.useState(false);
  const [composeAttachments, setComposeAttachments] = React.useState<
    DraftAttachment[]
  >([]);
  const [editAttachments, setEditAttachments] = React.useState<
    DraftAttachment[]
  >([]);
  const [pendingConfirm, setPendingConfirm] =
    React.useState<PendingConfirm | null>(null);

  const composeAttach = useCirclePostAttachments(
    composeAttachments,
    setComposeAttachments
  );
  const editAttach = useCirclePostAttachments(
    editAttachments,
    setEditAttachments
  );

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to view this circle.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/circles">Back to circles</Link>
        </Button>
      </div>
    );
  }

  if (detail === undefined || posts === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-1/2 animate-pulse rounded-md bg-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <Card className="gap-3 p-4">
              <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
              <div className="h-24 animate-pulse rounded-md bg-muted" />
            </Card>
            <Card className="h-28 animate-pulse bg-muted/60 p-4" />
            <Card className="h-28 animate-pulse bg-muted/60 p-4" />
          </div>
          <Card className="h-64 animate-pulse bg-muted/60 p-4" />
        </div>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Circle not found or you are not a member.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/circles">Back to circles</Link>
        </Button>
      </div>
    );
  }

  const { circle, members } = detail;
  const isOwner = circle.myRole === "owner";

  const anchorLabel =
    circle.anchorKind === "case"
      ? `Case ${circle.caseCode}`
      : circle.topic
        ? caseCategoryMeta[circle.topic]?.label
        : "Topic";
  const anchorHref =
    circle.anchorKind === "case"
      ? `/cases/${circle.caseCode}`
      : `/topics/${circle.topic}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="h-8 px-0">
          <Link href="/circles">
            <ArrowLeft className="size-4" aria-hidden />
            Circles
          </Link>
        </Button>
        {editing ? (
          <Card className="gap-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-16"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await updateCircle({
                        circleId,
                        name: editName,
                        description: editDescription || undefined,
                      });
                      toast.success("Circle updated");
                      setEditing(false);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not update"
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Save
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {circle.name}
              </h1>
              {isOwner ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditName(circle.name);
                    setEditDescription(circle.description ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" asChild>
                <Link href={anchorHref}>{anchorLabel}</Link>
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users className="size-3" aria-hidden />
                {circle.memberCount}{" "}
                {circle.memberCount === 1 ? "member" : "members"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {circle.myRole}
              </Badge>
            </div>
            {circle.description ? (
              <p className="text-sm text-muted-foreground">
                {circle.description}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Card className="gap-3 p-4">
            <p className="text-sm font-semibold">Share with the circle</p>
            <MentionField
              circleId={circleId}
              value={body}
              onChange={setBody}
              placeholder="Share a finding — use @ to mention someone…"
              className="min-h-24"
            />
            <DraftAttachmentChips
              attachments={composeAttachments}
              onRemove={(id) => void composeAttach.removeAttachment(id)}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {composeAttach.attachButton}
              <Button
                size="sm"
                disabled={
                  busy ||
                  composeAttach.uploading ||
                  (!body.trim() && composeAttachments.length === 0)
                }
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await addPost({
                        circleId,
                        body,
                        attachments: draftToPayload(composeAttachments),
                      });
                      revokeDraftPreviews(composeAttachments);
                      setBody("");
                      setComposeAttachments([]);
                      toast.success("Posted");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not post"
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Post
              </Button>
            </div>
          </Card>

          {posts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No posts yet"
              description="Share a finding with the circle to start the thread."
              className="py-12"
            />
          ) : (
            <ul className="space-y-2">
              {posts.map((post) => {
                const isAuthor = post.authorClerkId === userId;
                const canDelete = isAuthor || isOwner;
                const isEditingPost = editingPostId === post._id;
                return (
                  <li key={post._id}>
                    <Card className="gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <PersonAvatar
                            id={post.authorClerkId}
                            name={post.authorName}
                            className="size-7"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {post.authorName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(
                                new Date(post.createdAt).toISOString()
                              )}
                              {post.editedAt ? " · Edited" : null}
                            </p>
                          </div>
                        </div>
                        {!isEditingPost && (isAuthor || canDelete) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                aria-label="Post actions"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {isAuthor ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    revokeDraftPreviews(editAttachments);
                                    setEditingPostId(post._id);
                                    setEditPostBody(post.body);
                                    setEditAttachments(
                                      listedToDraft(post.attachments)
                                    );
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                              ) : null}
                              {canDelete ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    setPendingConfirm({
                                      kind: "deletePost",
                                      postId: post._id,
                                    })
                                  }
                                >
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                      {isEditingPost ? (
                        <div className="space-y-2">
                          <MentionField
                            circleId={circleId}
                            value={editPostBody}
                            onChange={setEditPostBody}
                            className="min-h-24"
                          />
                          <DraftAttachmentChips
                            attachments={editAttachments}
                            onRemove={(id) =>
                              void editAttach.removeAttachment(id)
                            }
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {editAttach.attachButton}
                            <Button
                              size="sm"
                              disabled={
                                savingPost ||
                                editAttach.uploading ||
                                (!editPostBody.trim() &&
                                  editAttachments.length === 0)
                              }
                              onClick={() => {
                                void (async () => {
                                  setSavingPost(true);
                                  try {
                                    await updatePost({
                                      postId: post._id,
                                      body: editPostBody,
                                      attachments:
                                        draftToPayload(editAttachments),
                                    });
                                    revokeDraftPreviews(editAttachments);
                                    setEditingPostId(null);
                                    setEditPostBody("");
                                    setEditAttachments([]);
                                    toast.success("Post updated");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Could not update"
                                    );
                                  } finally {
                                    setSavingPost(false);
                                  }
                                })();
                              }}
                            >
                              {savingPost ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={savingPost}
                              onClick={() => {
                                revokeDraftPreviews(editAttachments);
                                setEditingPostId(null);
                                setEditPostBody("");
                                setEditAttachments([]);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {post.body ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              <MentionText text={post.body} />
                            </p>
                          ) : null}
                          <PostAttachmentList
                            attachments={post.attachments}
                          />
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-3 p-4">
            <p className="text-sm font-semibold">Members</p>
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m._id}
                  className="flex items-center gap-2 rounded-md p-1 text-sm"
                >
                  <PersonAvatar
                    id={m.clerkUserId}
                    name={m.name}
                    className="size-6"
                  />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <Badge variant="outline" className="capitalize">
                    {m.role}
                  </Badge>
                  {isOwner && m.clerkUserId !== userId ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Actions for ${m.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() =>
                            setPendingConfirm({
                              kind: "transfer",
                              memberClerkId: m.clerkUserId,
                              memberName: m.name,
                            })
                          }
                        >
                          Make owner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setPendingConfirm({
                              kind: "kick",
                              memberClerkId: m.clerkUserId,
                              memberName: m.name,
                            })
                          }
                        >
                          Kick
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              ))}
            </ul>

            {isOwner ? (
              <form
                className="space-y-2 border-t pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const username = extractInviteUsername(inviteText);
                  if (!username) {
                    toast.error("Type @username to invite");
                    return;
                  }
                  void (async () => {
                    try {
                      await invite({ circleId, username });
                      setInviteText("");
                      toast.success("Invite sent");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not invite"
                      );
                    }
                  })();
                }}
              >
                <Label className="text-xs">Invite with @</Label>
                <MentionField
                  searchSource="users"
                  value={inviteText}
                  onChange={setInviteText}
                  placeholder="@username"
                  className="min-h-12"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  Send invite
                </Button>
              </form>
            ) : null}

            {isOwner && pendingInvites && pendingInvites.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Pending invites
                </p>
                <ul className="space-y-1">
                  {pendingInvites.map((row) => (
                    <li
                      key={row._id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="truncate">@{row.inviteeUsername}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => {
                          void (async () => {
                            try {
                              await cancelInvite({ inviteId: row._id });
                              toast.success("Invite cancelled");
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not cancel"
                              );
                            }
                          })();
                        }}
                      >
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {circle.myRole === "member" || isOwner ? (
              <div className="border-t pt-3">
                {circle.myRole === "member" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-destructive"
                    onClick={() => {
                      void (async () => {
                        try {
                          await leave({ circleId });
                          toast.success("Left circle");
                          router.push("/circles");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not leave"
                          );
                        }
                      })();
                    }}
                  >
                    Leave circle
                  </Button>
                ) : null}
                {isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-destructive"
                    onClick={() => setPendingConfirm({ kind: "delete" })}
                  >
                    Delete circle
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        title={
          pendingConfirm?.kind === "transfer"
            ? `Transfer ownership to ${pendingConfirm.memberName}?`
            : pendingConfirm?.kind === "kick"
              ? `Remove ${pendingConfirm.memberName} from this circle?`
              : pendingConfirm?.kind === "deletePost"
                ? "Delete this post?"
                : "Delete this circle?"
        }
        description={
          pendingConfirm?.kind === "transfer"
            ? "You will become a member."
            : pendingConfirm?.kind === "kick"
              ? "They will lose access to this circle."
              : pendingConfirm?.kind === "deletePost"
                ? "This cannot be undone."
                : "This removes the circle and all posts."
        }
        confirmLabel={
          pendingConfirm?.kind === "transfer"
            ? "Transfer"
            : pendingConfirm?.kind === "kick"
              ? "Remove"
              : "Delete"
        }
        variant={
          pendingConfirm?.kind === "delete" ||
          pendingConfirm?.kind === "deletePost" ||
          pendingConfirm?.kind === "kick"
            ? "destructive"
            : "default"
        }
        onConfirm={async () => {
          if (!pendingConfirm) return;
          if (pendingConfirm.kind === "transfer") {
            try {
              await transferOwnership({
                circleId,
                newOwnerClerkId: pendingConfirm.memberClerkId,
              });
              toast.success("Ownership transferred");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not transfer"
              );
            }
            return;
          }
          if (pendingConfirm.kind === "kick") {
            try {
              await removeMember({
                circleId,
                memberClerkId: pendingConfirm.memberClerkId,
              });
              toast.success("Member removed");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not remove"
              );
            }
            return;
          }
          if (pendingConfirm.kind === "deletePost") {
            try {
              await deletePost({ postId: pendingConfirm.postId });
              if (editingPostId === pendingConfirm.postId) {
                setEditingPostId(null);
                setEditPostBody("");
              }
              toast.success("Post deleted");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not delete"
              );
            }
            return;
          }
          try {
            await remove({ circleId });
            toast.success("Circle deleted");
            router.push("/circles");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not delete"
            );
          }
        }}
      />
    </div>
  );
}
