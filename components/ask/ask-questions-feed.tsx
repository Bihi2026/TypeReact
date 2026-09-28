"use client";

import * as React from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Bookmark,
  Check,
  CircleHelp,
  Copy,
  Flag,
  MessageCircle,
  Pencil,
  ThumbsUp,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { AskEditor, type AskDraft, type AskPayload } from "@/components/ask/ask-editor";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BarkSticker, type BarkStickerId } from "@/lib/barks/stickers";
import { formatNumber, timeAgo } from "@/lib/format";
import { caseCategoryMeta, reportCategoryMeta } from "@/lib/meta";
import type { ReportCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 8;
const ASK_ID = /^[a-z0-9]{32}$/;

type AskTarget = {
  questionId: Id<"questions">;
  answerId: Id<"questionAnswers"> | null;
};

function readAskTarget(): AskTarget | null {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const [questionPart, answerPart] = raw.split(":");
  if (!questionPart || !ASK_ID.test(questionPart)) return null;
  const answerId =
    answerPart && ASK_ID.test(answerPart)
      ? (answerPart as Id<"questionAnswers">)
      : null;
  return {
    questionId: questionPart as Id<"questions">,
    answerId,
  };
}

type QuestionItem = FunctionReturnType<typeof api.questions.list>[number];
type AnswerItem = FunctionReturnType<typeof api.questions.listAnswers>[number];
type Sort = "recent" | "top" | "unanswered" | "accepted" | "mine";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "top", label: "Top" },
  { id: "unanswered", label: "Unanswered" },
  { id: "accepted", label: "Accepted" },
  { id: "mine", label: "Mine" },
];

function mediaPayload(payload: AskPayload) {
  return {
    body: payload.body,
    topic: payload.topic,
    sourceUrl: payload.sourceUrl,
    imageStorageId: payload.imageStorageId,
    voiceStorageId: payload.voiceStorageId,
    voiceDurationMs: payload.voiceDurationMs,
  };
}

function draftFromQuestion(question: QuestionItem): AskDraft {
  return {
    body: question.body,
    topic: question.topic,
    sourceUrl: question.sourceUrl,
    imageStorageId: question.imageStorageId,
    imageUrl: question.imageUrl,
    voiceStorageId: question.voiceStorageId,
    voiceUrl: question.voiceUrl,
    voiceDurationMs: question.voiceDurationMs,
    stickerId: null,
  };
}

function draftFromAnswer(answer: AnswerItem): AskDraft {
  return {
    body: answer.body,
    topic: answer.topic,
    sourceUrl: answer.sourceUrl,
    imageStorageId: answer.imageStorageId,
    imageUrl: answer.imageUrl,
    voiceStorageId: answer.voiceStorageId,
    voiceUrl: answer.voiceUrl,
    voiceDurationMs: answer.voiceDurationMs,
    stickerId: answer.stickerId,
  };
}

function matchesSearch(question: QuestionItem, query: string) {
  if (!query) return true;
  const topicLabel = question.topic
    ? caseCategoryMeta[question.topic].label.toLowerCase()
    : "";
  return (
    question.body.toLowerCase().includes(query) ||
    question.authorName.toLowerCase().includes(query) ||
    topicLabel.includes(query) ||
    (question.topic?.toLowerCase().includes(query) ?? false)
  );
}

export function AskQuestionsFeed() {
  const { isSignedIn, user } = useUser();
  const questions = useQuery(api.questions.list);
  const [target, setTarget] = React.useState<AskTarget | null>(null);
  const [sort, setSort] = React.useState<Sort>("recent");
  const [search, setSearch] = React.useState("");
  const [visible, setVisible] = React.useState(INITIAL_VISIBLE);

  React.useEffect(() => {
    const sync = () => setTarget(readAskTarget());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const inList = Boolean(
    target && questions?.some((item) => item._id === target.questionId)
  );
  const fetched = useQuery(
    api.questions.get,
    target && questions && !inList ? { questionId: target.questionId } : "skip"
  );
  const linked =
    questions?.find((item) => item._id === target?.questionId) ??
    fetched ??
    null;

  React.useEffect(() => {
    if (!linked) return;
    setSearch("");
    setSort("recent");
  }, [linked?._id]);

  React.useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [sort, search]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    let items = (questions ?? []).filter((item) => matchesSearch(item, query));
    if (sort === "unanswered") {
      items = items.filter((item) => item.answerCount === 0);
    }
    if (sort === "accepted") {
      items = items.filter((item) => item.acceptedAnswerId);
    }
    if (sort === "mine" && user?.id) {
      items = items.filter((item) => item.authorClerkId === user.id);
    }
    if (sort === "top") {
      return [...items].sort(
        (a, b) => b.likeCount - a.likeCount || b.answerCount - a.answerCount
      );
    }
    return [...items].sort((a, b) => b.createdAt - a.createdAt);
  }, [questions, search, sort, user?.id]);

  const pinned =
    linked && questions && !questions.some((item) => item._id === linked._id)
      ? linked
      : null;
  const merged = pinned
    ? [pinned, ...filtered.filter((item) => item._id !== pinned._id)]
    : filtered;
  const focusIndex = linked
    ? merged.findIndex((item) => item._id === linked._id)
    : -1;
  const reveal = focusIndex >= 0 ? Math.max(visible, focusIndex + 1) : visible;
  const shown = merged.slice(0, reveal);
  const browsing = search.trim().length > 0 || sort !== "recent";
  const waitingForLink = Boolean(target && questions && !inList && fetched === undefined);

  return (
    <div className="min-w-0 space-y-6 px-4 py-8 lg:px-6">
      <section aria-labelledby="ask-questions" className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 id="ask-questions" className="text-lg font-semibold tracking-tight">
            Ask a question
          </h1>
          <p className="text-sm text-muted-foreground">Find open discussions</p>
        </div>
        <AskComposer />
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions, people, or topics"
            aria-label="Search questions"
          />
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((item) => {
              const chip = (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={sort === item.id}
                  onClick={
                    item.id === "mine" && !isSignedIn
                      ? undefined
                      : () => setSort(item.id)
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    sort === item.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </button>
              );
              if (item.id === "mine" && !isSignedIn) {
                return <SignInButton key={item.id}>{chip}</SignInButton>;
              }
              return chip;
            })}
          </div>
        </div>
        {questions === undefined || waitingForLink ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : merged.length === 0 && !browsing ? (
          <EmptyState
            icon={CircleHelp}
            title="No questions yet"
            description="Be the first to ask. Questions you post show up here for anyone to answer."
          />
        ) : merged.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions match this view.
          </p>
        ) : (
          <div className="space-y-3">
            {shown.map((question) => (
              <QuestionCard
                key={question._id}
                question={question}
                highlighted={
                  linked?._id === question._id && !target?.answerId
                }
                focusAnswerId={
                  linked?._id === question._id
                    ? (target?.answerId ?? null)
                    : null
                }
              />
            ))}
            {merged.length > reveal ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisible((count) => count + INITIAL_VISIBLE)}
              >
                Show more
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function AskComposer() {
  const { isSignedIn, user } = useUser();
  const name = user?.fullName?.trim() || user?.firstName?.trim() || "You";
  const [open, setOpen] = React.useState(false);
  const create = useMutation(api.questions.create);
  const field = (
    <span className="flex h-11 min-w-0 flex-1 items-center rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
      Ask a question…
    </span>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
      <PersonAvatar
        id={user?.id ?? "guest"}
        name={name}
        imageUrl={user?.imageUrl}
        className="size-10"
      />
      {isSignedIn ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 rounded-full text-left focus-visible:outline-2 focus-visible:outline-ring"
          >
            {field}
          </button>
          <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Ask a question</DialogTitle>
            </DialogHeader>
            <div className="flex gap-3">
              <PersonAvatar
                id={user?.id ?? "guest"}
                name={name}
                imageUrl={user?.imageUrl}
                className="size-10"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold">{name}</p>
                {open ? (
                  <AskEditor
                    mode="question"
                    submitLabel="Post"
                    onSubmit={async (payload) => {
                      await create(mediaPayload(payload));
                      setOpen(false);
                    }}
                  />
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <SignInButton>
          <button type="button" className="min-w-0 flex-1 text-left">
            {field}
          </button>
        </SignInButton>
      )}
    </div>
  );
}

function PostBody({
  topic,
  body,
  imageUrl,
  voiceUrl,
  sourceUrl,
  stickerId,
}: {
  topic: QuestionItem["topic"];
  body: string;
  imageUrl: string | null;
  voiceUrl: string | null;
  sourceUrl: string | null;
  stickerId?: BarkStickerId | null;
}) {
  return (
    <div className="mt-3 space-y-3">
      {topic ? (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {caseCategoryMeta[topic].label}
        </span>
      ) : null}
      {body ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      ) : null}
      {stickerId ? <BarkSticker id={stickerId} className="size-16" /> : null}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="max-h-80 w-full rounded-xl object-cover" />
      ) : null}
      {voiceUrl ? <audio src={voiceUrl} controls className="w-full" /> : null}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-primary underline"
        >
          {sourceUrl}
        </a>
      ) : null}
    </div>
  );
}

function QuestionCard({
  question,
  highlighted,
  focusAnswerId,
}: {
  question: QuestionItem;
  highlighted: boolean;
  focusAnswerId: Id<"questionAnswers"> | null;
}) {
  const { isSignedIn, user } = useUser();
  const toggleLike = useMutation(api.questions.toggleLike);
  const toggleSave = useMutation(api.questions.toggleSave);
  const toggleFollow = useMutation(api.questions.toggleFollow);
  const update = useMutation(api.questions.update);
  const remove = useMutation(api.questions.remove);
  const [open, setOpen] = React.useState(Boolean(focusAnswerId));
  const [answerMissing, setAnswerMissing] = React.useState(false);
  const cardRef = React.useRef<HTMLElement>(null);
  const [editing, setEditing] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const mine = user?.id === question.authorClerkId;
  const showRing = highlighted || (Boolean(focusAnswerId) && answerMissing);
  const markAnswerMissing = React.useCallback(() => {
    setAnswerMissing(true);
  }, []);

  React.useEffect(() => {
    if (focusAnswerId) setOpen(true);
  }, [focusAnswerId]);

  React.useEffect(() => {
    if (!showRing) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showRing]);

  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/AskQuestions#${question._id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <article
      ref={cardRef}
      id={`ask-${question._id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm",
        showRing && "ring-2 ring-primary"
      )}
    >
      <div className="flex gap-3">
        <PersonAvatar
          id={question.authorClerkId}
          name={question.authorName}
          imageUrl={question.authorImageUrl ?? undefined}
          className="size-10"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{question.authorName}</p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(new Date(question.createdAt).toISOString())}
            {question.updatedAt ? " · Edited" : ""}
          </p>
        </div>
      </div>
      <PostBody
        topic={question.topic}
        body={question.body}
        imageUrl={question.imageUrl}
        voiceUrl={question.voiceUrl}
        sourceUrl={question.sourceUrl}
      />
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-2">
        <AuthAction signedIn={isSignedIn}>
          <ActionButton
            pressed={question.likedByMe}
            disabled={pending}
            onClick={
              isSignedIn
                ? () => run(() => toggleLike({ questionId: question._id }))
                : undefined
            }
          >
            <ThumbsUp className="size-4" aria-hidden />
            Like
            <span className="tabular-nums">{formatNumber(question.likeCount)}</span>
          </ActionButton>
        </AuthAction>
        <ActionButton pressed={open} onClick={() => setOpen((value) => !value)}>
          <MessageCircle className="size-4" aria-hidden />
          Answer
          <span className="tabular-nums">{formatNumber(question.answerCount)}</span>
        </ActionButton>
        <AuthAction signedIn={isSignedIn}>
          <ActionButton
            pressed={question.savedByMe}
            disabled={pending}
            onClick={
              isSignedIn
                ? () => run(() => toggleSave({ questionId: question._id }))
                : undefined
            }
          >
            <Bookmark className="size-4" aria-hidden />
            Save
          </ActionButton>
        </AuthAction>
        <AuthAction signedIn={isSignedIn}>
          <ActionButton
            pressed={question.followedByMe}
            disabled={pending}
            onClick={
              isSignedIn
                ? () => run(() => toggleFollow({ questionId: question._id }))
                : undefined
            }
          >
            <UserPlus className="size-4" aria-hidden />
            Follow
          </ActionButton>
        </AuthAction>
        <ActionButton onClick={() => void copyLink()}>
          <Copy className="size-4" aria-hidden />
          Copy link
        </ActionButton>
        <AuthAction signedIn={isSignedIn}>
          <ActionButton
            onClick={isSignedIn ? () => setReporting(true) : undefined}
          >
            <Flag className="size-4" aria-hidden />
            Report
          </ActionButton>
        </AuthAction>
        {mine ? (
          <>
            <ActionButton onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </ActionButton>
            <ActionButton onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" aria-hidden />
              Delete
            </ActionButton>
          </>
        ) : null}
      </div>
      {open ? (
        <AnswerThread
          questionId={question._id}
          askerId={question.authorClerkId}
          acceptedAnswerId={question.acceptedAnswerId}
          focusAnswerId={focusAnswerId}
          onAnswerMissing={markAnswerMissing}
        />
      ) : null}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
          </DialogHeader>
          {editing ? (
            <AskEditor
              mode="question"
              initial={draftFromQuestion(question)}
              submitLabel="Save"
              onSubmit={async (payload) => {
                await update({ questionId: question._id, ...mediaPayload(payload) });
                setEditing(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        questionId={question._id}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this question?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => run(() => remove({ questionId: question._id }))}
      />
    </article>
  );
}

function AnswerThread({
  questionId,
  askerId,
  acceptedAnswerId,
  focusAnswerId,
  onAnswerMissing,
}: {
  questionId: Id<"questions">;
  askerId: string;
  acceptedAnswerId: Id<"questionAnswers"> | null;
  focusAnswerId: Id<"questionAnswers"> | null;
  onAnswerMissing: () => void;
}) {
  const { isSignedIn, user } = useUser();
  const answers = useQuery(api.questions.listAnswers, { questionId });
  const addAnswer = useMutation(api.questions.addAnswer);
  const [draftKey, setDraftKey] = React.useState(0);
  const name = user?.fullName?.trim() || user?.firstName?.trim() || "You";
  const ordered = [...(answers ?? [])].sort((a, b) => {
    if (a._id === acceptedAnswerId) return -1;
    if (b._id === acceptedAnswerId) return 1;
    return a.createdAt - b.createdAt;
  });

  React.useEffect(() => {
    if (!focusAnswerId || answers === undefined) return;
    if (!answers.some((answer) => answer._id === focusAnswerId)) {
      onAnswerMissing();
    }
  }, [answers, focusAnswerId, onAnswerMissing]);

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {answers === undefined ? (
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      ) : ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No answers yet.</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((answer) => (
            <AnswerRow
              key={answer._id}
              answer={answer}
              questionId={questionId}
              accepted={answer._id === acceptedAnswerId}
              canAccept={user?.id === askerId}
              highlighted={answer._id === focusAnswerId}
            />
          ))}
        </ul>
      )}
      {isSignedIn ? (
        <div className="flex items-start gap-2">
          <PersonAvatar
            id={user?.id ?? "guest"}
            name={name}
            imageUrl={user?.imageUrl}
            className="size-8"
          />
          <div className="min-w-0 flex-1">
            <AskEditor
              key={draftKey}
              mode="answer"
              submitLabel="Answer"
              onSubmit={async (payload) => {
                await addAnswer({
                  questionId,
                  ...mediaPayload(payload),
                  stickerId: payload.stickerId,
                });
                setDraftKey((value) => value + 1);
              }}
            />
          </div>
        </div>
      ) : (
        <SignInButton>
          <Button variant="outline" size="sm">
            Sign in to answer
          </Button>
        </SignInButton>
      )}
    </div>
  );
}

function AnswerRow({
  answer,
  questionId,
  accepted,
  canAccept,
  highlighted,
}: {
  answer: AnswerItem;
  questionId: Id<"questions">;
  accepted: boolean;
  canAccept: boolean;
  highlighted: boolean;
}) {
  const { isSignedIn, user } = useUser();
  const toggleLike = useMutation(api.questions.toggleAnswerLike);
  const acceptAnswer = useMutation(api.questions.acceptAnswer);
  const updateAnswer = useMutation(api.questions.updateAnswer);
  const removeAnswer = useMutation(api.questions.removeAnswer);
  const [editing, setEditing] = React.useState(false);
  const [reporting, setReporting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const mine = user?.id === answer.authorClerkId;
  const rowRef = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const like = async () => {
    try {
      await toggleLike({ answerId: answer._id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const accept = async () => {
    try {
      await acceptAnswer({ questionId, answerId: answer._id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <li
      ref={rowRef}
      id={`ask-answer-${answer._id}`}
      className={cn(
        "flex scroll-mt-24 gap-2 rounded-2xl",
        highlighted && "ring-2 ring-primary"
      )}
    >
      <PersonAvatar
        id={answer.authorClerkId}
        name={answer.authorName}
        imageUrl={answer.authorImageUrl ?? undefined}
        className="size-8"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <AskEditor
            mode="answer"
            initial={draftFromAnswer(answer)}
            submitLabel="Save"
            onSubmit={async (payload) => {
              await updateAnswer({
                answerId: answer._id,
                ...mediaPayload(payload),
                stickerId: payload.stickerId,
              });
              setEditing(false);
            }}
          />
        ) : (
          <div className="rounded-2xl bg-muted px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{answer.authorName}</p>
              {accepted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Check className="size-3" aria-hidden />
                  Accepted
                </span>
              ) : null}
            </div>
            <PostBody
              topic={answer.topic}
              body={answer.body}
              imageUrl={answer.imageUrl}
              voiceUrl={answer.voiceUrl}
              sourceUrl={answer.sourceUrl}
              stickerId={answer.stickerId}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {timeAgo(new Date(answer.createdAt).toISOString())}
              {answer.updatedAt ? " · Edited" : ""}
            </p>
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <AuthAction signedIn={isSignedIn}>
            <ActionButton
              pressed={answer.likedByMe}
              onClick={isSignedIn ? () => void like() : undefined}
            >
              <ThumbsUp className="size-3.5" aria-hidden />
              <span className="tabular-nums">{formatNumber(answer.likeCount)}</span>
            </ActionButton>
          </AuthAction>
          {canAccept ? (
            <ActionButton onClick={() => void accept()}>
              {accepted ? "Clear" : "Accept"}
            </ActionButton>
          ) : null}
          <AuthAction signedIn={isSignedIn}>
            <ActionButton onClick={isSignedIn ? () => setReporting(true) : undefined}>
              Report
            </ActionButton>
          </AuthAction>
          {mine ? (
            <>
              <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
              <ActionButton onClick={() => setConfirmingDelete(true)}>
                Delete
              </ActionButton>
            </>
          ) : null}
        </div>
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          questionId={questionId}
          answerId={answer._id}
        />
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title="Delete this answer?"
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={async () => {
            try {
              await removeAnswer({ answerId: answer._id });
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Something went wrong"
              );
            }
          }}
        />
      </div>
    </li>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  questionId,
  answerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: Id<"questions">;
  answerId?: Id<"questionAnswers">;
}) {
  const report = useMutation(api.questions.report);
  const [category, setCategory] = React.useState<ReportCategory>("other");
  const [details, setDetails] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      await report({ questionId, answerId, category, details });
      setDetails("");
      onOpenChange(false);
      toast.success("Report sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{answerId ? "Report answer" : "Report question"}</DialogTitle>
        </DialogHeader>
        <label className="block text-xs font-medium text-muted-foreground">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ReportCategory)}
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {Object.entries(reportCategoryMeta).map(([slug, meta]) => (
              <option key={slug} value={slug}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <Textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="What should a moderator know?"
          className="min-h-24"
          maxLength={2000}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={submit} disabled={pending || details.trim().length < 10}>
          {pending ? "Sending…" : "Report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AuthAction({
  signedIn,
  children,
}: {
  signedIn: boolean | undefined;
  children: React.ReactElement;
}) {
  if (signedIn) return children;
  return <SignInButton>{children}</SignInButton>;
}

function ActionButton({
  children,
  pressed,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted",
        pressed && "text-primary"
      )}
    >
      {children}
    </button>
  );
}
