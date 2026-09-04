"use client";

import * as React from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { ReportButton } from "@/components/report-dialog";
import { EmojiPicker } from "@/components/comments/emoji-picker";
import {
  MentionField,
  type MentionFieldHandle,
} from "@/components/comments/mention-field";
import { MentionText } from "@/components/comments/mention-text";
import { StickerPicker } from "@/components/comments/sticker-picker";
import {
  VoiceNoteRecorder,
  formatVoiceDuration,
  type VoiceDraft,
} from "@/components/comments/voice-note";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { barkKeys } from "@/lib/barks/query";
import {
  BarkSticker,
  isBarkStickerId,
  type BarkStickerId,
} from "@/lib/barks/stickers";
import { formatDate } from "@/lib/format";
import { slugifyMentionHandle } from "@/lib/mentions/handle";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;
const INITIAL_REPLIES = 2;

type CommentSort = "newest" | "evidenced" | "op";

type Comment = {
  _id: Id<"barkComments">;
  parentId?: Id<"barkComments">;
  body: string;
  authorClerkId: string;
  authorName: string;
  authorImageUrl?: string;
  stickerId?: BarkStickerId;
  voiceUrl: string | null;
  voiceDurationMs?: number;
  createdAt: number;
};

function ReplyComposer({
  nested,
  userId,
  userName,
  userImageUrl,
  parentName,
  onCancel,
  mentionRef,
  barkCode,
  body,
  onBodyChange,
  stickerId,
  onStickerChange,
  voiceDraft,
  onVoiceDraftChange,
  replyCountLabel,
  posting,
  onPost,
}: {
  nested?: boolean;
  userId: string;
  userName: string;
  userImageUrl?: string;
  parentName: string | null;
  onCancel: () => void;
  mentionRef: React.RefObject<MentionFieldHandle | null>;
  barkCode: string;
  body: string;
  onBodyChange: (next: string) => void;
  stickerId: BarkStickerId | null;
  onStickerChange: (id: BarkStickerId | null) => void;
  voiceDraft: VoiceDraft | null;
  onVoiceDraftChange: (draft: VoiceDraft | null) => void;
  replyCountLabel: string;
  posting: boolean;
  onPost: () => void;
}) {
  return (
    <div
      className={cn(
        "relative",
        nested && "ml-5 border-l-2 border-border pl-5 sm:ml-6"
      )}
    >
      <Card className="gap-0 p-0">
        <div className="flex gap-3 p-4">
          <PersonAvatar
            id={userId}
            name={userName}
            imageUrl={userImageUrl}
            className="size-8"
          />
          <div className="flex-1 space-y-2">
            {parentName && (
              <p className="text-xs text-muted-foreground">
                Replying to {parentName}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              </p>
            )}
            <MentionField
              ref={mentionRef}
              barkCode={barkCode}
              value={body}
              onChange={onBodyChange}
              placeholder="Add to the reply chain — type @ to mention someone"
            />
            <div className="flex flex-wrap items-center gap-1">
              <EmojiPicker
                onPick={(emoji) => mentionRef.current?.insertAtCaret(emoji)}
              />
              <StickerPicker value={stickerId} onPick={onStickerChange} />
              <VoiceNoteRecorder
                draft={voiceDraft}
                onDraftChange={onVoiceDraftChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{replyCountLabel}</p>
              <Button size="sm" onClick={onPost} disabled={posting}>
                {posting ? "Posting…" : "Post reply"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CommentItem({
  comment,
  code,
  isChild,
  onReply,
}: {
  comment: Comment;
  code: string;
  isChild?: boolean;
  onReply: (comment: Comment) => void;
}) {
  const sticker =
    comment.stickerId && isBarkStickerId(comment.stickerId)
      ? comment.stickerId
      : null;
  return (
    <div
      className={cn(
        "relative",
        isChild && "ml-5 border-l-2 border-border pl-5 sm:ml-6"
      )}
    >
      <Card className="gap-0 p-0">
        <div className="space-y-2.5 p-4">
          <div className="flex items-center gap-2 text-sm">
            <PersonAvatar
              id={comment.authorClerkId}
              name={comment.authorName}
              imageUrl={comment.authorImageUrl}
              className="size-7"
            />
            <span className="font-medium">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(new Date(comment.createdAt).toISOString())}
            </span>
          </div>
          {sticker ? <BarkSticker id={sticker} className="size-16" /> : null}
          {comment.body.trim() ? (
            <p className="text-sm leading-relaxed text-foreground/90">
              <MentionText text={comment.body} />
            </p>
          ) : null}
          {comment.voiceUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <audio
                controls
                src={comment.voiceUrl}
                className="h-8 max-w-full flex-1"
              />
              {comment.voiceDurationMs ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatVoiceDuration(comment.voiceDurationMs)}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onReply(comment)}
            >
              Reply
            </Button>
            <span className="ml-auto">
              <ReportButton
                target={`comment by ${comment.authorName}`}
                barkCode={code}
                targetKind="comment"
                targetId={comment._id}
                iconOnly
              />
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function LiveReplyThread({
  code,
  replyCount,
}: {
  code: string;
  replyCount: number;
}) {
  const { user, isSignedIn, isLoaded } = useUser();
  const signedIn = Boolean(isLoaded && isSignedIn);
  const queryClient = useQueryClient();
  const [sort, setSort] = React.useState<CommentSort>("newest");
  const [pageOffset, setPageOffset] = React.useState(0);
  const firstPage = useQuery(
    api.barks.listComments,
    signedIn
      ? {
          code,
          limit: PAGE_SIZE,
          sort,
          ...(sort === "newest"
            ? {}
            : { offset: 0 }),
        }
      : "skip"
  );
  const [loadBefore, setLoadBefore] = React.useState<number | null>(null);
  const [loadOffset, setLoadOffset] = React.useState<number | null>(null);
  const olderPage = useQuery(
    api.barks.listComments,
    signedIn && sort === "newest" && loadBefore !== null
      ? { code, limit: PAGE_SIZE, before: loadBefore, sort }
      : signedIn && sort !== "newest" && loadOffset !== null
        ? { code, limit: PAGE_SIZE, offset: loadOffset, sort }
        : "skip"
  );
  const [olderPages, setOlderPages] = React.useState<Comment[][]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = React.useState(
    () => new Set<Id<"barkComments">>()
  );
  const consumedBefore = React.useRef<number | null>(null);
  const consumedOffset = React.useRef<number | null>(null);
  const addComment = useMutation(api.barks.addComment);
  const generateUploadUrl = useMutation(api.evidenceFiles.generateUploadUrl);
  const mentionRef = React.useRef<MentionFieldHandle>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const [body, setBody] = React.useState("");
  const [stickerId, setStickerId] = React.useState<BarkStickerId | null>(null);
  const [voiceDraft, setVoiceDraft] = React.useState<VoiceDraft | null>(null);
  const [parentId, setParentId] = React.useState<Id<"barkComments"> | null>(
    null
  );
  const [parentName, setParentName] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);

  React.useEffect(() => {
    setOlderPages([]);
    setLoadBefore(null);
    setLoadOffset(null);
    setLoadingMore(false);
    setPageOffset(0);
    consumedBefore.current = null;
    consumedOffset.current = null;
    setExpandedThreadIds(new Set());
  }, [sort, code]);

  React.useEffect(() => {
    if (firstPage === undefined) return;
    if (olderPages.length === 0) {
      setHasMore(firstPage.hasMore);
    }
  }, [firstPage, olderPages.length]);

  React.useEffect(() => {
    if (sort === "newest") {
      if (loadBefore === null || olderPage === undefined) return;
      if (consumedBefore.current === loadBefore) return;
      consumedBefore.current = loadBefore;
      setOlderPages((prev) => [olderPage.comments as Comment[], ...prev]);
      setHasMore(olderPage.hasMore);
      setLoadBefore(null);
      setLoadingMore(false);
      return;
    }
    if (loadOffset === null || olderPage === undefined) return;
    if (consumedOffset.current === loadOffset) return;
    consumedOffset.current = loadOffset;
    setOlderPages((prev) => [...prev, olderPage.comments as Comment[]]);
    setPageOffset(loadOffset + PAGE_SIZE);
    setHasMore(olderPage.hasMore);
    setLoadOffset(null);
    setLoadingMore(false);
  }, [olderPage, loadBefore, loadOffset, sort]);

  const comments = React.useMemo(() => {
    const byId = new Map<Id<"barkComments">, Comment>();
    if (sort === "newest") {
      for (const page of olderPages) {
        for (const comment of page) byId.set(comment._id, comment);
      }
      for (const comment of (firstPage?.comments ?? []) as Comment[]) {
        byId.set(comment._id, comment);
      }
      return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
    }
    // Preserve server order for evidenced / op (first page then older loaded pages)
    const ordered: Comment[] = [];
    const seen = new Set<Id<"barkComments">>();
    const pushPage = (page: Comment[]) => {
      for (const comment of page) {
        if (seen.has(comment._id)) continue;
        seen.add(comment._id);
        ordered.push(comment);
        byId.set(comment._id, comment);
      }
    };
    pushPage((firstPage?.comments ?? []) as Comment[]);
    for (const page of olderPages) pushPage(page);
    return ordered;
  }, [olderPages, firstPage?.comments, sort]);

  const loadPrevious = () => {
    if (loadingMore) return;
    if (sort === "newest") {
      const oldestTop = comments
        .filter((c) => !c.parentId)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldestTop) return;
      setLoadingMore(true);
      setLoadBefore(oldestTop.createdAt);
      return;
    }
    const nextOffset = pageOffset > 0 ? pageOffset : PAGE_SIZE;
    setLoadingMore(true);
    setLoadOffset(nextOffset);
  };

  const startReply = (comment: Comment) => {
    // One-level threads: always attach under the root, mention the person clicked.
    setParentId(comment.parentId ?? comment._id);
    setParentName(comment.authorName);
    const handle = slugifyMentionHandle(comment.authorName);
    setBody((current) =>
      current.includes(`@${handle}`)
        ? current
        : `@${handle} ${current}`.replace(/^\s+/, "")
    );
  };

  const cancelReply = () => {
    setParentId(null);
    setParentName(null);
  };

  React.useEffect(() => {
    if (!parentId) return;
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [parentId]);

  const topLevel =
    sort === "newest"
      ? comments.filter((c) => !c.parentId)
      : (() => {
          const tops = comments.filter((c) => !c.parentId);
          // Children were interleaved chronologically; keep first-seen order of roots.
          return tops;
        })();
  const childrenOf = (id: Id<"barkComments">) =>
    comments
      .filter((c) => c.parentId === id)
      .sort((a, b) => a.createdAt - b.createdAt);

  if (!signedIn) {
    return (
      <Card className="gap-0 p-0">
        <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sign in to view and join the reply chain.
          </p>
          <SignInButton>
            <Button size="sm">Sign in</Button>
          </SignInButton>
        </div>
      </Card>
    );
  }

  const post = async () => {
    const text = body.trim();
    if (!text && !stickerId && !voiceDraft) {
      toast.error("Write a comment, send a sticker, or record a voice note");
      return;
    }
    setPosting(true);
    try {
      let voiceStorageId: Id<"_storage"> | undefined;
      let voiceDurationMs: number | undefined;
      if (voiceDraft) {
        const postUrl = await generateUploadUrl();
        const uploaded = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": voiceDraft.contentType || "audio/webm",
          },
          body: voiceDraft.blob,
        });
        if (!uploaded.ok) throw new Error("Voice upload failed");
        const payload = (await uploaded.json()) as { storageId?: string };
        if (!payload.storageId) throw new Error("Voice upload failed");
        voiceStorageId = payload.storageId as Id<"_storage">;
        voiceDurationMs = voiceDraft.durationMs;
      }
      await addComment({
        code,
        body,
        ...(parentId ? { parentId } : {}),
        ...(stickerId ? { stickerId } : {}),
        ...(voiceStorageId
          ? { voiceStorageId, voiceDurationMs }
          : {}),
      });
      setBody("");
      setStickerId(null);
      setVoiceDraft(null);
      setParentId(null);
      setParentName(null);
      setOlderPages([]);
      setLoadBefore(null);
      setLoadOffset(null);
      setLoadingMore(false);
      setPageOffset(0);
      consumedBefore.current = null;
      consumedOffset.current = null;
      setExpandedThreadIds(new Set());
      await queryClient.invalidateQueries({ queryKey: barkKeys.public });
      await queryClient.invalidateQueries({ queryKey: barkKeys.detail(code) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  const replyCountLabel = `${replyCount} ${
    replyCount === 1 ? "reply" : "replies"
  }`;

  const composer = (
    <div ref={composerRef}>
      <ReplyComposer
        nested={Boolean(parentId)}
        userId={user?.id ?? "guest"}
        userName={user?.fullName ?? "You"}
        userImageUrl={user?.imageUrl}
        parentName={parentName}
        onCancel={cancelReply}
        mentionRef={mentionRef}
        barkCode={code}
        body={body}
        onBodyChange={setBody}
        stickerId={stickerId}
        onStickerChange={setStickerId}
        voiceDraft={voiceDraft}
        onVoiceDraftChange={setVoiceDraft}
        replyCountLabel={replyCountLabel}
        posting={posting}
        onPost={() => void post()}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Sort replies</p>
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as CommentSort)}
        >
          <SelectTrigger className="h-8 w-[11.5rem] text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="evidenced">Most evidenced</SelectItem>
            <SelectItem value="op">OP first</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasMore || loadingMore ? (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            disabled={loadingMore || firstPage === undefined}
            onClick={loadPrevious}
          >
            {loadingMore
              ? "Loading…"
              : sort === "newest"
                ? "View previous comments"
                : "Load more replies"}
          </Button>
        </div>
      ) : null}
      {!parentId ? composer : null}
      {firstPage === undefined ? (
        <p className="text-sm text-muted-foreground">Loading replies…</p>
      ) : (
        topLevel.map((comment) => {
          const kids = childrenOf(comment._id);
          const expanded = expandedThreadIds.has(comment._id);
          const hiddenCount = Math.max(0, kids.length - INITIAL_REPLIES);
          const visibleKids =
            expanded || kids.length <= INITIAL_REPLIES
              ? kids
              : kids.slice(-INITIAL_REPLIES);

          return (
            <div key={comment._id} className="space-y-3">
              <CommentItem
                comment={comment}
                code={code}
                onReply={startReply}
              />
              {!expanded && hiddenCount > 0 ? (
                <div className="ml-5 sm:ml-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-0 text-xs text-primary hover:bg-transparent"
                    onClick={() =>
                      setExpandedThreadIds((prev) => {
                        const next = new Set(prev);
                        next.add(comment._id);
                        return next;
                      })
                    }
                  >
                    View {hiddenCount} more{" "}
                    {hiddenCount === 1 ? "reply" : "replies"}
                  </Button>
                </div>
              ) : null}
              {visibleKids.map((child) => (
                <CommentItem
                  key={child._id}
                  comment={child}
                  code={code}
                  isChild
                  onReply={startReply}
                />
              ))}
              {parentId === comment._id ? composer : null}
            </div>
          );
        })
      )}
    </div>
  );
}
