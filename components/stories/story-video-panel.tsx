"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clapperboard,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function StoryVideoPanel({
  storyId,
  storySlug,
  chapters,
  settings,
}: {
  storyId: Id<"stories">;
  storySlug: string;
  chapters: Array<{ number: number; title: string; wordCount: number }>;
  settings: {
    autoGenerateVideos: boolean;
    autoGenerateFilm: boolean;
    allowReaderFilmRequests: boolean;
    autoPostTikTok: boolean;
    autoPostYouTube: boolean;
  };
}) {
  const { isAuthenticated } = useConvexAuth();
  const videos = useQuery(
    api.storyVideos.listMineForStory,
    isAuthenticated ? { storyId } : "skip"
  );
  const cast = useQuery(
    api.storyVideos.listCast,
    isAuthenticated ? { storyId } : "skip"
  );
  const loras = useQuery(
    api.storyVideos.listLoras,
    isAuthenticated ? { storyId } : "skip"
  );
  const social = useQuery(
    api.storyVideos.listSocialAccounts,
    isAuthenticated ? {} : "skip"
  );
  const posts = useQuery(
    api.storyVideos.listSocialPosts,
    isAuthenticated ? { storyId } : "skip"
  );
  const ytUrl = useQuery(
    api.storyVideos.getSocialConnectUrl,
    isAuthenticated ? { platform: "youtube" } : "skip"
  );
  const ttUrl = useQuery(
    api.storyVideos.getSocialConnectUrl,
    isAuthenticated ? { platform: "tiktok" } : "skip"
  );

  const requestPart = useMutation(api.storyVideos.requestPartVideo);
  const setSettings = useMutation(api.storyVideos.setFilmSettings);
  const setVisibility = useMutation(api.storyVideos.setVideoVisibility);
  const autoSuggest = useMutation(api.storyVideos.autoSuggestCast);
  const disconnect = useMutation(api.storyVideos.disconnectSocial);
  const retryPost = useMutation(api.storyVideos.retrySocialPost);
  const trainLora = useMutation(api.storyVideos.trainCharacterLora);
  const genUpload = useMutation(api.storyVideos.generateLoraUploadUrls);

  const [busy, setBusy] = React.useState<string | null>(null);
  const [styleNote, setStyleNote] = React.useState("");

  const byChapter = React.useMemo(() => {
    type VideoRow = NonNullable<typeof videos>[number];
    const map = new Map<
      number,
      { narrated?: VideoRow; film?: VideoRow }
    >();
    for (const v of videos ?? []) {
      const row = map.get(v.chapterNumber) ?? {};
      if (v.kind === "narrated") row.narrated = v;
      else row.film = v;
      map.set(v.chapterNumber, row);
    }
    return map;
  }, [videos]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clapperboard className="size-4 text-primary" aria-hidden />
            Watch films
          </CardTitle>
          <CardDescription>
            Multi-voice narration, lip-sync, and optional per-paragraph Kling
            film. Auto-generates on publish when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="style-note">Style note (optional)</Label>
            <Input
              id="style-note"
              value={styleNote}
              onChange={(e) => setStyleNote(e.target.value)}
              placeholder="Noir lighting, restrained camera…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["autoGenerateVideos", "Auto TTS on publish", settings.autoGenerateVideos],
                ["autoGenerateFilm", "Auto film on publish", settings.autoGenerateFilm],
                [
                  "allowReaderFilmRequests",
                  "Readers may request film",
                  settings.allowReaderFilmRequests,
                ],
                ["autoPostTikTok", "Auto-post TikTok", settings.autoPostTikTok],
                ["autoPostYouTube", "Auto-post YouTube", settings.autoPostYouTube],
              ] as const
            ).map(([key, label, checked]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>{label}</span>
                <Switch
                  checked={checked}
                  onCheckedChange={(next) => {
                    void run(
                      key,
                      () => setSettings({ storyId, [key]: next }),
                      "Settings saved"
                    );
                  }}
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Publish a part to generate Watch audio/film.
            </p>
          ) : (
            chapters.map((ch) => {
              const row = byChapter.get(ch.number);
              const estMin = Math.max(1, Math.round(ch.wordCount / 150));
              return (
                <div
                  key={ch.number}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      Part {ch.number}: {ch.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~{estMin} min narrated · {ch.wordCount} words
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row?.narrated ? (
                        <Badge variant="secondary">
                          Audio {row.narrated.status}
                        </Badge>
                      ) : null}
                      {row?.film ? (
                        <Badge variant="outline">Film {row.film.status}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy === `gen-${ch.number}`}
                      onClick={() =>
                        void run(
                          `gen-${ch.number}`,
                          () =>
                            requestPart({
                              storyId,
                              chapterNumber: ch.number,
                              includeFilm: false,
                              styleNote: styleNote || undefined,
                            }),
                          "Narration queued"
                        )
                      }
                    >
                      {busy === `gen-${ch.number}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Generate audio
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === `film-${ch.number}`}
                      onClick={() =>
                        void run(
                          `film-${ch.number}`,
                          () =>
                            requestPart({
                              storyId,
                              chapterNumber: ch.number,
                              includeFilm: true,
                              styleNote: styleNote || undefined,
                            }),
                          "Audio + film queued"
                        )
                      }
                    >
                      + Film
                    </Button>
                    {row?.narrated?.status === "ready" ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(
                              `vis-${row.narrated!._id}`,
                              () =>
                                setVisibility({
                                  videoId: row.narrated!._id,
                                  visibility:
                                    row.narrated!.visibility === "public"
                                      ? "private"
                                      : "public",
                                }),
                              "Visibility updated"
                            )
                          }
                        >
                          {row.narrated.visibility === "public"
                            ? "Unpublish"
                            : "Publish"}
                        </Button>
                        <Button size="sm" variant="link" asChild>
                          <Link
                            href={`/stories/${storySlug}/watch?part=${ch.number}`}
                          >
                            Preview
                          </Link>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cast (optional)</CardTitle>
          <CardDescription>
            Auto-attributed on generate. Suggest from a part if you want to
            review voices first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {chapters[0] ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "cast"}
              onClick={() =>
                void run(
                  "cast",
                  () =>
                    autoSuggest({
                      storyId,
                      chapterNumber: chapters[0]!.number,
                    }),
                  "Cast suggested"
                )
              }
            >
              Suggest cast from part {chapters[0].number}
            </Button>
          ) : null}
          <ul className="space-y-1 text-sm">
            {(cast ?? []).map((c) => (
              <li key={c._id} className="flex justify-between gap-2">
                <span>
                  {c.displayName}{" "}
                  <span className="text-muted-foreground">({c.role})</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {c.voiceId}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Character LoRAs</CardTitle>
          <CardDescription>
            Upload 5+ reference images, then train for consistent Kling faces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(cast ?? [])
            .filter((c) => c.role === "character")
            .map((c) => {
              const lora = (loras ?? []).find(
                (l) => l.characterKey === c.key
              );
              return (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{c.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lora ? `LoRA ${lora.status}` : "No LoRA yet"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === `lora-${c.key}`}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.multiple = true;
                      input.onchange = async () => {
                        const files = [...(input.files ?? [])];
                        if (files.length < 5) {
                          toast.error("Select at least 5 images");
                          return;
                        }
                        setBusy(`lora-${c.key}`);
                        try {
                          const urls = await genUpload({
                            storyId,
                            count: files.length,
                          });
                          const ids: Id<"_storage">[] = [];
                          for (let i = 0; i < files.length; i++) {
                            const res = await fetch(urls[i]!, {
                              method: "POST",
                              headers: {
                                "Content-Type":
                                  files[i]!.type || "application/octet-stream",
                              },
                              body: files[i],
                            });
                            if (!res.ok) throw new Error("Upload failed");
                            const json = (await res.json()) as {
                              storageId: Id<"_storage">;
                            };
                            ids.push(json.storageId);
                          }
                          await trainLora({
                            storyId,
                            characterKey: c.key,
                            refStorageIds: ids,
                            triggerWord: `char_${c.key}`.slice(0, 24),
                          });
                          toast.success("LoRA training queued");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "LoRA failed"
                          );
                        } finally {
                          setBusy(null);
                        }
                      };
                      input.click();
                    }}
                  >
                    {busy === `lora-${c.key}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Upload & train"
                    )}
                  </Button>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="size-4" aria-hidden />
            Social auto-post
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ytUrl ? (
              <Button size="sm" asChild>
                <a href={ytUrl}>Connect YouTube</a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                YouTube (set YOUTUBE_CLIENT_ID)
              </Button>
            )}
            {ttUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={ttUrl}>Connect TikTok</a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                TikTok (set TIKTOK_CLIENT_KEY)
              </Button>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {(social ?? []).map((a) => (
              <li
                key={a._id}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  {a.platform}
                  {a.platformHandle ? ` · ${a.platformHandle}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void run(
                      `disc-${a.platform}`,
                      () => disconnect({ platform: a.platform }),
                      "Disconnected"
                    )
                  }
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Recent posts
            </p>
            {(posts ?? []).slice(0, 8).map((p) => (
              <div
                key={p._id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  Part {p.chapterNumber} · {p.platform} · {p.status}
                </span>
                {p.status === "failed" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void run(
                        `retry-${p._id}`,
                        () => retryPost({ postId: p._id }),
                        "Retry queued"
                      )
                    }
                  >
                    <RefreshCw className="size-3.5" />
                    Retry
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
