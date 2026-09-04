import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { clerkUserId } from "./lib/auth";
import { slugifyMentionHandle } from "./lib/notify";

const mentionHit = v.object({
  handle: v.string(),
  name: v.string(),
  kind: v.union(
    v.literal("creator"),
    v.literal("writer"),
    v.literal("member")
  ),
  href: v.string(),
});

type MentionHit = {
  handle: string;
  name: string;
  kind: "creator" | "writer" | "member";
  href: string;
};

function matchesPrefix(hit: MentionHit, prefix: string) {
  if (!prefix) return true;
  const nameKey = hit.name.toLowerCase();
  const nameSlug = slugifyMentionHandle(hit.name);
  return (
    hit.handle.toLowerCase().startsWith(prefix) ||
    nameKey.startsWith(prefix) ||
    nameSlug.startsWith(prefix)
  );
}

async function profileHandle(
  ctx: QueryCtx,
  clerkId: string
): Promise<MentionHit | null> {
  const creators = await ctx.db
    .query("creators")
    .withIndex("by_applicant", (q) => q.eq("applicantClerkId", clerkId))
    .take(20);
  const creator = creators.find((row) => row.status === "approved");
  if (creator) {
    return {
      handle: creator.handle,
      name: creator.name,
      kind: "creator",
      href: `/creators/${creator.handle}`,
    };
  }
  const writers = await ctx.db
    .query("writers")
    .withIndex("by_applicant", (q) => q.eq("applicantClerkId", clerkId))
    .take(20);
  const writer = writers.find((row) => row.status === "approved");
  if (writer) {
    return {
      handle: writer.handle,
      name: writer.penName,
      kind: "writer",
      href: "",
    };
  }
  return null;
}

async function circleMemberHit(
  ctx: QueryCtx,
  clerkId: string
): Promise<MentionHit | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  const name = user?.name?.trim() || "Member";
  if (user?.username) {
    return {
      handle: user.username,
      name,
      kind: "member",
      href: `/profile/${user.username}`,
    };
  }
  const profile = await profileHandle(ctx, clerkId);
  if (profile) {
    return {
      ...profile,
      kind: "member",
      href: profile.href || (profile.handle ? `/profile/${profile.handle}` : ""),
    };
  }
  const handle = slugifyMentionHandle(name);
  if (!handle) return null;
  return { handle, name, kind: "member", href: "" };
}

export const search = query({
  args: {
    prefix: v.string(),
    barkCode: v.optional(v.string()),
    circleId: v.optional(v.id("researchCircles")),
  },
  returns: v.array(mentionHit),
  handler: async (ctx, args) => {
    const prefix = args.prefix.trim().toLowerCase().replace(/^@/, "");
    const hits: MentionHit[] = [];
    const seen = new Set<string>();

    const push = (hit: MentionHit) => {
      const key = hit.handle.toLowerCase();
      if (!key || seen.has(key) || !matchesPrefix(hit, prefix)) return;
      seen.add(key);
      hits.push(hit);
    };

    if (args.circleId) {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const me = clerkUserId(identity);
        const membership = await ctx.db
          .query("researchCircleMembers")
          .withIndex("by_circle_user", (q) =>
            q
              .eq("circleId", args.circleId as Id<"researchCircles">)
              .eq("clerkUserId", me)
          )
          .unique();
        if (membership) {
          const members = await ctx.db
            .query("researchCircleMembers")
            .withIndex("by_circle_user", (q) =>
              q.eq("circleId", args.circleId as Id<"researchCircles">)
            )
            .take(40);
          for (const member of members) {
            if (member.clerkUserId === me) continue;
            const hit = await circleMemberHit(ctx, member.clerkUserId);
            if (hit) push(hit);
            if (hits.length >= 20) break;
          }
        }
      }
    }

    if (args.barkCode) {
      const bark = await ctx.db
        .query("barks")
        .withIndex("by_code", (q) => q.eq("code", args.barkCode!))
        .unique();
      if (bark) {
        const comments = await ctx.db
          .query("barkComments")
          .withIndex("by_bark_created", (q) => q.eq("barkId", bark._id))
          .take(50);
        const people = new Map<string, string>();
        people.set(bark.authorClerkId, bark.authorName);
        for (const comment of comments) {
          if (!people.has(comment.authorClerkId)) {
            people.set(comment.authorClerkId, comment.authorName);
          }
        }
        for (const [clerkId, name] of people) {
          const profile = await profileHandle(ctx, clerkId);
          if (profile) {
            push(profile);
          } else {
            push({
              handle: slugifyMentionHandle(name),
              name,
              kind: "member",
              href: "",
            });
          }
        }
      }
    }

    if (hits.length < 20) {
      const creators = await ctx.db
        .query("creators")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
        .order("desc")
        .take(50);
      for (const creator of creators) {
        push({
          handle: creator.handle,
          name: creator.name,
          kind: "creator",
          href: `/creators/${creator.handle}`,
        });
        if (hits.length >= 20) break;
      }
    }

    if (hits.length < 20) {
      const writers = await ctx.db
        .query("writers")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
        .order("desc")
        .take(50);
      for (const writer of writers) {
        push({
          handle: writer.handle,
          name: writer.penName,
          kind: "writer",
          href: "",
        });
        if (hits.length >= 20) break;
      }
    }

    return hits.slice(0, 20);
  },
});
