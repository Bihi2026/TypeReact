import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin, isAdmin } from "./lib/admin";
import {
  contentBlock,
  learningCategory,
  learningResourceFields,
  learningResourceType,
  sourcePlatform,
} from "./lib/validators";

const learningResourceDoc = v.object({
  ...learningResourceFields,
  _id: v.id("learningResources"),
  _creationTime: v.number(),
});

const learningResourcePublic = v.object({
  ...learningResourceFields,
  _id: v.id("learningResources"),
  _creationTime: v.number(),
  downloadUrl: v.optional(v.string()),
});

function slugifyTitle(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "resource";
  return base;
}

async function withDownloadUrl(
  ctx: { storage: { getUrl: (id: Doc<"learningResources">["fileStorageId"] & string) => Promise<string | null> } },
  doc: Doc<"learningResources">
) {
  let downloadUrl: string | undefined;
  if (doc.externalDownloadUrl?.trim()) {
    downloadUrl = doc.externalDownloadUrl.trim();
  } else if (doc.fileStorageId) {
    downloadUrl = (await ctx.storage.getUrl(doc.fileStorageId)) ?? undefined;
  }
  return { ...doc, downloadUrl };
}

function validateTypeFields(args: {
  type: "video" | "article" | "download";
  videoUrl?: string;
  contentBlocks?: Doc<"learningResources">["contentBlocks"];
  fileStorageId?: Doc<"learningResources">["fileStorageId"];
  externalDownloadUrl?: string;
}) {
  if (args.type === "video" && !args.videoUrl?.trim()) {
    throw new Error("Video resources require a video URL");
  }
  if (
    args.type === "article" &&
    (!args.contentBlocks || args.contentBlocks.length === 0)
  ) {
    throw new Error("Article resources require body content");
  }
  if (
    args.type === "download" &&
    !args.fileStorageId &&
    !args.externalDownloadUrl?.trim()
  ) {
    throw new Error("Download resources require a file or external URL");
  }
}

const upsertArgs = {
  title: v.string(),
  slug: v.optional(v.string()),
  description: v.string(),
  type: learningResourceType,
  category: learningCategory,
  sortOrder: v.number(),
  durationMinutes: v.optional(v.number()),
  thumbnailUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  videoPlatform: v.optional(sourcePlatform),
  contentBlocks: v.optional(v.array(contentBlock)),
  fileStorageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  fileContentType: v.optional(v.string()),
  externalDownloadUrl: v.optional(v.string()),
};

export const listPublished = query({
  args: {},
  returns: v.array(learningResourcePublic),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("learningResources")
      .withIndex("by_status_sortOrder", (q) => q.eq("status", "published"))
      .collect();
    rows.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.sortOrder - b.sortOrder;
    });
    return Promise.all(rows.map((row) => withDownloadUrl(ctx, row)));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(learningResourcePublic, v.null()),
  handler: async (ctx, args) => {
    const slug = args.slug.trim().toLowerCase();
    if (!slug) return null;
    const row = await ctx.db
      .query("learningResources")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!row || row.status !== "published") return null;
    return withDownloadUrl(ctx, row);
  },
});

export const listAll = query({
  args: {},
  returns: v.union(v.array(learningResourceDoc), v.null()),
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    const rows = await ctx.db.query("learningResources").collect();
    rows.sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt - a.updatedAt);
    return rows;
  },
});

export const getById = query({
  args: { id: v.id("learningResources") },
  returns: v.union(learningResourceDoc, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: upsertArgs,
  returns: v.id("learningResources"),
  handler: async (ctx, args) => {
    const { clerkId } = await requireAdmin(ctx);
    const slug = (args.slug?.trim() || slugifyTitle(args.title)).toLowerCase();
    const existing = await ctx.db
      .query("learningResources")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error("Slug already in use");

    const now = Date.now();
    return await ctx.db.insert("learningResources", {
      slug,
      title: args.title.trim(),
      description: args.description.trim(),
      type: args.type,
      category: args.category,
      status: "draft",
      sortOrder: args.sortOrder,
      durationMinutes: args.durationMinutes,
      thumbnailUrl: args.thumbnailUrl?.trim() || undefined,
      videoUrl: args.videoUrl?.trim() || undefined,
      videoPlatform: args.videoPlatform,
      contentBlocks: args.contentBlocks,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      fileContentType: args.fileContentType?.trim() || undefined,
      externalDownloadUrl: args.externalDownloadUrl?.trim() || undefined,
      updatedAt: now,
      authorClerkId: clerkId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("learningResources"),
    ...upsertArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clerkId } = await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Resource not found");

    const slug = (args.slug?.trim() || slugifyTitle(args.title)).toLowerCase();
    if (slug !== row.slug) {
      const existing = await ctx.db
        .query("learningResources")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (existing && existing._id !== args.id) {
        throw new Error("Slug already in use");
      }
    }

    await ctx.db.patch(args.id, {
      slug,
      title: args.title.trim(),
      description: args.description.trim(),
      type: args.type,
      category: args.category,
      sortOrder: args.sortOrder,
      durationMinutes: args.durationMinutes,
      thumbnailUrl: args.thumbnailUrl?.trim() || undefined,
      videoUrl: args.videoUrl?.trim() || undefined,
      videoPlatform: args.videoPlatform,
      contentBlocks: args.contentBlocks,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      fileContentType: args.fileContentType?.trim() || undefined,
      externalDownloadUrl: args.externalDownloadUrl?.trim() || undefined,
      updatedAt: Date.now(),
      authorClerkId: clerkId,
    });
    return null;
  },
});

export const publish = mutation({
  args: { id: v.id("learningResources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Resource not found");
    validateTypeFields({
      type: row.type,
      videoUrl: row.videoUrl,
      contentBlocks: row.contentBlocks,
      fileStorageId: row.fileStorageId,
      externalDownloadUrl: row.externalDownloadUrl,
    });
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: row.publishedAt ?? now,
      updatedAt: now,
    });
    return null;
  },
});

export const unpublish = mutation({
  args: { id: v.id("learningResources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Resource not found");
    await ctx.db.patch(args.id, {
      status: "draft",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("learningResources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    if (row.fileStorageId) {
      await ctx.storage.delete(row.fileStorageId);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const seedStarter = mutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.boolean() }),
  handler: async (ctx) => {
    const { clerkId } = await requireAdmin(ctx);
    const existing = await ctx.db.query("learningResources").first();
    if (existing) return { inserted: 0, skipped: true };

    const now = Date.now();

    const resources = [
      {
        slug: "welcome-to-typereact",
        title: "Welcome to TypeReact",
        description:
          "A quick tour of how evidence-based reactions work on TypeReact.",
        type: "video" as const,
        category: "getting-started" as const,
        sortOrder: 0,
        durationMinutes: 5,
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoPlatform: "youtube" as const,
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      {
        slug: "write-evidence-based-reaction",
        title: "How to write an evidence-based reaction",
        description:
          "Structure your analysis, cite sources, and link claims to evidence.",
        type: "article" as const,
        category: "reactions" as const,
        sortOrder: 0,
        contentBlocks: [
          { kind: "heading" as const, text: "Start with the source" },
          {
            kind: "paragraph" as const,
            text: "Every reaction on TypeReact responds to an original source. Paste the URL and confirm the detected metadata before you write.",
          },
          {
            kind: "list" as const,
            items: [
              "Quote or paraphrase the source accurately",
              "Add evidence for each major claim",
              "Label speculation clearly",
            ],
          },
        ],
      },
      {
        slug: "evidence-checklist",
        title: "Evidence checklist (PDF)",
        description: "Download a printable checklist for evaluating claims.",
        type: "download" as const,
        category: "evidence" as const,
        sortOrder: 0,
        externalDownloadUrl:
          "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
        fileName: "evidence-checklist.pdf",
        fileContentType: "application/pdf",
      },
      {
        slug: "open-accountability-case",
        title: "Opening an accountability case",
        description: "When claims deserve sustained scrutiny, open a case.",
        type: "article" as const,
        category: "cases" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Cases gather reactions, timeline events, and community analysis in one place.",
          },
        ],
      },
      {
        slug: "creator-verification",
        title: "Creator verification overview",
        description: "How public figures claim their profile on TypeReact.",
        type: "article" as const,
        category: "creators" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Verified creators can post official responses linked to reactions about their work.",
          },
        ],
      },
      {
        slug: "platform-tour",
        title: "Platform tour: Explore and Research Circles",
        description: "Find trending sources and collaborate in research circles.",
        type: "article" as const,
        category: "platform" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Use Explore to filter by country. Research Circles let teams coordinate privately.",
          },
        ],
      },
    ];

    for (const resource of resources) {
      await ctx.db.insert("learningResources", {
        ...resource,
        status: "published",
        publishedAt: now,
        updatedAt: now,
        authorClerkId: clerkId,
      });
    }

    return { inserted: resources.length, skipped: false };
  },
});
