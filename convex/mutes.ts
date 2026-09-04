import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import { caseCategory, userMuteFields } from "./lib/validators";

const muteDoc = v.object({
  ...userMuteFields,
  _id: v.id("userMutes"),
  _creationTime: v.number(),
  label: v.string(),
});

export const listMine = query({
  args: {},
  returns: v.array(muteDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rows = await ctx.db
      .query("userMutes")
      .withIndex("by_user", (q) =>
        q.eq("clerkUserId", clerkUserId(identity))
      )
      .take(100);
    const result = [];
    for (const row of rows) {
      let label = row.kind === "topic" ? String(row.topic ?? "Topic") : "Author";
      if (row.kind === "author" && row.targetClerkId) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", row.targetClerkId!))
          .unique();
        label = user?.name || row.targetClerkId;
      }
      result.push({ ...row, label });
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const authorMuteState = query({
  args: { authorClerkId: v.string() },
  returns: v.object({ muted: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { muted: false };
    const existing = await ctx.db
      .query("userMutes")
      .withIndex("by_user_author", (q) =>
        q
          .eq("clerkUserId", clerkUserId(identity))
          .eq("targetClerkId", args.authorClerkId)
      )
      .unique();
    return { muted: Boolean(existing) };
  },
});

export const topicMuteState = query({
  args: { topic: caseCategory },
  returns: v.object({ muted: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { muted: false };
    const existing = await ctx.db
      .query("userMutes")
      .withIndex("by_user_topic", (q) =>
        q.eq("clerkUserId", clerkUserId(identity)).eq("topic", args.topic)
      )
      .unique();
    return { muted: Boolean(existing) };
  },
});

export const toggleMuteAuthor = mutation({
  args: { authorClerkId: v.string() },
  returns: v.object({ muted: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const target = args.authorClerkId.trim();
    if (!target) throw new Error("Author is required");
    if (target === clerkId) throw new Error("You cannot mute yourself");
    const existing = await ctx.db
      .query("userMutes")
      .withIndex("by_user_author", (q) =>
        q.eq("clerkUserId", clerkId).eq("targetClerkId", target)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { muted: false };
    }
    await ctx.db.insert("userMutes", {
      clerkUserId: clerkId,
      kind: "author",
      targetClerkId: target,
      createdAt: Date.now(),
    });
    return { muted: true };
  },
});

export const toggleMuteTopic = mutation({
  args: { topic: caseCategory },
  returns: v.object({ muted: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("userMutes")
      .withIndex("by_user_topic", (q) =>
        q.eq("clerkUserId", clerkId).eq("topic", args.topic)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { muted: false };
    }
    await ctx.db.insert("userMutes", {
      clerkUserId: clerkId,
      kind: "topic",
      topic: args.topic,
      createdAt: Date.now(),
    });
    return { muted: true };
  },
});

export const unmute = mutation({
  args: { muteId: v.id("userMutes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(args.muteId);
    if (!row || row.clerkUserId !== clerkUserId(identity)) {
      throw new Error("Mute not found");
    }
    await ctx.db.delete(row._id);
    return null;
  },
});
