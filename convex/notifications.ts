import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import {
  getPrefsRow,
  prefsOrDefault,
} from "./lib/notify";
import { notificationCategory, notificationFields } from "./lib/validators";

const notificationDoc = v.object({
  ...notificationFields,
  _id: v.id("notifications"),
  _creationTime: v.number(),
});

const prefsDoc = v.object({
  reply: v.boolean(),
  mention: v.boolean(),
  follower: v.boolean(),
  followingActivity: v.boolean(),
  creatorResponse: v.boolean(),
  evidence: v.boolean(),
  verification: v.boolean(),
  message: v.boolean(),
  circle: v.boolean(),
  soundEnabled: v.boolean(),
  digestWeekly: v.boolean(),
  digestCaseEmail: v.boolean(),
  emailEnabled: v.boolean(),
  unreadCount: v.number(),
});

const unreadDoc = v.object({
  count: v.number(),
  latestCreatedAt: v.union(v.number(), v.null()),
});

const prefsArgs = {
  reply: v.boolean(),
  mention: v.boolean(),
  follower: v.boolean(),
  followingActivity: v.boolean(),
  creatorResponse: v.boolean(),
  evidence: v.boolean(),
  verification: v.boolean(),
  message: v.boolean(),
  circle: v.boolean(),
  soundEnabled: v.boolean(),
  digestWeekly: v.boolean(),
  digestCaseEmail: v.boolean(),
  emailEnabled: v.boolean(),
};

export const listMine = query({
  args: {},
  returns: v.array(notificationDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) =>
        q.eq("recipientClerkId", clerkUserId(identity))
      )
      .order("desc")
      .take(50);
  },
});

export const listMinePage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    unreadOnly: v.optional(v.boolean()),
    category: v.optional(notificationCategory),
  },
  returns: paginationResultValidator(notificationDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const clerkId = clerkUserId(identity);
    const category = args.category;

    if (args.unreadOnly) {
      const unreadQuery = ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) =>
          q.eq("recipientClerkId", clerkId).eq("read", false)
        )
        .order("desc");
      return await (category
        ? unreadQuery.filter((q) => q.eq(q.field("category"), category))
        : unreadQuery
      ).paginate(args.paginationOpts);
    }

    const allQuery = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) =>
        q.eq("recipientClerkId", clerkId)
      )
      .order("desc");
    return await (category
      ? allQuery.filter((q) => q.eq(q.field("category"), category))
      : allQuery
    ).paginate(args.paginationOpts);
  },
});

export const unreadCount = query({
  args: {},
  returns: unreadDoc,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { count: 0, latestCreatedAt: null };
    const clerkId = clerkUserId(identity);
    const prefs = await getPrefsRow(ctx, clerkId);
    const latest = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) =>
        q.eq("recipientClerkId", clerkId)
      )
      .order("desc")
      .take(1);
    return {
      count: prefs?.unreadCount ?? 0,
      latestCreatedAt: latest[0]?.createdAt ?? null,
    };
  },
});

export const getPrefs = query({
  args: {},
  returns: v.union(prefsDoc, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkId = clerkUserId(identity);
    const row = await getPrefsRow(ctx, clerkId);
    const prefs = prefsOrDefault(clerkId, row);
    return {
      reply: prefs.reply,
      mention: prefs.mention,
      follower: prefs.follower,
      followingActivity: prefs.followingActivity ?? true,
      creatorResponse: prefs.creatorResponse,
      evidence: prefs.evidence,
      verification: prefs.verification,
      message: prefs.message,
      circle: prefs.circle,
      soundEnabled: prefs.soundEnabled,
      digestWeekly: prefs.digestWeekly,
      digestCaseEmail: prefs.digestCaseEmail,
      emailEnabled: prefs.emailEnabled,
      unreadCount: prefs.unreadCount,
    };
  },
});

export const updatePrefs = mutation({
  args: prefsArgs,
  returns: prefsDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const existing = await getPrefsRow(ctx, clerkId);
    const unreadCount = existing?.unreadCount ?? 0;
    const next = {
      clerkUserId: clerkId,
      ...args,
      unreadCount,
    };
    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert("notificationPrefs", next);
    }
    return {
      ...args,
      unreadCount,
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.recipientClerkId !== clerkUserId(identity)) {
      throw new Error("Notification not found");
    }
    if (row.read) return null;
    await ctx.db.patch(row._id, { read: true });
    const prefs = await getPrefsRow(ctx, row.recipientClerkId);
    if (prefs) {
      await ctx.db.patch(prefs._id, {
        unreadCount: Math.max(0, prefs.unreadCount - 1),
      });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("recipientClerkId", clerkId).eq("read", false)
      )
      .take(50);
    for (const row of unread) {
      await ctx.db.patch(row._id, { read: true });
    }
    const prefs = await getPrefsRow(ctx, clerkId);
    if (prefs && unread.length > 0) {
      await ctx.db.patch(prefs._id, {
        unreadCount: Math.max(0, prefs.unreadCount - unread.length),
      });
    }
    return unread.length;
  },
});
