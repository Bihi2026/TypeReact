import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { isAdmin, requireAdmin } from "./lib/admin";
import { clerkUserId, requireIdentity } from "./lib/auth";
import { recordModerationEvent } from "./lib/moderation";
import { displayName, notify } from "./lib/notify";
import {
  storyGenre,
  storyIdeaDocFields,
} from "./lib/validators";

const MIN_PITCH_CHARS = 80;
const DEFAULT_STORY_GENRE = "untold-stories" as const;

const storyIdeaDoc = v.object({
  ...storyIdeaDocFields,
  _id: v.id("storyIdeas"),
  _creationTime: v.number(),
});

const publicIdea = v.object({
  _id: v.id("storyIdeas"),
  ideaCode: v.string(),
  title: v.string(),
  pitch: v.string(),
  genre: v.optional(storyGenre),
  status: v.literal("accepted"),
  assigned: v.boolean(),
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
});

const mineIdea = v.object({
  ...storyIdeaDocFields,
  _id: v.id("storyIdeas"),
  _creationTime: v.number(),
  storySlug: v.union(v.string(), v.null()),
  assignedWriterHandle: v.union(v.string(), v.null()),
  assignedPenName: v.union(v.string(), v.null()),
});

const assignedToMeIdea = v.object({
  _id: v.id("storyIdeas"),
  ideaCode: v.string(),
  title: v.string(),
  pitch: v.string(),
  genre: v.optional(storyGenre),
  notes: v.optional(v.string()),
  reviewNote: v.optional(v.string()),
  submitterName: v.string(),
  storyId: v.id("stories"),
  storySlug: v.string(),
  assignedAt: v.number(),
  createdAt: v.number(),
});

const ideaForStory = v.object({
  _id: v.id("storyIdeas"),
  ideaCode: v.string(),
  title: v.string(),
  pitch: v.string(),
  genre: v.optional(storyGenre),
  notes: v.optional(v.string()),
  reviewNote: v.optional(v.string()),
  submitterName: v.string(),
  assignedAt: v.optional(v.number()),
});

const approvedWriterOption = v.object({
  _id: v.id("writers"),
  penName: v.string(),
  handle: v.string(),
  applicantClerkId: v.string(),
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

async function allocateIdeaCode(ctx: MutationCtx) {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const n = 1000 + Math.floor(Math.random() * 9000);
    const candidate = `IDEA-${year}-${String(n).padStart(4, "0")}`;
    const clash = await ctx.db
      .query("storyIdeas")
      .withIndex("by_ideaCode", (q) => q.eq("ideaCode", candidate))
      .unique();
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate an idea code");
}

async function allocateStorySlug(ctx: MutationCtx, title: string) {
  const base = slugifyTitle(title);
  let slug = base;
  for (let attempt = 0; attempt < 12; attempt++) {
    const clash = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!clash) return slug;
    slug = `${base}-${attempt + 2}`;
  }
  throw new Error("Could not allocate a unique slug");
}

async function createDraftFromIdea(
  ctx: MutationCtx,
  idea: Doc<"storyIdeas">,
  writer: Doc<"writers">
) {
  const slug = await allocateStorySlug(ctx, idea.title);
  const now = Date.now();
  const storyId = await ctx.db.insert("stories", {
    slug,
    title: idea.title,
    blurb: idea.pitch.slice(0, 500),
    genre: idea.genre ?? DEFAULT_STORY_GENRE,
    tags: [],
    status: "ongoing",
    visibility: "draft",
    mature: false,
    writerId: writer._id,
    authorClerkId: writer.applicantClerkId,
    reads: 0,
    votes: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(idea._id, {
    storyId,
    assignedWriterId: writer._id,
    assignedClerkId: writer.applicantClerkId,
    assignedAt: now,
    updatedAt: now,
  });
  return { storyId, slug };
}

export const submit = mutation({
  args: {
    title: v.string(),
    pitch: v.string(),
    genre: v.optional(storyGenre),
    notes: v.optional(v.string()),
  },
  returns: v.object({ ideaCode: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const submitterClerkId = clerkUserId(identity);
    const title = args.title.trim();
    if (!title) throw new Error("A title is required");
    const pitch = args.pitch.trim();
    if (pitch.length < MIN_PITCH_CHARS) {
      throw new Error(
        `Your pitch needs at least ${MIN_PITCH_CHARS} characters`
      );
    }
    const notes = args.notes?.trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", submitterClerkId))
      .unique();
    const submitterName =
      user?.name?.trim() ||
      (typeof identity.name === "string" ? identity.name.trim() : "") ||
      "Member";

    const mine = await ctx.db
      .query("storyIdeas")
      .withIndex("by_submitter_createdAt", (q) =>
        q.eq("submitterClerkId", submitterClerkId)
      )
      .order("desc")
      .take(20);
    if (mine.some((row) => row.status === "pending")) {
      throw new Error("You already have a story idea under review");
    }

    const ideaCode = await allocateIdeaCode(ctx);
    const now = Date.now();
    await ctx.db.insert("storyIdeas", {
      ideaCode,
      title,
      pitch,
      genre: args.genre,
      notes: notes || undefined,
      submitterClerkId,
      submitterName,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { ideaCode };
  },
});

export const listMine = query({
  args: {},
  returns: v.array(mineIdea),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const rows = await ctx.db
      .query("storyIdeas")
      .withIndex("by_submitter_createdAt", (q) =>
        q.eq("submitterClerkId", clerkId)
      )
      .order("desc")
      .take(50);

    return await Promise.all(
      rows.map(async (row) => {
        let storySlug: string | null = null;
        let assignedWriterHandle: string | null = null;
        let assignedPenName: string | null = null;

        if (row.storyId && row.assignedClerkId === clerkId) {
          const story = await ctx.db.get(row.storyId);
          storySlug = story?.slug ?? null;
        }

        if (row.assignedWriterId) {
          const writer = await ctx.db.get(row.assignedWriterId);
          if (writer) {
            assignedWriterHandle = writer.handle;
            assignedPenName = writer.penName;
          }
        }

        return {
          ...row,
          storySlug,
          assignedWriterHandle,
          assignedPenName,
        };
      })
    );
  },
});

export const listAcceptedPublic = query({
  args: {},
  returns: v.array(publicIdea),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("storyIdeas")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "accepted"))
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      _id: row._id,
      ideaCode: row.ideaCode,
      title: row.title,
      pitch: row.pitch,
      genre: row.genre,
      status: "accepted" as const,
      assigned: !!row.storyId,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    }));
  },
});

export const listAssignedToMe = query({
  args: {},
  returns: v.array(assignedToMeIdea),
  handler: async (ctx) => {
    const { writer } = await requireApprovedWriter(ctx);
    const rows = await ctx.db
      .query("storyIdeas")
      .withIndex("by_assignedWriter", (q) =>
        q.eq("assignedWriterId", writer._id)
      )
      .take(50);

    const out: Array<{
      _id: Id<"storyIdeas">;
      ideaCode: string;
      title: string;
      pitch: string;
      genre: Doc<"storyIdeas">["genre"];
      notes?: string;
      reviewNote?: string;
      submitterName: string;
      storyId: Id<"stories">;
      storySlug: string;
      assignedAt: number;
      createdAt: number;
    }> = [];

    for (const row of rows) {
      if (!row.storyId || !row.assignedAt) continue;
      const story = await ctx.db.get(row.storyId);
      if (!story) continue;
      out.push({
        _id: row._id,
        ideaCode: row.ideaCode,
        title: row.title,
        pitch: row.pitch,
        genre: row.genre,
        notes: row.notes,
        reviewNote: row.reviewNote,
        submitterName: row.submitterName,
        storyId: row.storyId,
        storySlug: story.slug,
        assignedAt: row.assignedAt,
        createdAt: row.createdAt,
      });
    }

    out.sort((a, b) => b.assignedAt - a.assignedAt);
    return out;
  },
});

export const getIdeaForStory = query({
  args: { storyId: v.id("stories") },
  returns: v.union(ideaForStory, v.null()),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;

    const admin = await isAdmin(ctx);
    if (!admin && story.authorClerkId !== clerkId) {
      throw new Error("Not authorized");
    }

    const idea = await ctx.db
      .query("storyIdeas")
      .withIndex("by_storyId", (q) => q.eq("storyId", args.storyId))
      .unique();
    if (!idea) return null;

    return {
      _id: idea._id,
      ideaCode: idea.ideaCode,
      title: idea.title,
      pitch: idea.pitch,
      genre: idea.genre,
      notes: idea.notes,
      reviewNote: idea.reviewNote,
      submitterName: idea.submitterName,
      assignedAt: idea.assignedAt,
    };
  },
});

export const listPending = query({
  args: {},
  returns: v.array(storyIdeaDoc),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("storyIdeas")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(50);
  },
});

export const listUnassignedAccepted = query({
  args: {},
  returns: v.array(storyIdeaDoc),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("storyIdeas")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "accepted"))
      .order("desc")
      .take(100);
    return rows.filter((row) => !row.storyId);
  },
});

export const listRecent = query({
  args: {},
  returns: v.array(storyIdeaDoc),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [accepted, rejected] = await Promise.all([
      ctx.db
        .query("storyIdeas")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "accepted"))
        .order("desc")
        .take(25),
      ctx.db
        .query("storyIdeas")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "rejected"))
        .order("desc")
        .take(25),
    ]);
    return [...accepted, ...rejected]
      .sort(
        (a, b) =>
          (b.reviewedAt ?? b.updatedAt) - (a.reviewedAt ?? a.updatedAt)
      )
      .slice(0, 40);
  },
});

export const listApprovedWriters = query({
  args: {},
  returns: v.array(approvedWriterOption),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("writers")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      _id: row._id,
      penName: row.penName,
      handle: row.handle,
      applicantClerkId: row.applicantClerkId,
    }));
  },
});

export const accept = mutation({
  args: {
    ideaId: v.id("storyIdeas"),
    writerId: v.optional(v.id("writers")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clerkId, identity } = await requireAdmin(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.status !== "pending") {
      throw new Error("Only pending ideas can be accepted");
    }

    const reviewNote = args.note?.trim() || undefined;
    const now = Date.now();
    await ctx.db.patch(idea._id, {
      status: "accepted",
      reviewerClerkId: clerkId,
      reviewNote,
      reviewedAt: now,
      updatedAt: now,
    });

    let assignedSlug: string | null = null;
    let writer: Doc<"writers"> | null = null;
    if (args.writerId) {
      writer = await ctx.db.get(args.writerId);
      if (!writer || writer.status !== "approved") {
        throw new Error("Choose an approved writer");
      }
      const refreshed = (await ctx.db.get(idea._id))!;
      const created = await createDraftFromIdea(ctx, refreshed, writer);
      assignedSlug = created.slug;
    }

    await notify(ctx, {
      recipientClerkId: idea.submitterClerkId,
      category: "verification",
      title: "Your story idea was accepted",
      body: writer
        ? `"${idea.title}" was accepted and assigned to @${writer.handle}.`
        : `"${idea.title}" was accepted. Browse it on accepted ideas.`,
      href: "/stories/ideas",
    });

    if (writer) {
      await notify(ctx, {
        recipientClerkId: writer.applicantClerkId,
        category: "verification",
        title: "New story draft from an accepted idea",
        body: `"${idea.title}" was assigned to you as a draft.`,
        href: assignedSlug
          ? `/stories/write/${assignedSlug}`
          : "/stories/dashboard",
      });
    }

    await recordModerationEvent(ctx, {
      kind: "story_idea_accept",
      actorClerkId: clerkId,
      actorName: await displayName(
        ctx,
        clerkId,
        typeof identity.name === "string" ? identity.name : "Admin"
      ),
      targetLabel: idea.ideaCode,
      note: writer
        ? `Accepted and assigned to @${writer.handle}`
        : reviewNote ?? "Accepted without writer assignment",
    });
    return null;
  },
});

export const reject = mutation({
  args: {
    ideaId: v.id("storyIdeas"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clerkId, identity } = await requireAdmin(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.status !== "pending") {
      throw new Error("Only pending ideas can be rejected");
    }

    const reviewNote = args.note?.trim() || undefined;
    const now = Date.now();
    await ctx.db.patch(idea._id, {
      status: "rejected",
      reviewerClerkId: clerkId,
      reviewNote,
      reviewedAt: now,
      updatedAt: now,
    });

    await notify(ctx, {
      recipientClerkId: idea.submitterClerkId,
      category: "verification",
      title: "Story idea was not accepted",
      body: reviewNote
        ? `"${idea.title}" was not accepted. ${reviewNote}`
        : `"${idea.title}" was not accepted. You can submit a new idea.`,
      href: "/stories/submit-idea",
    });

    await recordModerationEvent(ctx, {
      kind: "story_idea_reject",
      actorClerkId: clerkId,
      actorName: await displayName(
        ctx,
        clerkId,
        typeof identity.name === "string" ? identity.name : "Admin"
      ),
      targetLabel: idea.ideaCode,
      note: reviewNote ?? "Rejected",
    });
    return null;
  },
});

export const assign = mutation({
  args: {
    ideaId: v.id("storyIdeas"),
    writerId: v.id("writers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clerkId, identity } = await requireAdmin(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.status !== "accepted") {
      throw new Error("Only accepted ideas can be assigned");
    }
    if (idea.storyId) {
      throw new Error("This idea already has a draft story");
    }

    const writer = await ctx.db.get(args.writerId);
    if (!writer || writer.status !== "approved") {
      throw new Error("Choose an approved writer");
    }

    const { slug } = await createDraftFromIdea(ctx, idea, writer);

    await notify(ctx, {
      recipientClerkId: writer.applicantClerkId,
      category: "verification",
      title: "New story draft from an accepted idea",
      body: `"${idea.title}" was assigned to you as a draft.`,
      href: `/stories/write/${slug}`,
    });

    await notify(ctx, {
      recipientClerkId: idea.submitterClerkId,
      category: "verification",
      title: "A writer was assigned to your idea",
      body: `"${idea.title}" was assigned to @${writer.handle}.`,
      href: "/stories/submit-idea",
    });

    await recordModerationEvent(ctx, {
      kind: "story_idea_assign",
      actorClerkId: clerkId,
      actorName: await displayName(
        ctx,
        clerkId,
        typeof identity.name === "string" ? identity.name : "Admin"
      ),
      targetLabel: idea.ideaCode,
      note: `Assigned to @${writer.handle}`,
    });
    return null;
  },
});

export const reassign = mutation({
  args: {
    ideaId: v.id("storyIdeas"),
    writerId: v.id("writers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clerkId, identity } = await requireAdmin(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.status !== "accepted") {
      throw new Error("Only accepted ideas can be reassigned");
    }
    if (!idea.storyId || !idea.assignedWriterId) {
      throw new Error("Assign a writer before reassigning");
    }
    if (idea.assignedWriterId === args.writerId) {
      throw new Error("Choose a different writer");
    }

    const story = await ctx.db.get(idea.storyId);
    if (!story) throw new Error("Draft story not found");

    const previousWriter = await ctx.db.get(idea.assignedWriterId);
    const writer = await ctx.db.get(args.writerId);
    if (!writer || writer.status !== "approved") {
      throw new Error("Choose an approved writer");
    }

    const now = Date.now();
    await ctx.db.patch(story._id, {
      writerId: writer._id,
      authorClerkId: writer.applicantClerkId,
      updatedAt: now,
    });
    await ctx.db.patch(idea._id, {
      assignedWriterId: writer._id,
      assignedClerkId: writer.applicantClerkId,
      assignedAt: now,
      updatedAt: now,
    });

    await notify(ctx, {
      recipientClerkId: writer.applicantClerkId,
      category: "verification",
      title: "Story draft reassigned to you",
      body: `"${idea.title}" was reassigned to you as a draft.`,
      href: `/stories/write/${story.slug}`,
    });

    if (previousWriter) {
      await notify(ctx, {
        recipientClerkId: previousWriter.applicantClerkId,
        category: "verification",
        title: "Story draft was reassigned",
        body: `"${idea.title}" was reassigned to another writer.`,
        href: "/stories/dashboard",
      });
    }

    await notify(ctx, {
      recipientClerkId: idea.submitterClerkId,
      category: "verification",
      title: "Your idea was reassigned",
      body: `"${idea.title}" is now assigned to @${writer.handle}.`,
      href: "/stories/submit-idea",
    });

    await recordModerationEvent(ctx, {
      kind: "story_idea_reassign",
      actorClerkId: clerkId,
      actorName: await displayName(
        ctx,
        clerkId,
        typeof identity.name === "string" ? identity.name : "Admin"
      ),
      targetLabel: idea.ideaCode,
      note: previousWriter
        ? `Reassigned from @${previousWriter.handle} to @${writer.handle}`
        : `Reassigned to @${writer.handle}`,
    });
    return null;
  },
});
