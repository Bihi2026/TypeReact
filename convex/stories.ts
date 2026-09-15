import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import {
  storyChapterDocFields,
  storyDocFields,
  storyGenre,
  storyStatus,
} from "./lib/validators";

const storyDoc = v.object({
  ...storyDocFields,
  _id: v.id("stories"),
  _creationTime: v.number(),
});

const storyChapterDoc = v.object({
  ...storyChapterDocFields,
  _id: v.id("storyChapters"),
  _creationTime: v.number(),
});

const publicStoryListItem = v.object({
  ...storyDocFields,
  _id: v.id("stories"),
  _creationTime: v.number(),
  authorName: v.string(),
  authorHandle: v.string(),
  publishedChapterCount: v.number(),
});

const publishedChapterSummary = v.object({
  _id: v.id("storyChapters"),
  number: v.number(),
  title: v.string(),
  wordCount: v.number(),
  publishedAt: v.optional(v.number()),
  updatedAt: v.number(),
});

const mineStoryListItem = v.object({
  ...storyDocFields,
  _id: v.id("stories"),
  _creationTime: v.number(),
  publishedChapterCount: v.number(),
});

function slugifyTitle(title: string) {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "story";
  return base;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

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

async function publishedChapterCount(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"stories">
) {
  const rows = await ctx.db
    .query("storyChapters")
    .withIndex("by_story_status", (q) =>
      q.eq("storyId", storyId).eq("status", "published")
    )
    .take(50);
  return rows.length;
}

async function latestChapter(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"stories">
) {
  const rows = await ctx.db
    .query("storyChapters")
    .withIndex("by_story_number", (q) => q.eq("storyId", storyId))
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

async function latestDraft(
  ctx: QueryCtx | MutationCtx,
  storyId: Id<"stories">
) {
  const rows = await ctx.db
    .query("storyChapters")
    .withIndex("by_story_status", (q) =>
      q.eq("storyId", storyId).eq("status", "draft")
    )
    .take(50);
  if (rows.length === 0) return null;
  return rows.reduce((max, row) => (row.number > max.number ? row : max));
}

async function authorForWriter(
  ctx: QueryCtx | MutationCtx,
  writerId: Id<"writers">
) {
  const writer = await ctx.db.get(writerId);
  return {
    authorName: writer?.penName ?? "Writer",
    authorHandle: writer?.handle ?? "writer",
  };
}

async function resolvedCoverImage(
  ctx: QueryCtx | MutationCtx,
  story: Doc<"stories">
) {
  if (story.coverMode === "storage" && story.coverStorageId) {
    const url = await ctx.storage.getUrl(story.coverStorageId);
    return url ?? story.coverImage;
  }
  return story.coverImage;
}

async function storyWithResolvedCover(
  ctx: QueryCtx | MutationCtx,
  story: Doc<"stories">
) {
  const coverImage = await resolvedCoverImage(ctx, story);
  return coverImage ? { ...story, coverImage } : story;
}

async function withPublicMeta(ctx: QueryCtx | MutationCtx, story: Doc<"stories">) {
  const [resolved, count, author] = await Promise.all([
    storyWithResolvedCover(ctx, story),
    publishedChapterCount(ctx, story._id),
    authorForWriter(ctx, story.writerId),
  ]);
  return {
    ...resolved,
    ...author,
    publishedChapterCount: count,
  };
}

export const create = mutation({
  args: {
    title: v.string(),
    genre: storyGenre,
  },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    const { writer, clerkId } = await requireApprovedWriter(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("A title is required");

    const base = slugifyTitle(title);
    let slug = base;
    let taken = true;
    for (let attempt = 0; attempt < 12; attempt++) {
      const clash = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!clash) {
        taken = false;
        break;
      }
      slug = `${base}-${attempt + 2}`;
    }
    if (taken) throw new Error("Could not allocate a unique slug");

    const now = Date.now();
    await ctx.db.insert("stories", {
      slug,
      title,
      blurb: "",
      genre: args.genre,
      tags: [],
      status: "ongoing",
      visibility: "draft",
      mature: false,
      writerId: writer._id,
      authorClerkId: clerkId,
      reads: 0,
      votes: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { slug };
  },
});

export const listMine = query({
  args: {},
  returns: v.array(mineStoryListItem),
  handler: async (ctx) => {
    const { writer } = await requireApprovedWriter(ctx);
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_writerId_updatedAt", (q) => q.eq("writerId", writer._id))
      .order("desc")
      .take(50);
    return await Promise.all(
      rows.map(async (story) => ({
        ...(await storyWithResolvedCover(ctx, story)),
        publishedChapterCount: await publishedChapterCount(ctx, story._id),
      }))
    );
  },
});

export const getMineBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      story: storyDoc,
      draft: v.union(storyChapterDoc, v.null()),
      publishedChapters: v.array(storyChapterDoc),
      publishedChapterCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.writerId !== writer._id) return null;
    const [draft, published, resolved] = await Promise.all([
      latestDraft(ctx, story._id),
      ctx.db
        .query("storyChapters")
        .withIndex("by_story_status", (q) =>
          q.eq("storyId", story._id).eq("status", "published")
        )
        .take(50),
      storyWithResolvedCover(ctx, story),
    ]);
    published.sort((a, b) => a.number - b.number);
    return {
      story: resolved,
      draft,
      publishedChapters: published,
      publishedChapterCount: published.length,
    };
  },
});

export const update = mutation({
  args: {
    slug: v.string(),
    title: v.optional(v.string()),
    blurb: v.optional(v.string()),
    genre: v.optional(storyGenre),
    tags: v.optional(v.array(v.string())),
    mature: v.optional(v.boolean()),
    status: v.optional(storyStatus),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }

    const patch: Partial<Doc<"stories">> = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("A title is required");
      patch.title = title;
    }
    if (args.blurb !== undefined) patch.blurb = args.blurb.trim();
    if (args.genre !== undefined) patch.genre = args.genre;
    if (args.tags !== undefined) {
      patch.tags = args.tags.map((tag) => tag.trim()).filter(Boolean);
    }
    if (args.mature !== undefined) patch.mature = args.mature;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(story._id, patch);
    return null;
  },
});

export const updateChapter = mutation({
  args: {
    slug: v.string(),
    number: v.number(),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ number: v.number() }),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }
    const rows = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) =>
        q.eq("storyId", story._id).eq("number", args.number)
      )
      .take(1);
    const chapter = rows[0];
    if (!chapter) throw new Error("Part not found");

    const title = args.title.trim() || "Untitled part";
    const now = Date.now();
    await ctx.db.patch(chapter._id, {
      title,
      body: args.body,
      wordCount: wordCount(args.body),
      updatedAt: now,
    });
    await ctx.db.patch(story._id, { updatedAt: now });
    return { number: chapter.number };
  },
});

export const setCover = mutation({
  args: {
    storyId: v.id("stories"),
    coverImage: v.optional(v.string()),
    coverStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }
    const hasUrl = Boolean(args.coverImage);
    const hasStorage = Boolean(args.coverStorageId);
    if (hasUrl === hasStorage) {
      throw new Error("Choose a preset cover or an uploaded file");
    }
    if (args.coverStorageId) {
      await ctx.db.patch(args.storyId, {
        coverMode: "storage",
        coverStorageId: args.coverStorageId,
        updatedAt: Date.now(),
      });
      return null;
    }
    const coverImage = args.coverImage;
    if (!coverImage) throw new Error("Choose a preset cover or an uploaded file");
    await ctx.db.patch(args.storyId, {
      coverMode: "url",
      coverImage,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const setStatus = mutation({
  args: {
    storyId: v.id("stories"),
    status: storyStatus,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db.get(args.storyId);
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }
    await ctx.db.patch(args.storyId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const saveDraftChapter = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ number: v.number() }),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }

    const title = args.title.trim() || "Untitled part";
    const body = args.body;
    const words = wordCount(body);
    const now = Date.now();
    const draft = await latestDraft(ctx, story._id);

    if (draft) {
      await ctx.db.patch(draft._id, {
        title,
        body,
        wordCount: words,
        updatedAt: now,
      });
      await ctx.db.patch(story._id, { updatedAt: now });
      return { number: draft.number };
    }

    const latest = await latestChapter(ctx, story._id);
    const number = (latest?.number ?? 0) + 1;
    await ctx.db.insert("storyChapters", {
      storyId: story._id,
      number,
      title,
      body,
      wordCount: words,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(story._id, { updatedAt: now });
    return { number };
  },
});

export const publishChapter = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ number: v.number(), nextNumber: v.number() }),
  handler: async (ctx, args) => {
    const { writer } = await requireApprovedWriter(ctx);
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.writerId !== writer._id) {
      throw new Error("Story not found");
    }

    const body = args.body.trim();
    if (!body) throw new Error("Write something before publishing this part");
    const title = args.title.trim() || "Untitled part";
    const words = wordCount(body);
    const now = Date.now();

    let draft = await latestDraft(ctx, story._id);
    if (!draft) {
      const latest = await latestChapter(ctx, story._id);
      const number = (latest?.number ?? 0) + 1;
      const id = await ctx.db.insert("storyChapters", {
        storyId: story._id,
        number,
        title,
        body,
        wordCount: words,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      draft = await ctx.db.get(id);
      if (!draft) throw new Error("Could not create chapter");
    } else {
      await ctx.db.patch(draft._id, {
        title,
        body,
        wordCount: words,
        updatedAt: now,
      });
    }

    await ctx.db.patch(draft._id, {
      status: "published",
      publishedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(story._id, {
      visibility: "public",
      updatedAt: now,
    });

    return { number: draft.number, nextNumber: draft.number + 1 };
  },
});

export const listPublic = query({
  args: {},
  returns: v.array(publicStoryListItem),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_visibility_updatedAt", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(50);
    return await Promise.all(rows.map((story) => withPublicMeta(ctx, story)));
  },
});

export const listPublicByGenre = query({
  args: { genre: storyGenre },
  returns: v.array(publicStoryListItem),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_visibility_genre_updatedAt", (q) =>
        q.eq("visibility", "public").eq("genre", args.genre)
      )
      .order("desc")
      .take(50);
    return await Promise.all(rows.map((story) => withPublicMeta(ctx, story)));
  },
});

export const getPublicBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      story: storyDoc,
      authorName: v.string(),
      authorHandle: v.string(),
      chapters: v.array(publishedChapterSummary),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.visibility !== "public") return null;
    const published = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_status", (q) =>
        q.eq("storyId", story._id).eq("status", "published")
      )
      .take(50);
    published.sort((a, b) => a.number - b.number);
    const [author, resolved] = await Promise.all([
      authorForWriter(ctx, story.writerId),
      storyWithResolvedCover(ctx, story),
    ]);
    return {
      story: resolved,
      ...author,
      chapters: published.map((chapter) => ({
        _id: chapter._id,
        number: chapter.number,
        title: chapter.title,
        wordCount: chapter.wordCount,
        publishedAt: chapter.publishedAt,
        updatedAt: chapter.updatedAt,
      })),
    };
  },
});

export const getPublicChapter = query({
  args: { slug: v.string(), number: v.number() },
  returns: v.union(
    v.object({
      story: storyDoc,
      authorName: v.string(),
      authorHandle: v.string(),
      chapter: storyChapterDoc,
      publishedChapterCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!story || story.visibility !== "public") return null;
    const rows = await ctx.db
      .query("storyChapters")
      .withIndex("by_story_number", (q) =>
        q.eq("storyId", story._id).eq("number", args.number)
      )
      .take(1);
    const chapter = rows[0];
    if (!chapter || chapter.status !== "published") return null;
    const [author, count, resolved] = await Promise.all([
      authorForWriter(ctx, story.writerId),
      publishedChapterCount(ctx, story._id),
      storyWithResolvedCover(ctx, story),
    ]);
    return {
      story: resolved,
      ...author,
      chapter,
      publishedChapterCount: count,
    };
  },
});
