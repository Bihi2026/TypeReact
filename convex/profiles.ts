import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";

const missingDoc = v.object({
  status: v.literal("missing"),
});

const privateDoc = v.object({
  status: v.literal("private"),
  clerkId: v.string(),
  username: v.union(v.string(), v.null()),
});

const okDoc = v.object({
  status: v.literal("ok"),
  clerkId: v.string(),
  username: v.union(v.string(), v.null()),
  name: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  bio: v.string(),
  website: v.string(),
  country: v.string(),
  showCountry: v.boolean(),
  joinedAt: v.number(),
  barkCount: v.number(),
  evidenceScore: v.number(),
  verified: v.boolean(),
  creatorHandle: v.union(v.string(), v.null()),
  creatorName: v.union(v.string(), v.null()),
  writerHandle: v.union(v.string(), v.null()),
  writerPenName: v.union(v.string(), v.null()),
});

function normalizeSlug(value: string): string {
  return value.trim().replace(/^@/, "");
}

function normalizeUsername(value: string): string {
  return normalizeSlug(value).toLowerCase();
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

const mineDoc = v.object({
  username: v.union(v.string(), v.null()),
});

export const getMine = query({
  args: {},
  returns: v.union(mineDoc, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) =>
        q.eq("clerkId", clerkUserId(identity))
      )
      .unique();
    return { username: user?.username ?? null };
  },
});

export const updateUsername = mutation({
  args: { username: v.string() },
  returns: v.object({ username: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const username = normalizeUsername(args.username);
    if (!username || !USERNAME_PATTERN.test(username)) {
      throw new Error("Use 3–30 letters, numbers, or underscores.");
    }

    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .take(1);
    if (taken[0] && taken[0].clerkId !== clerkId) {
      throw new Error("That username is taken.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { username, updatedAt: now });
    } else {
      const email =
        typeof identity.email === "string" ? identity.email : "";
      const name =
        (typeof identity.name === "string" && identity.name) || "Member";
      const imageUrl =
        typeof identity.pictureUrl === "string" && identity.pictureUrl
          ? identity.pictureUrl
          : undefined;
      await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        username,
        updatedAt: now,
        ...(imageUrl ? { imageUrl } : {}),
      });
    }
    return { username };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(missingDoc, privateDoc, okDoc),
  handler: async (ctx, args) => {
    const raw = normalizeSlug(args.slug);
    if (!raw) return { status: "missing" as const };

    const byUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", normalizeUsername(raw))
      )
      .take(1);
    const byClerkId =
      byUsername[0] ??
      (await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", raw))
        .unique());

    const user = byClerkId;
    if (!user) return { status: "missing" as const };

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity
      ? clerkUserId(identity) === user.clerkId
      : false;

    const settingsRows = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("clerkUserId", user.clerkId))
      .take(1);
    const settings = settingsRows[0];
    const publicProfile = settings?.publicProfile ?? true;
    const showCountry = settings?.showCountry ?? true;
    const username = user.username ?? null;

    if (!publicProfile && !isOwner) {
      return {
        status: "private" as const,
        clerkId: user.clerkId,
        username,
      };
    }

    const barks = await ctx.db
      .query("barks")
      .withIndex("by_author_status_publishedAt", (q) =>
        q.eq("authorClerkId", user.clerkId).eq("status", "public")
      )
      .order("desc")
      .take(50);

    const barkCount = barks.length;
    const evidenceScore =
      barkCount === 0
        ? 0
        : Math.round(
            barks.reduce((sum, bark) => sum + bark.evidenceRating, 0) /
              barkCount
          );

    const creators = await ctx.db
      .query("creators")
      .withIndex("by_applicant", (q) =>
        q.eq("applicantClerkId", user.clerkId)
      )
      .take(20);
    const creator =
      creators.find((row) => row.status === "approved") ?? null;

    const writers = await ctx.db
      .query("writers")
      .withIndex("by_applicant", (q) =>
        q.eq("applicantClerkId", user.clerkId)
      )
      .take(20);
    const writer =
      writers.find((row) => row.status === "approved") ?? null;

    return {
      status: "ok" as const,
      clerkId: user.clerkId,
      username,
      name: user.name,
      imageUrl: user.imageUrl ?? null,
      bio: settings?.bio ?? "",
      website: settings?.website ?? "",
      country: settings?.country ?? "",
      showCountry,
      joinedAt: user._creationTime,
      barkCount,
      evidenceScore,
      verified: Boolean(creator?.verified),
      creatorHandle: creator?.handle ?? null,
      creatorName: creator?.name ?? null,
      writerHandle: writer?.handle ?? null,
      writerPenName: writer?.penName ?? null,
    };
  },
});

export const searchByUsername = query({
  args: { prefix: v.string() },
  returns: v.array(
    v.object({
      username: v.string(),
      name: v.string(),
      clerkId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const prefix = args.prefix.trim().toLowerCase().replace(/^@/, "");
    const me = clerkUserId(identity);
    const rows = await ctx.db.query("users").take(200);
    const hits: { username: string; name: string; clerkId: string }[] = [];
    for (const row of rows) {
      const username = row.username?.trim();
      if (!username) continue;
      if (row.clerkId === me) continue;
      const key = username.toLowerCase();
      if (prefix && !key.startsWith(prefix) && !row.name.toLowerCase().startsWith(prefix)) {
        continue;
      }
      hits.push({
        username: key,
        name: row.name || username,
        clerkId: row.clerkId,
      });
      if (hits.length >= 10) break;
    }
    return hits;
  },
});
