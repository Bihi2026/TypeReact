import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import { notify } from "./lib/notify";

async function getBarkByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("barks")
    .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
    .unique();
}

const noteDoc = v.object({
  _id: v.id("barkCommunityNotes"),
  _creationTime: v.number(),
  barkId: v.id("barks"),
  authorClerkId: v.string(),
  authorName: v.string(),
  text: v.string(),
  createdAt: v.number(),
  helpfulCount: v.number(),
  notHelpfulCount: v.number(),
  myVote: v.union(v.literal("helpful"), v.literal("not"), v.null()),
});

export const listCommunityNotes = query({
  args: { code: v.string() },
  returns: v.array(noteDoc),
  handler: async (ctx, args) => {
    const bark = await getBarkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return [];
    const identity = await ctx.auth.getUserIdentity();
    const me = identity ? clerkUserId(identity) : null;
    const rows = await ctx.db
      .query("barkCommunityNotes")
      .withIndex("by_bark_created", (q) => q.eq("barkId", bark._id))
      .order("desc")
      .take(50);
    const result = [];
    for (const row of rows) {
      let myVote: "helpful" | "not" | null = null;
      if (me) {
        const vote = await ctx.db
          .query("barkCommunityNoteVotes")
          .withIndex("by_note_user", (q) =>
            q.eq("noteId", row._id).eq("clerkUserId", me)
          )
          .unique();
        myVote = vote?.vote ?? null;
      }
      result.push({ ...row, myVote });
    }
    return result;
  },
});

export const addCommunityNote = mutation({
  args: { code: v.string(), text: v.string() },
  returns: v.id("barkCommunityNotes"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await getBarkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") {
      throw new Error("Reaction not found");
    }
    const text = args.text.trim();
    if (!text) throw new Error("Write a note first");
    if (text.length > 2000) throw new Error("Note is too long");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", me))
      .unique();
    const authorName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";

    const id = await ctx.db.insert("barkCommunityNotes", {
      barkId: bark._id,
      authorClerkId: me,
      authorName,
      text,
      createdAt: Date.now(),
      helpfulCount: 0,
      notHelpfulCount: 0,
    });

    if (bark.authorClerkId !== me) {
      await notify(ctx, {
        recipientClerkId: bark.authorClerkId,
        actorClerkId: me,
        category: "evidence",
        title: `${authorName} added context on ${bark.code}`,
        body: text.slice(0, 140),
        href: `/barks/${bark.code}#community-notes`,
      });
    }

    return id;
  },
});

export const voteCommunityNote = mutation({
  args: {
    noteId: v.id("barkCommunityNotes"),
    vote: v.union(v.literal("helpful"), v.literal("not")),
  },
  returns: v.object({
    helpfulCount: v.number(),
    notHelpfulCount: v.number(),
    myVote: v.union(v.literal("helpful"), v.literal("not"), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    const existing = await ctx.db
      .query("barkCommunityNoteVotes")
      .withIndex("by_note_user", (q) =>
        q.eq("noteId", note._id).eq("clerkUserId", me)
      )
      .unique();

    if (existing && existing.vote === args.vote) {
      await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { vote: args.vote });
    } else {
      await ctx.db.insert("barkCommunityNoteVotes", {
        noteId: note._id,
        clerkUserId: me,
        vote: args.vote,
        createdAt: Date.now(),
      });
    }

    const votes = await ctx.db
      .query("barkCommunityNoteVotes")
      .withIndex("by_note_user", (q) => q.eq("noteId", note._id))
      .take(500);
    let helpfulCount = 0;
    let notHelpfulCount = 0;
    let myVote: "helpful" | "not" | null = null;
    for (const vote of votes) {
      if (vote.vote === "helpful") helpfulCount += 1;
      else notHelpfulCount += 1;
      if (vote.clerkUserId === me) myVote = vote.vote;
    }
    await ctx.db.patch(note._id, { helpfulCount, notHelpfulCount });
    return { helpfulCount, notHelpfulCount, myVote };
  },
});
