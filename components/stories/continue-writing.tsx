"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  Eye,
  Heading2,
  Italic,
  Quote,
  Save,
} from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CoverPicker } from "@/components/stories/cover-picker";
import { StoryIdeaContext } from "@/components/stories/story-idea-context";
import { StorySettingsDialog } from "@/components/stories/story-settings-dialog";
import { ReadingProse } from "@/components/reading-prose";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { StoryGenre, StoryStatus } from "@/lib/story-types";

const DRAFT_KEY = "draft";

export function ContinueWriting({
  storyTitle,
  slug,
  genreLabel,
  initialTitle,
  initialBody,
}: {
  storyTitle: string;
  slug: string;
  genreLabel: string;
  initialTitle: string;
  initialBody: string;
}) {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(
    api.stories.getMineBySlug,
    isAuthenticated ? { slug } : "skip"
  );
  const saveDraft = useMutation(api.stories.saveDraftChapter);
  const publish = useMutation(api.stories.publishChapter);
  const updateChapter = useMutation(api.stories.updateChapter);
  const [partKey, setPartKey] = React.useState(DRAFT_KEY);
  const [title, setTitle] = React.useState(initialTitle);
  const [body, setBody] = React.useState(initialBody);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const publishedChapters = live?.publishedChapters ?? [];
  const editingPublished = partKey !== DRAFT_KEY;
  const publishedNumber = editingPublished ? Number(partKey) : null;
  const partNumber = editingPublished
    ? publishedNumber
    : (live?.draft?.number ??
      (live ? live.publishedChapterCount + 1 : undefined));
  const nextDraftNumber = live
    ? (live.draft?.number ?? live.publishedChapterCount + 1)
    : undefined;

  const loadPart = (key: string) => {
    setPartKey(key);
    setSavedAt(null);
    if (key === DRAFT_KEY) {
      setTitle(live?.draft?.title ?? `Part ${nextDraftNumber ?? 1}`);
      setBody(live?.draft?.body ?? "");
      return;
    }
    const chapter = publishedChapters.find((row) => String(row.number) === key);
    if (chapter) {
      setTitle(chapter.title);
      setBody(chapter.body);
    }
  };

  const persist = async (asPublish: boolean) => {
    setSaving(true);
    try {
      if (editingPublished && publishedNumber !== null) {
        await updateChapter({
          slug,
          number: publishedNumber,
          title,
          body,
        });
        setSavedAt(new Date().toISOString());
        toast.success(`Part ${publishedNumber} saved`);
      } else if (asPublish) {
        const result = await publish({ slug, title, body });
        toast.success(`Part ${result.number} published`);
        setPartKey(DRAFT_KEY);
        setTitle(`Part ${result.nextNumber}`);
        setBody("");
        setSavedAt(null);
      } else {
        await saveDraft({ slug, title, body });
        setSavedAt(new Date().toISOString());
        toast.success("Draft saved");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save chapter"
      );
    } finally {
      setSaving(false);
    }
  };

  const wrap = (prefix: string, suffix = prefix) => {
    setBody(
      (prev) =>
        `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}${prefix}text${suffix}`
    );
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const story = live?.story;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/stories/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{genreLabel}</Badge>
          <span>{words} words</span>
          {savedAt && <span>· saved</span>}
          {story && (
            <>
              <CoverPicker storyTitle={story.title} storyId={story._id} />
              <StorySettingsDialog
                slug={slug}
                title={story.title}
                blurb={story.blurb}
                genre={story.genre as StoryGenre}
                tags={story.tags}
                mature={story.mature}
                status={story.status as StoryStatus}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {story?.title ?? storyTitle}
          {partNumber ? ` · Part ${partNumber}` : ""}
        </p>
      </div>

      {story ? <StoryIdeaContext storyId={story._id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="part-picker">Part</Label>
        <Select value={partKey} onValueChange={loadPart} disabled={!live}>
          <SelectTrigger id="part-picker" className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {publishedChapters.map((chapter) => (
              <SelectItem key={chapter._id} value={String(chapter.number)}>
                Part {chapter.number}: {chapter.title}
              </SelectItem>
            ))}
            <SelectItem value={DRAFT_KEY}>
              {live?.draft
                ? `Draft · Part ${live.draft.number}`
                : `New part${nextDraftNumber ? ` · Part ${nextDraftNumber}` : ""}`}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chapter-title">Chapter title</Label>
        <Input
          id="chapter-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold"
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1"
        role="toolbar"
        aria-label="Formatting"
      >
        {[
          { icon: Bold, label: "Bold", prefix: "**", suffix: "**" },
          { icon: Italic, label: "Italic", prefix: "*", suffix: "*" },
          { icon: Heading2, label: "Heading", prefix: "\n## ", suffix: "" },
          { icon: Quote, label: "Quote", prefix: "\n> ", suffix: "" },
        ].map(({ icon: Icon, label, prefix, suffix }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={label}
            onClick={() => wrap(prefix, suffix)}
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </div>

      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="size-3.5" /> Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            aria-label="Chapter body"
            placeholder="Continue the story…"
            className="min-h-[28rem] resize-y font-serif text-[16px] leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </TabsContent>
        <TabsContent value="preview">
          <ReadingProse className="min-h-[28rem] rounded-md border p-6">
            {body ? (
              body.split("\n\n").map((para, i) =>
                para.startsWith("## ") ? (
                  <h2 key={i} className="mb-3 text-xl font-semibold">
                    {para.slice(3)}
                  </h2>
                ) : para.startsWith("> ") ? (
                  <blockquote
                    key={i}
                    className="my-3 border-l-2 border-primary/40 pl-4 italic text-muted-foreground"
                  >
                    {para.slice(2)}
                  </blockquote>
                ) : (
                  <p key={i} className="mb-3 leading-relaxed">
                    {para}
                  </p>
                )
              )
            ) : (
              <p className="text-muted-foreground">Nothing to preview yet.</p>
            )}
          </ReadingProse>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2">
        {editingPublished && publishedNumber !== null && (
          <Button variant="outline" asChild>
            <Link href={`/stories/${slug}/chapters/${publishedNumber}`}>
              <Eye className="size-4" /> View part
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => persist(false)}
          disabled={saving}
        >
          <Save className="size-4" />{" "}
          {saving
            ? "Saving…"
            : editingPublished
              ? "Save"
              : "Save draft"}
        </Button>
        {!editingPublished && (
          <Button
            onClick={() => persist(true)}
            disabled={saving || !body.trim()}
          >
            Publish part
          </Button>
        )}
      </div>
    </div>
  );
}
