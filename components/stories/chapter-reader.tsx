"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  List,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { ChapterTts } from "@/components/stories/chapter-tts";
import { StoryComments } from "@/components/stories/story-comments";
import { VoteButton } from "@/components/stories/story-actions";
import { ReportButton } from "@/components/report-dialog";
import { ReadingProse } from "@/components/reading-prose";
import { ReadingTextSizeControl } from "@/components/reading-text-size-control";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Chapter } from "@/lib/story-types";
import { STORAGE_KEYS, writeUserJson } from "@/lib/storage";
import { api } from "@/convex/_generated/api";

export function ChapterReader({
  storySlug,
  storyTitle,
  authorName,
  chapter,
  totalChapters,
  storyVotes,
}: {
  storySlug: string;
  storyTitle: string;
  authorName: string;
  chapter: Chapter;
  totalChapters: number;
  storyVotes: number;
}) {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const userId = user?.id;
  const recordView = useMutation(api.storySocial.recordView);
  const [progress, setProgress] = React.useState(0);
  const articleRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    void recordView({ slug: storySlug });
  }, [isAuthenticated, recordView, storySlug]);

  // Track scroll progress through the chapter body.
  React.useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(total > 0 ? (scrolled / total) * 100 : 100);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Persist reading position so the library can offer "continue reading".
  React.useEffect(() => {
    if (!userId) return;
    const save = () => {
      writeUserJson(userId, STORAGE_KEYS.reading(storySlug), {
        chapter: chapter.number,
        percent: Math.round(progress),
        at: Date.now(),
      });
    };
    const id = setTimeout(save, 500);
    return () => clearTimeout(id);
  }, [userId, storySlug, chapter.number, progress]);

  const prev = chapter.number > 1 ? chapter.number - 1 : null;
  const next = chapter.number < totalChapters ? chapter.number + 1 : null;
  const remainingRead =
    progress >= 99.5
      ? "Done"
      : `${Math.max(
          1,
          Math.round(chapter.readingMinutes * (1 - progress / 100))
        )} min left`;

  return (
    <div>
      {/* Sticky progress bar */}
      <div
        className="sticky top-16 z-30 h-1 w-full bg-border/50 sm:top-24"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Reader toolbar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/stories/${storySlug}`}
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{storyTitle}</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ChapterTts
              paragraphs={chapter.paragraphs}
              wordCount={chapter.wordCount}
              chapterKey={`${storySlug}:${chapter.number}`}
            />
            <ReadingTextSizeControl />
            <Button asChild variant="outline" size="sm" aria-label="Table of contents">
              <Link href={`/stories/${storySlug}`}>
                <List className="size-4" />
              </Link>
            </Button>
            <ReportButton
              target={`chapter ${chapter.number} of "${storyTitle}"`}
              storySlug={storySlug}
              iconOnly
            />
          </div>
        </div>

        {/* Chapter header */}
        <header className="mb-8 space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Part {chapter.number} of {totalChapters}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {chapter.title}
          </h1>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>by {authorName}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {chapter.readingMinutes} min read
              {chapter.readingMinutes > 0 ? ` · ${remainingRead}` : null}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" aria-hidden />
              {chapter.wordCount.toLocaleString()} words
            </span>
          </p>
        </header>

        {/* Body */}
        <ReadingProse ref={articleRef} className="text-foreground/90">
          {chapter.paragraphs.map((p, i) => (
            <p key={i} className="mb-5">
              {p}
            </p>
          ))}
        </ReadingProse>

        {/* End-of-chapter actions */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <VoteButton
            initialVotes={storyVotes}
            size="default"
            slug={storySlug}
          />
          <div className="flex w-full items-center justify-between gap-3">
            {prev ? (
              <Button asChild variant="outline">
                <Link href={`/stories/${storySlug}/chapters/${prev}`}>
                  <ArrowLeft className="size-4" /> Part {prev}
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button asChild>
                <Link href={`/stories/${storySlug}/chapters/${next}`}>
                  Part {next} <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/stories/${storySlug}`}>
                  Back to story <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-10" />

        {/* Chapter comments */}
        <section aria-labelledby="chapter-comments-heading" className="space-y-4">
          <h2
            id="chapter-comments-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Comments on this part
          </h2>
          <StoryComments slug={storySlug} chapterNumber={chapter.number} />
        </section>
      </div>
    </div>
  );
}
