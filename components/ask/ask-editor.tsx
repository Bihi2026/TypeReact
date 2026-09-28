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
const UPLOAD_ERROR =
  "Could not upload the file. Check your connection and try again.";

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

async function uploadFile(
  generateUploadUrl: () => Promise<string>,
  blob: Blob,
  contentType: string
) {
  const postFresh = async () => {
    const uploadUrl = await generateUploadUrl();
    return uploadBlob(uploadUrl, blob, contentType);
  };
  try {
    return await postFresh();
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    try {
      return await postFresh();
    } catch (retryErr) {
      if (retryErr instanceof TypeError) throw new Error(UPLOAD_ERROR);
      throw retryErr;
    }
  }
}

function postImage(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  xhrRef: { current: XMLHttpRequest | null }
) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Upload failed"));
        return;
      }
      try {
        const json = JSON.parse(xhr.responseText) as {
          storageId?: Id<"_storage">;
        };
        if (!json.storageId) {
          reject(new Error("Upload failed"));
          return;
        }
        resolve(json.storageId);
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new TypeError("Failed to fetch"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.send(file);
  });
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
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [imageProgress, setImageProgress] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const imageXhr = React.useRef<XMLHttpRequest | null>(null);
  const imageGeneration = React.useRef(0);
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

  React.useEffect(() => {
    return () => {
      imageXhr.current?.abort();
    };
  }, []);

  const imagePreview = objectUrl ?? keptImageUrl;
  const imageWaiting = imageFile !== null && keptImageId === null;

  const insertEmoji = (emoji: string) => {
    setBody((current) => `${current}${emoji}`.slice(0, 2000));
  };

  const clearImage = () => {
    imageGeneration.current += 1;
    imageXhr.current?.abort();
    imageXhr.current = null;
    setImageFile(null);
    setKeptImageId(null);
    setKeptImageUrl(null);
    setImageProgress(null);
    setImageError(null);
  };

  const startImageUpload = (file: File) => {
    const generation = ++imageGeneration.current;
    imageXhr.current?.abort();
    imageXhr.current = null;
    setImageFile(file);
    setKeptImageId(null);
    setKeptImageUrl(null);
    setImageError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setImageProgress(null);
      setImageError("Images must be 8 MB or smaller");
      return;
    }
    setImageProgress(0);
    const report = (percent: number) => {
      if (imageGeneration.current === generation) setImageProgress(percent);
    };
    const post = async (uploadUrl: string) =>
      postImage(uploadUrl, file, report, imageXhr);
    void (async () => {
      try {
        let storageId: Id<"_storage">;
        try {
          const uploadUrl = await generateUploadUrl();
          if (imageGeneration.current !== generation) return;
          storageId = await post(uploadUrl);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!(err instanceof TypeError)) throw err;
          const uploadUrl = await generateUploadUrl();
          if (imageGeneration.current !== generation) return;
          storageId = await post(uploadUrl);
        }
        if (imageGeneration.current !== generation) return;
        setKeptImageId(storageId);
        setImageProgress(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (imageGeneration.current !== generation) return;
        setImageProgress(null);
        setImageError(
          err instanceof Error && err.message !== "Failed to fetch"
            ? err.message
            : UPLOAD_ERROR
        );
      }
    })();
  };

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      const imageStorageId = keptImageId;
      let voiceStorageId = keptVoiceId;
      let voiceDurationMs = keptVoiceMs;
      if (voice) {
        voiceStorageId = await uploadFile(
          generateUploadUrl,
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
  const canSubmit =
    pending || imageWaiting
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
          {imageProgress !== null ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/50 px-4 text-white">
              <span className="text-sm font-medium">{imageProgress}%</span>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/30"
                role="progressbar"
                aria-valuenow={imageProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Image upload progress"
              >
                <div
                  className="h-full bg-white"
                  style={{ width: `${imageProgress}%` }}
                />
              </div>
            </div>
          ) : null}
          {imageError ? (
            <p className="absolute inset-x-2 bottom-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
              {imageError}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-2 top-2"
            onClick={clearImage}
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
            if (file) startImageUpload(file);
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
      <Button type="button" onClick={submit} disabled={!canSubmit}>
        {pending ? "Posting…" : submitLabel}
      </Button>
    </div>
  );
}
