"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Clapperboard, Loader2, Play } from "lucide-react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type BeatCaption = {
  startMs?: number;
  endMs?: number;
  caption?: string;
  speakerKey?: string;
  url: string | null;
  paragraphIndex?: number;
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("video");
}

export function StoryWatchPlayer({
  storyId,
  storySlug,
  initialPart,
}: {
  storyId: Id<"stories">;
  storySlug: string;
  initialPart?: number;
}) {
  const { isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const playlist = useQuery(api.storyVideos.getPublicPlaylist, { storyId });
  const requestPart = useMutation(api.storyVideos.requestPartVideo);

  const search = useSearchParams();
  const partParam = Number(search.get("part") ?? initialPart ?? 0);
  const [part, setPart] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!playlist) return;
    if (playlist.length === 0) {
      setPart(null);
      return;
    }
    const preferred =
      playlist.find((p) => p.chapterNumber === partParam)?.chapterNumber ??
      playlist[0]!.chapterNumber;
    setPart(preferred);
  }, [playlist, partParam]);

  const chapterData = useQuery(
    api.storyVideos.getPublicForChapter,
    part !== null ? { storyId, chapterNumber: part } : "skip"
  );

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [caption, setCaption] = React.useState("");
  const [beatIndex, setBeatIndex] = React.useState(0);

  const audioBeats = chapterData?.audioSegments ?? [];
  const lipsync = chapterData?.lipsyncSegments ?? [];
  const film = chapterData?.filmSegments ?? [];
  const coverImage = chapterData?.coverImage ?? null;

  const currentVisualUrl = React.useMemo(() => {
    const lip = lipsync.find((s) => s.beatIndex === beatIndex);
    if (lip?.url) return lip.url;
    const para =
      audioBeats[beatIndex]?.paragraphIndex ??
      film.find((f) => f.kind === "paragraph_film")?.paragraphIndex;
    const clip = film.find(
      (f) => f.kind === "paragraph_film" && f.paragraphIndex === para
    );
    if (clip?.url) return clip.url;
    const bed = film.find((f) => f.kind === "open_bed" && f.url);
    if (bed?.url) return bed.url;
    return coverImage;
  }, [lipsync, film, beatIndex, audioBeats, coverImage]);

  const visualIsVideo = currentVisualUrl
    ? isVideoUrl(currentVisualUrl)
    : false;

  React.useEffect(() => {
    setBeatIndex(0);
    setCaption(audioBeats[0]?.caption ?? "");
  }, [part, chapterData]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const beat = audioBeats[beatIndex] as BeatCaption | undefined;
    if (!beat?.url) {
      // Caption-only mode when TTS media is missing
      setCaption(beat?.caption ?? "");
      const durationMs = Math.max(
        2500,
        (beat?.caption?.split(/\s+/).length ?? 8) * 350
      );
      const timer = window.setTimeout(() => {
        if (beatIndex + 1 < audioBeats.length) setBeatIndex((i) => i + 1);
      }, durationMs);
      return () => window.clearTimeout(timer);
    }
    audio.src = beat.url;
    void audio.play().catch(() => undefined);
  }, [beatIndex, audioBeats]);

  const onTimeUpdate = () => {
    const beat = audioBeats[beatIndex] as BeatCaption | undefined;
    if (beat?.caption) setCaption(beat.caption);
  };

  const onEnded = () => {
    if (beatIndex + 1 < audioBeats.length) {
      setBeatIndex((i) => i + 1);
      return;
    }
    if (!playlist || part === null) return;
    const idx = playlist.findIndex((p) => p.chapterNumber === part);
    if (idx >= 0 && idx + 1 < playlist.length) {
      setPart(playlist[idx + 1]!.chapterNumber);
    }
  };

  const generate = async (includeFilm: boolean) => {
    if (!isSignedIn) {
      toast.error("Sign in to generate a Watch version");
      return;
    }
    const target =
      part ??
      (playlist && playlist.length === 0 ? 1 : playlist?.[0]?.chapterNumber);
    if (!target) {
      toast.error("Pick a published part first");
      return;
    }
    setBusy(true);
    try {
      await requestPart({
        storyId,
        chapterNumber: target,
        includeFilm,
      });
      toast.success(
        includeFilm
          ? "Audio + film queued — this can take a while"
          : "Generation queued — this can take a while"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  if (playlist === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const idx = playlist.findIndex((p) => p.chapterNumber === part);
  const prev = idx > 0 ? playlist[idx - 1] : null;
  const next =
    idx >= 0 && idx + 1 < playlist.length ? playlist[idx + 1] : null;
  const missingMotion =
    chapterData !== undefined &&
    lipsync.every((s) => !s.url) &&
    film.every((s) => s.kind !== "paragraph_film" || !s.url);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Watch</h1>
          <p className="text-sm text-muted-foreground">
            {part !== null
              ? `Part ${part}${chapterData ? `: ${chapterData.chapterTitle}` : ""}`
              : "No Watch versions yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                part
                  ? `/stories/${storySlug}/chapters/${part}`
                  : `/stories/${storySlug}`
              }
            >
              <BookOpen className="size-4" />
              Read this part
            </Link>
          </Button>
          {playlist.length === 0 ? (
            isSignedIn ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void generate(false)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Generate Watch version
              </Button>
            ) : (
              <SignInButton mode="modal">
                <Button size="sm">Sign in to generate</Button>
              </SignInButton>
            )
          ) : null}
          {playlist.length > 0 && missingMotion && isSignedIn ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void generate(true)}
            >
              <Clapperboard className="size-4" />
              Add film visuals
            </Button>
          ) : null}
        </div>
      </div>

      {playlist.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {playlist.map((p) => (
            <Button
              key={p.chapterNumber}
              size="sm"
              variant={p.chapterNumber === part ? "default" : "outline"}
              onClick={() => setPart(p.chapterNumber)}
            >
              Part {p.chapterNumber}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-black">
        {chapterData === undefined ? (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : currentVisualUrl && visualIsVideo ? (
          <video
            key={currentVisualUrl}
            src={currentVisualUrl}
            className="aspect-video w-full object-cover"
            muted
            playsInline
            autoPlay
            loop
          />
        ) : currentVisualUrl ? (
          <div className="relative aspect-video w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentVisualUrl}
              alt=""
              className="size-full object-cover transition-transform duration-[18s] ease-in-out motion-safe:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
          </div>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 to-zinc-800 px-6 text-center">
            <Clapperboard className="size-8 text-zinc-500" aria-hidden />
            <p className="text-sm text-zinc-300">
              {chapterData?.chapterTitle ?? "Watch"}
            </p>
            <p className="max-w-sm text-xs text-zinc-500">
              No cover or film clip yet. Captions play below
              {isSignedIn ? " — use “Add film visuals” for motion." : "."}
            </p>
          </div>
        )}
      </div>

      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />

      {caption ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
          <Badge variant="secondary" className="mb-2">
            {audioBeats[beatIndex]?.speakerKey ?? "narrator"}
          </Badge>
          <p className="text-sm leading-relaxed">{caption}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {chapterData === undefined
            ? "Loading captions…"
            : audioBeats.length === 0
              ? "No narrated beats on this part yet."
              : null}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          disabled={!prev}
          onClick={() => prev && setPart(prev.chapterNumber)}
        >
          Previous part
        </Button>
        <Button
          variant="outline"
          disabled={!next}
          onClick={() => next && setPart(next.chapterNumber)}
        >
          Next part
        </Button>
      </div>

      {isAuthenticated && playlist.length > 0 && !chapterData ? (
        <p className="text-center text-sm text-muted-foreground">
          This part is still generating or private.
        </p>
      ) : null}
    </div>
  );
}
