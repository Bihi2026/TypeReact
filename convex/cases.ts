import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { clerkOrgId, clerkUserId, requireIdentity } from "./lib/auth";
import { recordModerationEvent } from "./lib/moderation";
import { caseAudienceClerkIds, displayName, notifyMany } from "./lib/notify";
import {
  caseCategory,
  caseClaimInput,
  caseDocFields,
  reportCategory,
} from "./lib/validators";

const caseDoc = v.object({
  ...caseDocFields,
  _id: v.id("cases"),
  _creationTime: v.number(),
});

export const create = mutation({
  args: {
    title: v.string(),
    category: caseCategory,
    creatorId: v.string(),
    creatorName: v.string(),
    creatorHandle: v.string(),
    creatorVerified: v.boolean(),
    claims: v.array(caseClaimInput),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const openedByClerkId = clerkUserId(identity);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", openedByClerkId))
      .unique();

    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    if (args.claims.length === 0) throw new Error("Add at least one claim");

    const evidence: Array<{
      id: string;
      type: (typeof args.claims)[number]["evidence"][number]["type"];
      title: string;
      url: string;
    }> = [];
    const claims = args.claims.map((claim, claimIndex) => {
      const text = claim.text.trim();
      if (!text) throw new Error("Each claim needs text");
      if (claim.evidence.length === 0) {
        throw new Error("Every claim needs at least one evidence item");
      }
      const evidenceIds = claim.evidence.map((item, evidenceIndex) => {
        const evTitle = item.title.trim();
        if (!evTitle) throw new Error("Give each evidence item a title");
        const id = `c${claimIndex}-e${evidenceIndex}`;
        evidence.push({
          id,
          type: item.type,
          title: evTitle,
          url: item.url.trim(),
        });
        return id;
      });
      return {
        id: `c${claimIndex}`,
        text,
        status: "unverified" as const,
        evidenceIds,
      };
    });

    const year = new Date().getUTCFullYear();
    let code = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const n = 1000 + Math.floor(Math.random() * 9000);
      const candidate = `CASE-${year}-${String(n).padStart(4, "0")}`;
      const existing = await ctx.db
        .query("cases")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate a case code");

    const now = Date.now();
    const openedByName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";
    const summary = claims[0]?.text.slice(0, 220) || title;
    const orgClerkId = clerkOrgId(identity as unknown as Record<string, unknown>);

    await ctx.db.insert("cases", {
      code,
      title,
      summary,
      status: "under-review",
      category: args.category,
      creatorId: args.creatorId,
      creatorName: args.creatorName.trim() || "Unknown creator",
      creatorHandle: args.creatorHandle.trim() || "creator",
      creatorVerified: args.creatorVerified,
      openedByClerkId,
      openedByName,
      ...(orgClerkId ? { orgClerkId } : {}),
      openedAt: now,
      updatedAt: now,
      followers: 0,
      claims,
      evidence,
      timeline: [
        {
          id: "opened",
          date: now,
          title: "Case opened",
          description: `Submitted for review concerning ${args.creatorName.trim() || "the creator"}.`,
          type: "created",
        },
      ],
      strengths: [],
      weaknesses: [],
      contradictions: [],
      missingEvidence: [],
    });

    return { code };
  },
});

export const list = query({
  args: {},
  returns: v.array(caseDoc),
  handler: async (ctx) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(50);
  },
});

const categoryStatDoc = v.object({
  slug: v.string(),
  caseCount: v.number(),
});

export const categoryStats = query({
  args: {},
  returns: v.array(categoryStatDoc),
  handler: async (ctx) => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(50);
    const counts = new Map<string, number>();
    for (const row of cases) {
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    }
    return [...counts.entries()].map(([slug, caseCount]) => ({
      slug,
      caseCount,
    }));
  },
});

export const listByCategory = query({
  args: { category: caseCategory },
  returns: v.array(caseDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_category_updatedAt", (q) =>
        q.eq("category", args.category)
      )
      .order("desc")
      .take(50);
  },
});

export const listByCountry = query({
  args: { country: v.string() },
  returns: v.array(caseDoc),
  handler: async (ctx, args) => {
    const country = args.country.trim().toUpperCase();
    if (!country) return [];
    const [cases, creators] = await Promise.all([
      ctx.db.query("cases").withIndex("by_updatedAt").order("desc").take(50),
      ctx.db
        .query("creators")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
        .take(80),
    ]);
    const localCreatorKeys = new Set<string>();
    for (const creator of creators) {
      if (creator.country.trim().toUpperCase() !== country) continue;
      localCreatorKeys.add(creator._id);
      localCreatorKeys.add(creator.handle.toLowerCase());
      localCreatorKeys.add(creator.name.toLowerCase());
    }
    const settingsByUser = new Map<string, string>();
    const matched: Doc<"cases">[] = [];
    for (const row of cases) {
      const aboutLocal =
        localCreatorKeys.has(row.creatorId) ||
        localCreatorKeys.has(row.creatorHandle.toLowerCase());
      if (aboutLocal) {
        matched.push(row);
        continue;
      }
      if (!settingsByUser.has(row.openedByClerkId)) {
        const settings = await ctx.db
          .query("userSettings")
          .withIndex("by_user", (q) =>
            q.eq("clerkUserId", row.openedByClerkId)
          )
          .unique();
        settingsByUser.set(
          row.openedByClerkId,
          settings?.country?.trim().toUpperCase() ?? ""
        );
      }
      if (settingsByUser.get(row.openedByClerkId) === country) {
        matched.push(row);
      }
    }
    return matched;
  },
});

export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(caseDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
  },
});

const reviewStatus = v.union(
  v.literal("under-review"),
  v.literal("open"),
  v.literal("responded")
);

async function approvedCreatorFor(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
) {
  const rows = await ctx.db
    .query("creators")
    .withIndex("by_applicant", (q) => q.eq("applicantClerkId", clerkId))
    .take(20);
  return rows.find((row) => row.status === "approved") ?? null;
}

function cleanLines(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function appendTimeline(
  existing: Doc<"cases">["timeline"],
  event: Doc<"cases">["timeline"][number]
) {
  return [...existing, event];
}

export const listByStatus = query({
  args: { status: reviewStatus },
  returns: v.array(caseDoc),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await ctx.db
      .query("cases")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .take(50);
  },
});

export const listAboutCreator = query({
  args: { creatorId: v.string() },
  returns: v.array(caseDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_creatorId_updatedAt", (q) =>
        q.eq("creatorId", args.creatorId)
      )
      .order("desc")
      .take(50);
  },
});

export const listOpenedByMe = query({
  args: {},
  returns: v.array(caseDoc),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("cases")
      .withIndex("by_openedBy_updatedAt", (q) =>
        q.eq("openedByClerkId", clerkUserId(identity))
      )
      .order("desc")
      .take(50);
  },
});

export const publish = mutation({
  args: {
    caseId: v.id("cases"),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    contradictions: v.array(v.string()),
    missingEvidence: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const accountabilityCase = await ctx.db.get(args.caseId);
    if (!accountabilityCase) throw new Error("Case not found");
    if (accountabilityCase.status !== "under-review") {
      throw new Error("Only under-review cases can be published");
    }
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      status: "open",
      strengths: cleanLines(args.strengths),
      weaknesses: cleanLines(args.weaknesses),
      contradictions: cleanLines(args.contradictions),
      missingEvidence: cleanLines(args.missingEvidence),
      updatedAt: now,
      timeline: appendTimeline(accountabilityCase.timeline, {
        id: `status-${now}`,
        date: now,
        title: "Case published",
        description:
          "Moderators recorded analysis and opened the case to the public record.",
        type: "status",
      }),
    });
    const recipients = await caseAudienceClerkIds(ctx, accountabilityCase);
    await notifyMany(ctx, recipients, {
      actorClerkId: clerkUserId(identity),
      category: "evidence",
      title: `Case published: ${accountabilityCase.code}`,
      body: `${accountabilityCase.title} is now open on the public record.`,
      href: `/cases/${accountabilityCase.code}`,
    });
    const clerkId = clerkUserId(identity);
    await recordModerationEvent(ctx, {
      kind: "case_publish",
      actorClerkId: clerkId,
      actorName: await displayName(ctx, clerkId, "Admin"),
      targetLabel: accountabilityCase.code,
      note: `${accountabilityCase.title} opened on the public record.`,
    });
    return null;
  },
});

export const resolve = mutation({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const accountabilityCase = await ctx.db.get(args.caseId);
    if (!accountabilityCase) throw new Error("Case not found");
    if (
      accountabilityCase.status !== "open" &&
      accountabilityCase.status !== "responded"
    ) {
      throw new Error("Only open or responded cases can be resolved");
    }
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      status: "resolved",
      updatedAt: now,
      timeline: appendTimeline(accountabilityCase.timeline, {
        id: `status-${now}`,
        date: now,
        title: "Case resolved",
        description: "Moderators marked this case resolved.",
        type: "status",
      }),
    });
    const recipients = await caseAudienceClerkIds(ctx, accountabilityCase);
    await notifyMany(ctx, recipients, {
      actorClerkId: clerkUserId(identity),
      category: "evidence",
      title: `Case status changed: ${accountabilityCase.code}`,
      body: `${accountabilityCase.title} was marked resolved.`,
      href: `/cases/${accountabilityCase.code}`,
    });
    const clerkId = clerkUserId(identity);
    await recordModerationEvent(ctx, {
      kind: "case_resolve",
      actorClerkId: clerkId,
      actorName: await displayName(ctx, clerkId, "Admin"),
      targetLabel: accountabilityCase.code,
      note: `${accountabilityCase.title} was marked resolved.`,
    });
    return null;
  },
});

export const addCommunityNote = mutation({
  args: {
    caseId: v.id("cases"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const text = args.text.trim();
    if (!text) throw new Error("Write a community note first");
    const accountabilityCase = await ctx.db.get(args.caseId);
    if (!accountabilityCase) throw new Error("Case not found");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) =>
        q.eq("clerkId", clerkUserId(identity))
      )
      .unique();
    const authorName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";
    const now = Date.now();
    const notes = accountabilityCase.communityAnalysis ?? [];
    await ctx.db.patch(args.caseId, {
      communityAnalysis: [
        ...notes,
        {
          authorClerkId: clerkUserId(identity),
          authorName,
          text,
          postedAt: now,
        },
      ],
      updatedAt: now,
    });
    return null;
  },
});

export const respond = mutation({
  args: {
    caseId: v.id("cases"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const content = args.content.trim();
    if (!content) throw new Error("Write an official response first");
    const accountabilityCase = await ctx.db.get(args.caseId);
    if (!accountabilityCase) throw new Error("Case not found");
    if (accountabilityCase.creatorResponse) {
      throw new Error("This case already has an official response");
    }
    if (
      accountabilityCase.status !== "open" &&
      accountabilityCase.status !== "under-review"
    ) {
      throw new Error("This case is not open for a creator response");
    }
    const creator = await approvedCreatorFor(ctx, clerkUserId(identity));
    if (!creator || creator._id !== accountabilityCase.creatorId) {
      throw new Error("Only the named approved creator can respond");
    }
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      status: "responded",
      creatorResponse: {
        content,
        respondedAt: now,
        verified: true,
      },
      updatedAt: now,
      timeline: appendTimeline(accountabilityCase.timeline, {
        id: `response-${now}`,
        date: now,
        title: "Creator response received",
        description: `${creator.name} posted an official response.`,
        type: "response",
      }),
    });
    const recipients = await caseAudienceClerkIds(ctx, accountabilityCase);
    const snippet =
      content.length > 140 ? `${content.slice(0, 137)}…` : content;
    await notifyMany(ctx, recipients, {
      actorClerkId: clerkUserId(identity),
      category: "creator-response",
      title: `${creator.name} responded to ${accountabilityCase.code}`,
      body: snippet,
      href: `/cases/${accountabilityCase.code}`,
    });
    return null;
  },
});

async function caseByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("cases")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

const followStateDoc = v.object({
  followers: v.number(),
  following: v.boolean(),
});

export const followState = query({
  args: { code: v.string() },
  returns: v.union(followStateDoc, v.null()),
  handler: async (ctx, args) => {
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) return null;
    const identity = await ctx.auth.getUserIdentity();
    let following = false;
    if (identity) {
      const existing = await ctx.db
        .query("caseFollows")
        .withIndex("by_case_user", (q) =>
          q
            .eq("caseId", accountabilityCase._id)
            .eq("clerkUserId", clerkUserId(identity))
        )
        .unique();
      following = Boolean(existing);
    }
    return { followers: accountabilityCase.followers, following };
  },
});

export const toggleFollow = mutation({
  args: { code: v.string() },
  returns: followStateDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) throw new Error("Case not found");
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("caseFollows")
      .withIndex("by_case_user", (q) =>
        q.eq("caseId", accountabilityCase._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const followers = Math.max(0, accountabilityCase.followers - 1);
      await ctx.db.patch(accountabilityCase._id, { followers });
      return { followers, following: false };
    }
    await ctx.db.insert("caseFollows", {
      caseId: accountabilityCase._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    const followers = accountabilityCase.followers + 1;
    await ctx.db.patch(accountabilityCase._id, { followers });
    return { followers, following: true };
  },
});

const saveStateDoc = v.object({
  saved: v.boolean(),
});

export const saveState = query({
  args: { code: v.string() },
  returns: v.union(saveStateDoc, v.null()),
  handler: async (ctx, args) => {
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) return null;
    const identity = await ctx.auth.getUserIdentity();
    let saved = false;
    if (identity) {
      const existing = await ctx.db
        .query("caseSaves")
        .withIndex("by_case_user", (q) =>
          q
            .eq("caseId", accountabilityCase._id)
            .eq("clerkUserId", clerkUserId(identity))
        )
        .unique();
      saved = Boolean(existing);
    }
    return { saved };
  },
});

export const toggleSave = mutation({
  args: { code: v.string() },
  returns: saveStateDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) throw new Error("Case not found");
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("caseSaves")
      .withIndex("by_case_user", (q) =>
        q.eq("caseId", accountabilityCase._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("caseSaves", {
      caseId: accountabilityCase._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    return { saved: true };
  },
});

export const listMineSaved = query({
  args: {},
  returns: v.array(caseDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rows = await ctx.db
      .query("caseSaves")
      .withIndex("by_user", (q) =>
        q.eq("clerkUserId", clerkUserId(identity))
      )
      .take(50);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const row of rows) {
      const accountabilityCase = await ctx.db.get(row.caseId);
      if (accountabilityCase) result.push(accountabilityCase);
    }
    return result;
  },
});

export const submitReport = mutation({
  args: {
    code: v.string(),
    category: reportCategory,
    details: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) throw new Error("Case not found");
    await ctx.db.insert("caseReports", {
      caseId: accountabilityCase._id,
      category: args.category,
      details: args.details.trim(),
      reporterClerkId: clerkUserId(identity),
      createdAt: Date.now(),
    });
    await recordModerationEvent(ctx, {
      kind: "report",
      actorClerkId: clerkUserId(identity),
      actorName: "System",
      targetLabel: accountabilityCase.code,
      note: `Report filed: ${args.category}`,
    });
    return null;
  },
});

const caseVisitDigestDoc = v.object({
  lastVisitedAt: v.union(v.number(), v.null()),
  highlights: v.array(v.string()),
});

export const getVisitDigest = query({
  args: { code: v.string() },
  returns: v.union(caseVisitDigestDoc, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = clerkUserId(identity);
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) return null;

    const [follow, save, visit] = await Promise.all([
      ctx.db
        .query("caseFollows")
        .withIndex("by_case_user", (q) =>
          q.eq("caseId", accountabilityCase._id).eq("clerkUserId", me)
        )
        .unique(),
      ctx.db
        .query("caseSaves")
        .withIndex("by_case_user", (q) =>
          q.eq("caseId", accountabilityCase._id).eq("clerkUserId", me)
        )
        .unique(),
      ctx.db
        .query("contentVisits")
        .withIndex("by_user_target", (q) =>
          q
            .eq("clerkUserId", me)
            .eq("targetKind", "case")
            .eq("targetCode", accountabilityCase.code)
        )
        .unique(),
    ]);

    if (!follow && !save && accountabilityCase.openedByClerkId !== me) {
      return null;
    }

    const since = visit?.lastVisitedAt ?? null;
    if (since === null) {
      return { lastVisitedAt: null, highlights: [] };
    }

    const highlights: string[] = [];
    if (accountabilityCase.updatedAt > since) {
      highlights.push("Case status or file was updated");
    }
    if (
      accountabilityCase.creatorResponse &&
      accountabilityCase.creatorResponse.respondedAt > since
    ) {
      highlights.push("Official creator response added");
    }
    const newTimeline = (accountabilityCase.timeline ?? []).filter(
      (item) => item.date > since
    );
    if (newTimeline.length > 0) {
      highlights.push(
        `${newTimeline.length} new timeline event${newTimeline.length === 1 ? "" : "s"}`
      );
    }

    return { lastVisitedAt: since, highlights };
  },
});

export const markCaseVisited = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const accountabilityCase = await caseByCode(ctx, args.code);
    if (!accountabilityCase) return null;
    const existing = await ctx.db
      .query("contentVisits")
      .withIndex("by_user_target", (q) =>
        q
          .eq("clerkUserId", me)
          .eq("targetKind", "case")
          .eq("targetCode", accountabilityCase.code)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastVisitedAt: now });
    } else {
      await ctx.db.insert("contentVisits", {
        clerkUserId: me,
        targetKind: "case",
        targetCode: accountabilityCase.code,
        lastVisitedAt: now,
      });
    }
    return null;
  },
});
