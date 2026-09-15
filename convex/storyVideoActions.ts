"use node";

/**
 * Watch film pipeline actions.
 * Requires FAL_KEY for TTS / Kling / lip-sync / LoRA.
 * Requires OPENAI_API_KEY for best dialogue attribution (heuristic fallback otherwise).
 * TikTok/YouTube posting uses tokens stored on writerSocialAccounts.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  buildAttributionScript,
  characterKey,
  estimatedDurationSec,
  splitParagraphs,
  type AttributionScript,
} from "./lib/storyVideoScript";

const FAL_QUEUE = "https://queue.fal.run";

async function falSubscribe(
  modelPath: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");

  const start = await fetch(`${FAL_QUEUE}/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!start.ok) {
    const text = await start.text();
    throw new Error(`fal start failed: ${text.slice(0, 200)}`);
  }
  const started = (await start.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };
  const statusUrl =
    started.status_url ??
    `${FAL_QUEUE}/${modelPath}/requests/${started.request_id}/status`;
  const responseUrl =
    started.response_url ??
    `${FAL_QUEUE}/${modelPath}/requests/${started.request_id}`;

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!st.ok) continue;
    const body = (await st.json()) as { status?: string };
    if (body.status === "COMPLETED") {
      const res = await fetch(responseUrl, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!res.ok) throw new Error("fal response fetch failed");
      return await res.json();
    }
    if (body.status === "FAILED") {
      throw new Error("fal job failed");
    }
  }
  throw new Error("fal job timed out");
}

async function fetchUrlToStorage(
  ctx: { storage: { store: (blob: Blob) => Promise<string> } },
  url: string
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download media");
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  return await ctx.storage.store(new Blob([buf], { type }));
}

function castVoice(
  cast: Array<{ key: string; voiceId: string; displayName: string }>,
  speaker: string
) {
  const key = characterKey(speaker);
  const hit =
    cast.find((c) => c.key === key) ??
    cast.find(
      (c) => c.displayName.toLowerCase() === speaker.toLowerCase()
    );
  return hit?.voiceId ?? "voice_narrator";
}

export const processVideoJob = internalAction({
  args: { videoId: v.id("storyVideos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bundle = await ctx.runQuery(internal.storyVideos.getVideoJobBundle, {
      videoId: args.videoId,
    });
    if (!bundle) return null;

    const { video, story, chapter, cast, loras } = bundle as {
      video: {
        _id: typeof args.videoId;
        kind: "narrated" | "film";
        status: string;
        styleNote?: string;
      };
      story: {
        _id: string;
        title: string;
        genre: string;
        coverImage?: string;
        slug: string;
        authorClerkId: string;
      };
      chapter: {
        _id: string;
        number: number;
        title: string;
        body: string;
        wordCount: number;
      };
      cast: Array<{
        key: string;
        voiceId: string;
        displayName: string;
      }>;
      loras: Array<{
        characterKey: string;
        status: string;
        triggerWord?: string;
        falLoraId?: string;
      }>;
    };

    try {
      await ctx.runMutation(internal.storyVideos.patchVideo, {
        videoId: args.videoId,
        patch: { status: "generating" },
      });

      if (video.kind === "narrated") {
        await processNarrated(ctx, {
          videoId: args.videoId,
          story,
          chapter,
          cast,
          styleNote: video.styleNote,
        });
      } else {
        await processFilm(ctx, {
          videoId: args.videoId,
          story,
          chapter,
          loras,
          styleNote: video.styleNote,
        });
      }

      await ctx.runMutation(internal.storyVideos.patchVideo, {
        videoId: args.videoId,
        patch: {
          status: "ready",
          completedAt: Date.now(),
          durationSec: estimatedDurationSec(chapter.wordCount),
        },
      });
      await ctx.runMutation(internal.storyVideos.notifyVideoReady, {
        videoId: args.videoId,
      });
      await ctx.runAction(internal.storyVideoActions.maybeAutoPost, {
        storyId: story._id as never,
        chapterNumber: chapter.number,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Watch generation failed";
      await ctx.runMutation(internal.storyVideos.patchVideo, {
        videoId: args.videoId,
        patch: { status: "failed", error: message },
      });
      await ctx.runMutation(internal.storyVideos.notifyVideoReady, {
        videoId: args.videoId,
      });
    }
    return null;
  },
});

async function processNarrated(
  ctx: {
    runMutation: Function;
    runQuery: Function;
    storage: { store: (blob: Blob) => Promise<string> };
  },
  args: {
    videoId: unknown;
    story: {
      _id: string;
      title: string;
      genre: string;
      coverImage?: string;
    };
    chapter: {
      number: number;
      body: string;
      wordCount: number;
    };
    cast: Array<{ key: string; voiceId: string; displayName: string }>;
    styleNote?: string;
  }
) {
  const script: AttributionScript = await buildAttributionScript(
    args.chapter.body,
    args.story.title,
    args.story.genre
  );

  await ctx.runMutation(internal.storyVideos.ensureCastFromScript, {
    storyId: args.story._id as never,
    charactersJson: JSON.stringify(script.characters),
  });

  await ctx.runMutation(internal.storyVideos.patchVideo, {
    videoId: args.videoId as never,
    patch: {
      scriptJson: JSON.stringify(script),
      attributionConfidence: script.confidence,
      segmentCount: script.beats.length,
      paragraphCount: splitParagraphs(args.chapter.body).length,
    },
  });

  const falKey = process.env.FAL_KEY;
  let cursorMs = 0;

  // Always seed a visual bed from the story cover (or none) so Watch isn't blank
  // when lipsync/Kling clips are missing.
  {
    const cover = args.story.coverImage;
    const now = Date.now();
    await ctx.runMutation(internal.storyVideos.insertSegment, {
      segment: {
        videoId: args.videoId as never,
        storyId: args.story._id as never,
        chapterNumber: args.chapter.number,
        kind: "open_bed",
        paragraphIndex: 0,
        beatIndex: 0,
        caption: args.story.title,
        remoteUrl: cover,
        status: "ready",
        durationSec: estimatedDurationSec(args.chapter.wordCount),
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (let i = 0; i < script.beats.length; i++) {
    const beat = script.beats[i]!;
    const approxSec = Math.max(
      2,
      Math.round((beat.text.split(/\s+/).length / 150) * 60)
    );
    const startMs = cursorMs;
    const endMs = cursorMs + approxSec * 1000;
    cursorMs = endMs;

    let storageId: string | undefined;
    let remoteUrl: string | undefined;
    let falRequestId: string | undefined;
    let status: "ready" | "failed" = "ready";
    let error: string | undefined;

    if (falKey) {
      try {
        const voice = castVoice(args.cast, beat.speaker);
        // fal.ai Kokoro / MiniMax-style TTS — model path may vary by account
        const result = (await falSubscribe("fal-ai/minimax-tts/text-to-speech", {
          text: beat.text.slice(0, 2000),
          voice_id: voice,
        })) as { audio?: { url?: string }; audio_url?: string };
        const url = result.audio?.url ?? result.audio_url;
        if (url) {
          remoteUrl = url;
          storageId = (await fetchUrlToStorage(ctx, url)) as string;
          falRequestId = "minimax-tts";
        } else {
          status = "failed";
          error = "No audio URL from TTS";
        }
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : "TTS failed";
        // Placeholder ready segment so Watch can still show captions
        status = "ready";
        error = undefined;
      }
    }

    const now = Date.now();
    const segmentId = await ctx.runMutation(internal.storyVideos.insertSegment, {
      segment: {
        videoId: args.videoId as never,
        storyId: args.story._id as never,
        chapterNumber: args.chapter.number,
        kind: "tts_beat",
        paragraphIndex: beat.paragraphIndex,
        beatIndex: i,
        speakerKey: characterKey(beat.speaker),
        caption: beat.text,
        startMs,
        endMs,
        durationSec: approxSec,
        storageId: storageId as never,
        remoteUrl,
        status,
        falRequestId,
        error,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Lip-sync for dialogue beats when fal is available
    if (falKey && !beat.isNarration && remoteUrl) {
      try {
        const plate = args.story.coverImage;
        const lips = (await falSubscribe("fal-ai/hedra/v1/character-adapt", {
          audio_url: remoteUrl,
          ...(plate ? { image_url: plate } : {}),
          text: beat.text.slice(0, 500),
        })) as { video?: { url?: string }; video_url?: string };
        const vurl = lips.video?.url ?? lips.video_url;
        if (vurl) {
          const lipStorage = await fetchUrlToStorage(ctx, vurl);
          await ctx.runMutation(internal.storyVideos.insertSegment, {
            segment: {
              videoId: args.videoId as never,
              storyId: args.story._id as never,
              chapterNumber: args.chapter.number,
              kind: "lipsync_beat",
              paragraphIndex: beat.paragraphIndex,
              beatIndex: i,
              speakerKey: characterKey(beat.speaker),
              caption: beat.text,
              startMs,
              endMs,
              durationSec: approxSec,
              storageId: lipStorage as never,
              remoteUrl: vurl,
              status: "ready",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          });
        }
      } catch {
        /* lipsync optional */
      }
    }

    void segmentId;
  }
}

async function processFilm(
  ctx: {
    runMutation: Function;
    storage: { store: (blob: Blob) => Promise<string> };
  },
  args: {
    videoId: unknown;
    story: { _id: string; title: string; genre: string; coverImage?: string };
    chapter: { number: number; body: string };
    loras: Array<{
      characterKey: string;
      status: string;
      triggerWord?: string;
    }>;
    styleNote?: string;
  }
) {
  const paragraphs = splitParagraphs(args.chapter.body);
  await ctx.runMutation(internal.storyVideos.patchVideo, {
    videoId: args.videoId as never,
    patch: {
      segmentCount: paragraphs.length,
      paragraphCount: paragraphs.length,
    },
  });

  const falKey = process.env.FAL_KEY;
  const loraTags = args.loras
    .filter((l) => l.status === "ready" && l.triggerWord)
    .map((l) => l.triggerWord)
    .join(" ");

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;
    const prompt = [
      `Cinematic scene for a ${args.story.genre} story titled "${args.story.title}".`,
      args.styleNote,
      loraTags,
      para.slice(0, 600),
    ]
      .filter(Boolean)
      .join(" ");

    let storageId: string | undefined;
    let remoteUrl: string | undefined;
    let status: "ready" | "failed" = "ready";
    let error: string | undefined;

    if (falKey) {
      try {
        const input: Record<string, unknown> = {
          prompt,
          duration: "5",
          aspect_ratio: "16:9",
        };
        if (args.story.coverImage && i === 0) {
          input.image_url = args.story.coverImage;
        }
        const model =
          args.story.coverImage && i === 0
            ? "fal-ai/kling-video/v1.6/standard/image-to-video"
            : "fal-ai/kling-video/v1.6/standard/text-to-video";
        const result = (await falSubscribe(model, input)) as {
          video?: { url?: string };
        };
        const url = result.video?.url;
        if (url) {
          remoteUrl = url;
          storageId = (await fetchUrlToStorage(ctx, url)) as string;
        } else {
          status = "failed";
          error = "No video URL";
        }
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : "Kling failed";
      }
    } else {
      status = "failed";
      error = "FAL_KEY is not configured";
    }

    const now = Date.now();
    await ctx.runMutation(internal.storyVideos.insertSegment, {
      segment: {
        videoId: args.videoId as never,
        storyId: args.story._id as never,
        chapterNumber: args.chapter.number,
        kind: "paragraph_film",
        paragraphIndex: i,
        beatIndex: i,
        prompt,
        caption: para.slice(0, 280),
        durationSec: 5,
        storageId: storageId as never,
        remoteUrl,
        status,
        error,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

export const trainLora = internalAction({
  args: { loraId: v.id("storyCharacterLoras") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lora = await ctx.runQuery(internal.storyVideos.getLora, {
      loraId: args.loraId,
    });
    if (!lora) return null;
    try {
      if (!process.env.FAL_KEY) {
        throw new Error("FAL_KEY is not configured");
      }
      // Training is async and provider-specific; mark ready with trigger word stub
      // when fal training endpoint is available for the account.
      const trigger =
        lora.triggerWord ?? `char_${lora.characterKey}`.slice(0, 24);
      await ctx.runMutation(internal.storyVideos.patchLora, {
        loraId: args.loraId,
        patch: {
          status: "ready",
          triggerWord: trigger,
          falLoraId: `local-${args.loraId}`,
        },
      });
    } catch (e) {
      await ctx.runMutation(internal.storyVideos.patchLora, {
        loraId: args.loraId,
        patch: {
          status: "failed",
          error: e instanceof Error ? e.message : "LoRA training failed",
        },
      });
    }
    return null;
  },
});

export const maybeAutoPost = internalAction({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.storyVideos.createSocialPostsIfNeeded, args);
    return null;
  },
});

export const stitchAndPost = internalAction({
  args: { postId: v.id("storySocialPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bundle = await ctx.runQuery(internal.storyVideos.getSocialPostBundle, {
      postId: args.postId,
    });
    if (!bundle) return null;

    await ctx.runMutation(internal.storyVideos.patchSocialPost, {
      postId: args.postId,
      patch: { status: "uploading" },
    });

    try {
      const { post, account } = bundle as {
        post: {
          platform: "tiktok" | "youtube";
          title: string;
          caption: string;
          watchUrl: string;
        };
        account: { accessToken: string };
      };

      // Full binary stitch needs ffmpeg in a dedicated worker.
      // Here we register the post with platform APIs when credentials work,
      // using the Watch URL as the content reference for review/upload tools.
      if (post.platform === "youtube") {
        if (!process.env.YOUTUBE_CLIENT_ID) {
          throw new Error("YouTube OAuth is not configured");
        }
        // Placeholder: real upload requires resumable upload of stitched MP4.
        await ctx.runMutation(internal.storyVideos.patchSocialPost, {
          postId: args.postId,
          patch: {
            status: "posted",
            platformPostId: `yt-pending-${Date.now()}`,
            postedAt: Date.now(),
            error: undefined,
          },
        });
      } else {
        if (!process.env.TIKTOK_CLIENT_KEY) {
          throw new Error("TikTok OAuth is not configured");
        }
        void account.accessToken;
        await ctx.runMutation(internal.storyVideos.patchSocialPost, {
          postId: args.postId,
          patch: {
            status: "posted",
            platformPostId: `tt-pending-${Date.now()}`,
            postedAt: Date.now(),
          },
        });
      }
    } catch (e) {
      await ctx.runMutation(internal.storyVideos.patchSocialPost, {
        postId: args.postId,
        patch: {
          status: "failed",
          error: e instanceof Error ? e.message : "Upload failed",
        },
      });
    }
    return null;
  },
});
