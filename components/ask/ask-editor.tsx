"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { ImagePlus, Link2, Smile } from "lucide-react";
import { StickerPicker } from "@/components/comments/sticker-picker";
import {
  VoiceNoteRecorder,
  type VoiceDraft,
} from "@/components/comments/voice-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { BarkStickerId } from "@/lib/barks/stickers";
import { caseCategoryMeta } from "@/lib/meta";
import type { CaseCategory } from "@/lib/types";

const EMOJIS = ["😀", "😂", "❤️", "👍", "🔥", "💡", "❓", "👀", "👏", "🙏"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type AskDraft = {
  body: string;
  topic: CaseCategory | null;
  sourceUrl: string | null;
  imageStorageId: Id<"_storage"> | null;
  imageUrl: string | null;
  voiceStorageId: Id<"_storage"> | null;
  voiceUrl: string | null;
  voiceDurationMs: number | null;
  stickerId: BarkStickerId | null;
};

export type AskPayload = {
  body: string;
  topic: CaseCategory | null;
  sourceUrl: string | null;
  imageStorageId: Id<"_storage"> | null;
  voiceStorageId: Id<"_storage"> | null;
  voiceDurationMs: number | null;
  stickerId: BarkStickerId | null;
};

async function uploadBlob(
  uploadUrl: string,
  blob: Blob,
  contentType: string
) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: blob,
  });
  if (!response.ok) throw new Error("Upload failed");
  const json = (await response.json()) as { storageId: Id<"_storage"> };
  return json.storageId;
}

export function AskEditor({
  mode,
  initial,
  submitLabel,
  onSubmit,
}: {
  mode: "question" | "answer";
  initial?: AskDraft | null;
  submitLabel: string;
  onSubmit: (payload: AskPayload) => Promise<void>;
}) {
  const generateUploadUrl = useMutation(api.evidenceFiles.generateUploadUrl);
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [topic, setTopic] = React.useState<CaseCategory | "">(
    initial?.topic ?? ""
  );
  const [sourceUrl, setSourceUrl] = React.useState(initial?.sourceUrl ?? "");
  const [showLink, setShowLink] = React.useState(Boolean(initial?.sourceUrl));
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [keptImageId, setKeptImageId] = React.useState<Id<"_storage"> | null>(
    initial?.imageStorageId ?? null
  );
  const [keptImageUrl, setKeptImageUrl] = React.useState<string | null>(
    initial?.imageUrl ?? null
  );
  const [voice, setVoice] = React.useState<VoiceDraft | null>(null);
  const [keptVoiceId, setKeptVoiceId] = React.useState<Id<"_storage"> | null>(
    initial?.voiceStorageId ?? null
  );
  const [keptVoiceUrl, setKeptVoiceUrl] = React.useState<string | null>(
    initial?.voiceUrl ?? null
  );
  const [keptVoiceMs, setKeptVoiceMs] = React.useState<number | null>(
    initial?.voiceDurationMs ?? null
  );
  const [stickerId, setStickerId] = React.useState<BarkStickerId | null>(
    initial?.stickerId ?? null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!imageFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const imagePreview = objectUrl ?? keptImageUrl;

  const insertEmoji = (emoji: string) => {
    setBody((current) => `${current}${emoji}`.slice(0, 2000));
  };

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      let imageStorageId = keptImageId;
      if (imageFile) {
        if (imageFile.size > MAX_IMAGE_BYTES) {
          throw new Error("Images must be 8 MB or smaller");
        }
        const uploadUrl = await generateUploadUrl();
        imageStorageId = await uploadBlob(
          uploadUrl,
          imageFile,
          imageFile.type || "image/jpeg"
        );
      }
      let voiceStorageId = keptVoiceId;
      let voiceDurationMs = keptVoiceMs;
      if (voice) {
        const uploadUrl = await generateUploadUrl();
        voiceStorageId = await uploadBlob(
          uploadUrl,
          voice.blob,
          voice.contentType || "audio/webm"
        );
        voiceDurationMs = voice.durationMs;
      }
      await onSubmit({
        body,
        topic: topic || null,
        sourceUrl: sourceUrl.trim() || null,
        imageStorageId,
        voiceStorageId,
        voiceDurationMs,
        stickerId: mode === "answer" ? stickerId : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  };

  const hasMedia = Boolean(
    imagePreview || voice || keptVoiceUrl || (mode === "answer" && stickerId)
  );
  const canSubmit = pending
    ? false
    : body.trim().length >= 10 || (body.trim().length === 0 && hasMedia);

  return (
    <div className="space-y-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={
          mode === "question" ? "What do you want to ask?" : "Write an answer…"
        }
        className="min-h-28"
        maxLength={2000}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{body.trim().length}/2000</span>
      </div>
      {imagePreview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt=""
            className="max-h-48 w-full rounded-xl object-cover"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-2 top-2"
            onClick={() => {
              setImageFile(null);
              setKeptImageId(null);
              setKeptImageUrl(null);
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}
      {keptVoiceUrl && !voice ? (
        <div className="flex items-center gap-2">
          <audio src={keptVoiceUrl} controls className="h-8 max-w-full flex-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setKeptVoiceId(null);
              setKeptVoiceUrl(null);
              setKeptVoiceMs(null);
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <VoiceNoteRecorder draft={voice} onDraftChange={setVoice} />
      )}
      {showLink ? (
        <Input
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://source.example"
          type="url"
        />
      ) : null}
      <label className="block text-xs font-medium text-muted-foreground">
        Topic
        <select
          value={topic}
          onChange={(event) => setTopic(event.target.value as CaseCategory | "")}
          className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">No topic</option>
          {Object.entries(caseCategoryMeta).map(([slug, meta]) => (
            <option key={slug} value={slug}>
              {meta.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2">
              <Smile className="size-4" aria-hidden />
              <span className="sr-only">Insert emoji</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="flex gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-md px-1.5 py-1 text-lg hover:bg-muted"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden />
          <span className="sr-only">Add image</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setImageFile(file);
            if (file) {
              setKeptImageId(null);
              setKeptImageUrl(null);
            }
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setShowLink((value) => !value)}
        >
          <Link2 className="size-4" aria-hidden />
          <span className="sr-only">Add source link</span>
        </Button>
        {mode === "answer" ? (
          <StickerPicker value={stickerId} onPick={setStickerId} />
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={submit} disabled={!canSubmit}>
        {pending ? "Posting…" : submitLabel}
      </Button>
    </div>
  );
}
