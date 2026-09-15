import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import { notify } from "./lib/notify";
import {
  attributeHeuristically,
  characterKey,
  estimatedDurationSec,
  MAX_FILM_PARAGRAPHS,
  splitParagraphs,
  voiceIdForCharacter,
  VOICE_CATALOG,
} from "./lib/storyVideoScript";
import {
  storyVideoDocFields,
  storyVideoKind,
  storyVideoSegmentDocFields,
  storyCharacterCastDocFields,
  storyCharacterLoraDocFields,
  writerSocialPlatform,
  storySocialPostDocFields,
} from "./lib/validators";

const storyVideoDoc = v.object({
  ...storyVideoDocFields,
  _id: v.id("storyVideos"),
  _creationTime: v.number(),
});

const castDoc = v.object({
  ...storyCharacterCastDocFields,
  _id: v.id("storyCharacterCast"),
  _creationTime: v.number(),
});

const loraDoc = v.object({
  ...storyCharacterLoraDocFields,
  _id: v.id("storyCharacterLoras"),
  _creationTime: v.number(),
});

const socialPostDoc = v.object({
  ...storySocialPostDocFields,
  _id: v.id("storySocialPosts"),
  _creationTime: v.number(),
});

const segmentPublic = v.object({
  ...storyVideoSegmentDocFields,
  _id: v.id("storyVideoSegments"),
  _creationTime: v.number(),
  url: v.union(v.string(), v.null()),
});

async function requireApprovedWriter(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const clerkId = clerkUserId(identity);
  const rows = await ctx.db
    .query("writers")
    .withIndex("by_applicant", (q) => q.eq("applicantClerkId", clerkId))
    .take(20);
  const writer = rows.find((row) => row.status === "approved");
  if (!writer) throw new Error("Writer access is not approved");
  return { identity, clerkId, writer };
}

async function requireStoryOwner(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"stories">
) {
  const { writer, clerkId } = await requireApprovedWriter(ctx);
  const story = await ctx.db.get(storyId);
  if (!story || story.writerId !== writer._id) {
    throw new Error("Story not found");
  }
  return { story, writer, clerkId };
}

async function findActiveJob(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"stories">,
  chapterNumber: number,
  kind: "narrated" | "film"
) {
  const rows = await ctx.db
    .query("storyVideos")
    .withIndex("by_story_chapter_kind", (q) =>
      q.eq("storyId", storyId).eq("chapterNumber", chapterNumber).eq("kind", kind)
    )
    .take(10);
  return (
    rows.find(
      (r) =>
        r.status === "queued" ||
        r.status === "generating" ||
        r.status === "ready"
    ) ?? null
  );
}

async function enqueueKind(
  ctx: MutationCtx,
  args: {
    story: Doc<"stories">;
    chapter: Doc<"storyChapters">;
    kind: "narrated" | "film";
    requestSource: "auto_publish" | "writer" | "reader";
    requestedByClerkId: string;
    styleNote?: string;
  }
) {
  const existing = await findActiveJob(
    ctx,
    args.story._id,
    args.chapter.number,
    args.kind
  );
  if (existing) return existing._id;

  if (args.kind === "film") {
    const paragraphs = splitParagraphs(args.chapter.body);
    if (paragraphs.length > MAX_FILM_PARAGRAPHS) {
      throw new Error(
        `Film is limited to ${MAX_FILM_PARAGRAPHS} paragraphs (this part has ${paragraphs.length})`
      );
    }
  }

  const now = Date.now();
  const videoId = await ctx.db.insert("storyVideos", {
    storyId: args.story._id,
    chapterId: args.chapter._id,
    chapterNumber: args.chapter.number,
    kind: args.kind,
    writerId: args.story.writerId,
    authorClerkId: args.story.authorClerkId,
    requestedByClerkId: args.requestedByClerkId,
    requestSource: args.requestSource,
    status: "queued",
    styleNote: args.styleNote,
    visibility:
      args.story.visibility === "public" ? "public" : "private",
    segmentCount: 0,
    paragraphCount:
      args.kind === "film"
        ? splitParagraphs(args.chapter.body).length
        : undefined,
    requestedDurationSec: estimatedDurationSec(args.chapter.wordCount),
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.storyVideoActions.processVideoJob, {
    videoId,
  });
  return videoId;
}

export const listVoiceCatalog = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), label: v.string() })),
  handler: async () => VOICE_CATALOG.map((v) => ({ id: v.id, label: v.label })),
});

export const listCast = query({
  args: { storyId: v.id("stories") },
  returns: v.array(castDoc),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    return await ctx.db
      .query("storyCharacterCast")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .take(100);
  },
});

export const upsertCast = mutation({
  args: {
    storyId: v.id("stories"),
    key: v.string(),
    displayName: v.string(),
    voiceId: v.string(),
    role: v.union(v.literal("narrator"), v.literal("character")),
    genderHint: v.optional(v.string()),
  },
  returns: v.id("storyCharacterCast"),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    const rows = await ctx.db
      .query("storyCharacterCast")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .take(100);
    const existing = rows.find((r) => r.key === args.key);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName.trim(),
        voiceId: args.voiceId,
        role: args.role,
        genderHint: args.genderHint,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("storyCharacterCast", {
      storyId: args.storyId,
      key: args.key,
      displayName: args.displayName.trim(),
      voiceId: args.voiceId,
      role: args.role,
      genderHint: args.genderHint,
      updatedAt: now,
    });
  },
});

export const autoSuggestCast = mutation({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
  },
  returns: v.array(castDoc),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    const chapter = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) =>
        q.eq("storyId", args.storyId).eq("number", args.chapterNumber)
      )
      .unique();
    if (!chapter || chapter.status !== "published") {
      throw new Error("Published chapter required");
    }
    // Lightweight local suggest (full LLM runs in the job)
    const script = attributeHeuristically(chapter.body);
    const now = Date.now();
    const existing = await ctx.db
      .query("storyCharacterCast")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .take(100);
    const byKey = new Map(existing.map((r) => [r.key, r]));

    for (const character of script.characters) {
      const key = characterKey(character.name);
      const isNarrator = character.name.toLowerCase() === "narrator";
      if (byKey.has(key)) continue;
      const id = await ctx.db.insert("storyCharacterCast", {
        storyId: args.storyId,
        key,
        displayName: character.name,
        voiceId: voiceIdForCharacter(character.name, isNarrator),
        role: isNarrator ? "narrator" : "character",
        genderHint: character.genderHint,
        updatedAt: now,
      });
      const row = await ctx.db.get(id);
      if (row) byKey.set(key, row);
    }
    return [...byKey.values()];
  },
});

export const listMineForStory = query({
  args: { storyId: v.id("stories") },
  returns: v.array(storyVideoDoc),
  handler: async (ctx, args) => {
    const { story } = await requireStoryOwner(ctx, args.storyId);
    const rows = await ctx.db
      .query("storyVideos")
      .withIndex("by_writer_createdAt", (q) => q.eq("writerId", story.writerId))
      .order("desc")
      .take(100);
    return rows.filter((r) => r.storyId === args.storyId);
  },
});

export const getGenerationStatus = query({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
    kind: v.optional(storyVideoKind),
  },
  returns: v.union(
    v.object({
      video: storyVideoDoc,
      segmentsReady: v.number(),
      segmentsTotal: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const kind = args.kind ?? "narrated";
    const video = await findActiveJob(
      ctx,
      args.storyId,
      args.chapterNumber,
      kind
    );
    if (!video) return null;
    const segments = await ctx.db
      .query("storyVideoSegments")
      .withIndex("by_video_kind", (q) => q.eq("videoId", video._id))
      .take(200);
    const ready = segments.filter((s) => s.status === "ready").length;
    return {
      video,
      segmentsReady: ready,
      segmentsTotal: Math.max(video.segmentCount, segments.length),
    };
  },
});

export const requestPartVideo = mutation({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
    includeFilm: v.optional(v.boolean()),
    styleNote: v.optional(v.string()),
  },
  returns: v.object({
    narratedVideoId: v.id("storyVideos"),
    filmVideoId: v.union(v.id("storyVideos"), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const story = await ctx.db.get(args.storyId);
    if (!story) throw new Error("Story not found");
    const chapter = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) =>
        q.eq("storyId", args.storyId).eq("number", args.chapterNumber)
      )
      .unique();
    if (!chapter || chapter.status !== "published") {
      throw new Error("Only published parts can be turned into Watch films");
    }

    const isOwner = story.authorClerkId === clerkId;
    if (!isOwner) {
      if (story.visibility !== "public") {
        throw new Error("Story is not public");
      }
    }

    const requestSource = isOwner ? ("writer" as const) : ("reader" as const);
    const narratedVideoId = await enqueueKind(ctx, {
      story,
      chapter,
      kind: "narrated",
      requestSource,
      requestedByClerkId: clerkId,
      styleNote: args.styleNote,
    });

    let filmVideoId: Id<"storyVideos"> | null = null;
    const wantFilm = args.includeFilm === true;
    if (wantFilm) {
      if (!isOwner && story.allowReaderFilmRequests !== true) {
        throw new Error("Writer has not allowed reader film requests");
      }
      if (isOwner || story.allowReaderFilmRequests === true) {
        filmVideoId = await enqueueKind(ctx, {
          story,
          chapter,
          kind: "film",
          requestSource,
          requestedByClerkId: clerkId,
          styleNote: args.styleNote,
        });
      }
    }

    return { narratedVideoId, filmVideoId };
  },
});

export const setVideoVisibility = mutation({
  args: {
    videoId: v.id("storyVideos"),
    visibility: v.union(v.literal("private"), v.literal("public")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");
    await requireStoryOwner(ctx, video.storyId);
    if (video.status !== "ready") {
      throw new Error("Only ready videos can change visibility");
    }
    await ctx.db.patch(video._id, {
      visibility: args.visibility,
      updatedAt: Date.now(),
    });
    if (args.visibility === "public") {
      await ctx.scheduler.runAfter(
        0,
        internal.storyVideoActions.maybeAutoPost,
        { storyId: video.storyId, chapterNumber: video.chapterNumber }
      );
    }
    return null;
  },
});

export const setFilmSettings = mutation({
  args: {
    storyId: v.id("stories"),
    autoGenerateVideos: v.optional(v.boolean()),
    autoGenerateFilm: v.optional(v.boolean()),
    allowReaderFilmRequests: v.optional(v.boolean()),
    autoPostTikTok: v.optional(v.boolean()),
    autoPostYouTube: v.optional(v.boolean()),
    autoPostAspect: v.optional(v.union(v.literal("9:16"), v.literal("16:9"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    const { storyId, ...rest } = args;
    await ctx.db.patch(storyId, { ...rest, updatedAt: Date.now() });
    return null;
  },
});

export const deleteVideo = mutation({
  args: { videoId: v.id("storyVideos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found");
    await requireStoryOwner(ctx, video.storyId);
    const segments = await ctx.db
      .query("storyVideoSegments")
      .withIndex("by_video_kind", (q) => q.eq("videoId", video._id))
      .take(200);
    for (const seg of segments) {
      if (seg.storageId) {
        try {
          await ctx.storage.delete(seg.storageId);
        } catch {
          /* ignore */
        }
      }
      await ctx.db.delete(seg._id);
    }
    await ctx.db.delete(video._id);
    return null;
  },
});

export const getPublicPlaylist = query({
  args: { storyId: v.id("stories") },
  returns: v.array(
    v.object({
      chapterNumber: v.number(),
      chapterTitle: v.string(),
      narratedVideoId: v.union(v.id("storyVideos"), v.null()),
      filmVideoId: v.union(v.id("storyVideos"), v.null()),
      durationSec: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story || story.visibility !== "public") return [];

    const chapters = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) => q.eq("storyId", args.storyId))
      .take(100);
    const published = chapters
      .filter((c) => c.status === "published")
      .sort((a, b) => a.number - b.number);

    const out: Array<{
      chapterNumber: number;
      chapterTitle: string;
      narratedVideoId: Id<"storyVideos"> | null;
      filmVideoId: Id<"storyVideos"> | null;
      durationSec?: number;
    }> = [];

    for (const ch of published) {
      const narrated = await findActiveJob(ctx, args.storyId, ch.number, "narrated");
      const film = await findActiveJob(ctx, args.storyId, ch.number, "film");
      const n =
        narrated?.status === "ready" && narrated.visibility === "public"
          ? narrated
          : null;
      const f =
        film?.status === "ready" && film.visibility === "public" ? film : null;
      if (!n && !f) continue;
      out.push({
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        narratedVideoId: n?._id ?? null,
        filmVideoId: f?._id ?? null,
        durationSec: n?.durationSec ?? f?.durationSec,
      });
    }
    return out;
  },
});

export const getPublicForChapter = query({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
  },
  returns: v.union(
    v.object({
      chapterTitle: v.string(),
      coverImage: v.union(v.string(), v.null()),
      scriptJson: v.union(v.string(), v.null()),
      audioSegments: v.array(segmentPublic),
      filmSegments: v.array(segmentPublic),
      lipsyncSegments: v.array(segmentPublic),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story || story.visibility !== "public") return null;
    const chapter = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) =>
        q.eq("storyId", args.storyId).eq("number", args.chapterNumber)
      )
      .unique();
    if (!chapter || chapter.status !== "published") return null;

    const narrated = await findActiveJob(
      ctx,
      args.storyId,
      args.chapterNumber,
      "narrated"
    );
    const film = await findActiveJob(
      ctx,
      args.storyId,
      args.chapterNumber,
      "film"
    );
    const nOk =
      narrated?.status === "ready" && narrated.visibility === "public"
        ? narrated
        : null;
    const fOk =
      film?.status === "ready" && film.visibility === "public" ? film : null;
    if (!nOk && !fOk) return null;

    async function withUrls(videoId: Id<"storyVideos"> | undefined) {
      if (!videoId) return [] as Array<Doc<"storyVideoSegments"> & { url: string | null }>;
      const segs = await ctx.db
        .query("storyVideoSegments")
        .withIndex("by_video_kind", (q) => q.eq("videoId", videoId))
        .take(200);
      return await Promise.all(
        segs
          .filter((s) => s.status === "ready")
          .map(async (s) => ({
            ...s,
            url: s.storageId
              ? await ctx.storage.getUrl(s.storageId)
              : s.remoteUrl ?? null,
          }))
      );
    }

    const narratedSegs = nOk ? await withUrls(nOk._id) : [];
    const filmSegs = fOk ? await withUrls(fOk._id) : [];

    let coverImage: string | null = story.coverImage ?? null;
    if (story.coverMode === "storage" && story.coverStorageId) {
      coverImage = (await ctx.storage.getUrl(story.coverStorageId)) ?? coverImage;
    }

    return {
      chapterTitle: chapter.title,
      coverImage,
      scriptJson: nOk?.scriptJson ?? null,
      audioSegments: narratedSegs.filter((s) => s.kind === "tts_beat"),
      filmSegments: [
        ...filmSegs.filter((s) => s.kind === "paragraph_film"),
        ...narratedSegs.filter((s) => s.kind === "open_bed"),
      ],
      lipsyncSegments: narratedSegs.filter((s) => s.kind === "lipsync_beat"),
    };
  },
});

export const listLoras = query({
  args: { storyId: v.id("stories") },
  returns: v.array(loraDoc),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    return await ctx.db
      .query("storyCharacterLoras")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .take(50);
  },
});

export const generateLoraUploadUrls = mutation({
  args: {
    storyId: v.id("stories"),
    count: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    const n = Math.min(20, Math.max(1, Math.floor(args.count)));
    const urls: string[] = [];
    for (let i = 0; i < n; i++) {
      urls.push(await ctx.storage.generateUploadUrl());
    }
    return urls;
  },
});

export const trainCharacterLora = mutation({
  args: {
    storyId: v.id("stories"),
    characterKey: v.string(),
    refStorageIds: v.array(v.id("_storage")),
    triggerWord: v.optional(v.string()),
  },
  returns: v.id("storyCharacterLoras"),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    if (args.refStorageIds.length < 5) {
      throw new Error("Upload at least 5 reference images");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("storyCharacterLoras")
      .withIndex("by_story_character", (q) =>
        q.eq("storyId", args.storyId).eq("characterKey", args.characterKey)
      )
      .unique();
    let loraId: Id<"storyCharacterLoras">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "training",
        refStorageIds: args.refStorageIds,
        triggerWord: args.triggerWord,
        error: undefined,
        updatedAt: now,
      });
      loraId = existing._id;
    } else {
      loraId = await ctx.db.insert("storyCharacterLoras", {
        storyId: args.storyId,
        characterKey: args.characterKey,
        status: "training",
        refStorageIds: args.refStorageIds,
        triggerWord: args.triggerWord,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.scheduler.runAfter(0, internal.storyVideoActions.trainLora, {
      loraId,
    });
    return loraId;
  },
});

export const listSocialAccounts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("writerSocialAccounts"),
      platform: writerSocialPlatform,
      platformHandle: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { writer } = await requireApprovedWriter(ctx);
    const rows = await ctx.db
      .query("writerSocialAccounts")
      .withIndex("by_writer_platform", (q) => q.eq("writerId", writer._id))
      .take(10);
    return rows.map((r) => ({
      _id: r._id,
      platform: r.platform,
      platformHandle: r.platformHandle,
      updatedAt: r.updatedAt,
    }));
  },
});

export const disconnectSocial = mutation({
  args: { platform: writerSocialPlatform },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const row = await ctx.db
      .query("writerSocialAccounts")
      .withIndex("by_writer_platform", (q) =>
        q.eq("writerId", writer._id).eq("platform", args.platform)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const saveSocialAccount = mutation({
  args: {
    platform: writerSocialPlatform,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    platformUserId: v.optional(v.string()),
    platformHandle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { writer, clerkId } = await requireApprovedWriter(ctx);
    const existing = await ctx.db
      .query("writerSocialAccounts")
      .withIndex("by_writer_platform", (q) =>
        q.eq("writerId", writer._id).eq("platform", args.platform)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        scopes: args.scopes,
        expiresAt: args.expiresAt,
        platformUserId: args.platformUserId,
        platformHandle: args.platformHandle,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("writerSocialAccounts", {
        writerId: writer._id,
        authorClerkId: clerkId,
        platform: args.platform,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        scopes: args.scopes,
        expiresAt: args.expiresAt,
        platformUserId: args.platformUserId,
        platformHandle: args.platformHandle,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const listSocialPosts = query({
  args: { storyId: v.id("stories") },
  returns: v.array(socialPostDoc),
  handler: async (ctx, args) => {
    await requireStoryOwner(ctx, args.storyId);
    const story = await ctx.db.get(args.storyId);
    if (!story) return [];
    return await ctx.db
      .query("storySocialPosts")
      .withIndex("by_writer_createdAt", (q) => q.eq("writerId", story.writerId))
      .order("desc")
      .take(50)
      .then((rows) => rows.filter((r) => r.storyId === args.storyId));
  },
});

export const retrySocialPost = mutation({
  args: { postId: v.id("storySocialPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await requireStoryOwner(ctx, post.storyId);
    await ctx.db.patch(post._id, {
      status: "queued",
      error: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.storyVideoActions.stitchAndPost, {
      postId: post._id,
    });
    return null;
  },
});

export const getSocialConnectUrl = query({
  args: { platform: writerSocialPlatform },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireApprovedWriter(ctx);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
    if (!site) return null;
    if (args.platform === "youtube") {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      if (!clientId) return null;
      const redirect = `${site.replace(/\/$/, "")}/api/social/youtube/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.upload",
        access_type: "offline",
        prompt: "consent",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) return null;
    const redirect = `${site.replace(/\/$/, "")}/api/social/tiktok/callback`;
    const params = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirect,
      response_type: "code",
      scope: "video.publish",
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },
});

// --- Internal ---

export const enqueueOnPublish = internalMutation({
  args: {
    storyId: v.id("stories"),
    chapterId: v.id("storyChapters"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    const chapter = await ctx.db.get(args.chapterId);
    if (!story || !chapter || chapter.status !== "published") return null;

    if (story.autoGenerateVideos !== false) {
      await enqueueKind(ctx, {
        story,
        chapter,
        kind: "narrated",
        requestSource: "auto_publish",
        requestedByClerkId: story.authorClerkId,
      });
    }
    if (story.autoGenerateFilm === true) {
      try {
        await enqueueKind(ctx, {
          story,
          chapter,
          kind: "film",
          requestSource: "auto_publish",
          requestedByClerkId: story.authorClerkId,
        });
      } catch {
        /* paragraph cap etc. */
      }
    }
    return null;
  },
});

export const getVideoJobBundle = internalQuery({
  args: { videoId: v.id("storyVideos") },
  returns: v.union(
    v.object({
      video: storyVideoDoc,
      story: v.any(),
      chapter: v.any(),
      cast: v.array(castDoc),
      loras: v.array(loraDoc),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) return null;
    const story = await ctx.db.get(video.storyId);
    const chapter = await ctx.db.get(video.chapterId);
    if (!story || !chapter) return null;
    const cast = await ctx.db
      .query("storyCharacterCast")
      .withIndex("by_story", (q) => q.eq("storyId", story._id))
      .take(100);
    const loras = await ctx.db
      .query("storyCharacterLoras")
      .withIndex("by_story", (q) => q.eq("storyId", story._id))
      .take(50);
    return { video, story, chapter, cast, loras };
  },
});

export const patchVideo = internalMutation({
  args: {
    videoId: v.id("storyVideos"),
    patch: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      ...args.patch,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const insertSegment = internalMutation({
  args: {
    segment: v.object(storyVideoSegmentDocFields),
  },
  returns: v.id("storyVideoSegments"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("storyVideoSegments", args.segment);
  },
});

export const patchSegment = internalMutation({
  args: {
    segmentId: v.id("storyVideoSegments"),
    patch: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.segmentId, {
      ...args.patch,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const ensureCastFromScript = internalMutation({
  args: {
    storyId: v.id("stories"),
    charactersJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const characters = JSON.parse(args.charactersJson) as Array<{
      name: string;
      genderHint?: string;
    }>;
    const existing = await ctx.db
      .query("storyCharacterCast")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .take(100);
    const byKey = new Set(existing.map((r) => r.key));
    const now = Date.now();
    for (const c of characters) {
      const key = characterKey(c.name);
      if (byKey.has(key)) continue;
      const isNarrator = c.name.toLowerCase() === "narrator";
      await ctx.db.insert("storyCharacterCast", {
        storyId: args.storyId,
        key,
        displayName: c.name,
        voiceId: voiceIdForCharacter(c.name, isNarrator),
        role: isNarrator ? "narrator" : "character",
        genderHint: c.genderHint,
        updatedAt: now,
      });
      byKey.add(key);
    }
    return null;
  },
});

export const storeBlob = internalMutation({
  args: {
    bytesBase64: v.string(),
    contentType: v.string(),
  },
  returns: v.id("_storage"),
  // Cannot store from mutation without blob — use action storage instead
  handler: async () => {
    throw new Error("Use action ctx.storage.store");
  },
});

export const notifyVideoReady = internalMutation({
  args: {
    videoId: v.id("storyVideos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) return null;
    const story = await ctx.db.get(video.storyId);
    if (!story) return null;
    await notify(ctx, {
      recipientClerkId: story.authorClerkId,
      category: "verification",
      title:
        video.status === "ready"
          ? "Watch film ready"
          : "Watch film failed",
      body:
        video.status === "ready"
          ? `Part ${video.chapterNumber} of “${story.title}” is ready to watch.`
          : `Part ${video.chapterNumber} failed: ${video.error ?? "unknown error"}`,
      href: `/stories/${story.slug}/watch?part=${video.chapterNumber}`,
    });
    if (video.requestedByClerkId && video.requestedByClerkId !== story.authorClerkId) {
      await notify(ctx, {
        recipientClerkId: video.requestedByClerkId,
        category: "verification",
        title:
          video.status === "ready"
            ? "Watch version ready"
            : "Watch generation failed",
        body: `“${story.title}” part ${video.chapterNumber}`,
        href: `/stories/${story.slug}/watch?part=${video.chapterNumber}`,
      });
    }
    return null;
  },
});

export const getLora = internalQuery({
  args: { loraId: v.id("storyCharacterLoras") },
  returns: v.union(loraDoc, v.null()),
  handler: async (ctx, args) => ctx.db.get(args.loraId),
});

export const patchLora = internalMutation({
  args: { loraId: v.id("storyCharacterLoras"), patch: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.loraId, { ...args.patch, updatedAt: Date.now() });
    return null;
  },
});

export const upsertSocialAccount = internalMutation({
  args: {
    writerId: v.id("writers"),
    authorClerkId: v.string(),
    platform: writerSocialPlatform,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    platformUserId: v.optional(v.string()),
    platformHandle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("writerSocialAccounts")
      .withIndex("by_writer_platform", (q) =>
        q.eq("writerId", args.writerId).eq("platform", args.platform)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("writerSocialAccounts", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const createSocialPostsIfNeeded = internalMutation({
  args: {
    storyId: v.id("stories"),
    chapterNumber: v.number(),
  },
  returns: v.array(v.id("storySocialPosts")),
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story || story.visibility !== "public") return [];
    const narrated = await findActiveJob(
      ctx,
      args.storyId,
      args.chapterNumber,
      "narrated"
    );
    if (!narrated || narrated.status !== "ready" || narrated.visibility !== "public") {
      return [];
    }

    const created: Id<"storySocialPosts">[] = [];
    const platforms: Array<"tiktok" | "youtube"> = [];
    if (story.autoPostTikTok) platforms.push("tiktok");
    if (story.autoPostYouTube) platforms.push("youtube");

    for (const platform of platforms) {
      const account = await ctx.db
        .query("writerSocialAccounts")
        .withIndex("by_writer_platform", (q) =>
          q.eq("writerId", story.writerId).eq("platform", platform)
        )
        .unique();
      if (!account) continue;

      const existing = await ctx.db
        .query("storySocialPosts")
        .withIndex("by_story_chapter_platform", (q) =>
          q
            .eq("storyId", story._id)
            .eq("chapterNumber", args.chapterNumber)
            .eq("platform", platform)
        )
        .take(5);
      if (existing.some((p) => p.status === "posted" || p.status === "queued" || p.status === "uploading")) {
        continue;
      }

      const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const now = Date.now();
      const postId = await ctx.db.insert("storySocialPosts", {
        storyId: story._id,
        chapterNumber: args.chapterNumber,
        videoId: narrated._id,
        writerId: story.writerId,
        platform,
        status: "queued",
        title: `${story.title} — Part ${args.chapterNumber}`,
        caption: story.blurb.slice(0, 200),
        watchUrl: `${site.replace(/\/$/, "")}/stories/${story.slug}/watch?part=${args.chapterNumber}`,
        createdAt: now,
        updatedAt: now,
      });
      created.push(postId);
      await ctx.scheduler.runAfter(0, internal.storyVideoActions.stitchAndPost, {
        postId,
      });
    }
    return created;
  },
});

export const getSocialPostBundle = internalQuery({
  args: { postId: v.id("storySocialPosts") },
  returns: v.union(
    v.object({
      post: socialPostDoc,
      account: v.any(),
      story: v.any(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    const story = await ctx.db.get(post.storyId);
    const account = await ctx.db
      .query("writerSocialAccounts")
      .withIndex("by_writer_platform", (q) =>
        q.eq("writerId", post.writerId).eq("platform", post.platform)
      )
      .unique();
    if (!story || !account) return null;
    return { post, account, story };
  },
});

export const patchSocialPost = internalMutation({
  args: { postId: v.id("storySocialPosts"), patch: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, { ...args.patch, updatedAt: Date.now() });
    return null;
  },
});

export const getWriterByClerk = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(v.id("writers"), v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("writers")
      .withIndex("by_applicant", (q) => q.eq("applicantClerkId", args.clerkId))
      .take(20);
    const writer = rows.find((r) => r.status === "approved");
    return writer?._id ?? null;
  },
});
