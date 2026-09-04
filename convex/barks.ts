import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { clerkOrgId, clerkUserId, requireIdentity } from "./lib/auth";
import {
  parseBodyToBlocks,
  scoreEvidenceRating,
} from "./lib/content_blocks";
import { filterMutedBarks } from "./lib/mutes";
import { recordModerationEvent } from "./lib/moderation";
import {
  barkAudienceClerkIds,
  followersOfAuthorClerkIds,
  notify,
  notifyMany,
  resolveBarkMentionRecipients,
  resolveMentionRecipients,
} from "./lib/notify";
import {
  barkCommentFields,
  barkDocFields,
  barkStatus,
  barkStickerId,
  barkType,
  caseCategory,
  evidenceItem,
  evidenceRequestFields,
  reportCategory,
  sourcePlatform,
} from "./lib/validators";

const barkDoc = v.object({
  ...barkDocFields,
  _id: v.id("barks"),
  _creationTime: v.number(),
});

const MAX_TOPICS = 5;
const TOPIC_SLUGS = [
  "racism",
  "discrimination",
  "harassment",
  "misinformation",
  "fabricated-content",
  "undisclosed-sponsorship",
  "scam",
  "plagiarism",
] as const;

function normalizeTopics(
  topics: Array<(typeof TOPIC_SLUGS)[number]>
) {
  const unique = [...new Set(topics)];
  if (unique.length > MAX_TOPICS) {
    throw new Error(`Choose at most ${MAX_TOPICS} topics`);
  }
  return unique;
}

async function syncBarkTopicLinks(
  ctx: MutationCtx,
  bark: Doc<"barks">
) {
  const existing = await ctx.db
    .query("barkTopicLinks")
    .withIndex("by_bark", (q) => q.eq("barkId", bark._id))
    .take(50);
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  for (const topic of bark.topics ?? []) {
    await ctx.db.insert("barkTopicLinks", {
      barkId: bark._id,
      topic,
      status: bark.status,
      publishedAt: bark.publishedAt,
    });
  }
}

async function withResolvedEvidence(
  ctx: QueryCtx,
  bark: Doc<"barks">
): Promise<Doc<"barks">> {
  const evidence = await Promise.all(
    bark.evidence.map(async (item) => {
      if (!item.storageId) return item;
      const fileUrl = await ctx.storage.getUrl(item.storageId);
      return { ...item, url: fileUrl ?? item.url };
    })
  );
  return { ...bark, evidence };
}

async function bindEvidenceUploads(
  ctx: MutationCtx,
  authorClerkId: string,
  evidence: Doc<"barks">["evidence"]
) {
  for (const item of evidence) {
    const storageId = item.storageId;
    if (!storageId) continue;
    const upload = await ctx.db
      .query("evidenceUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (!upload || upload.uploaderClerkId !== authorClerkId) {
      throw new Error("Evidence file is not yours");
    }
    if (!upload.bound) {
      await ctx.db.patch(upload._id, { bound: true });
    }
  }
}

async function notifyBarkPublished(
  ctx: MutationCtx,
  bark: Doc<"barks">
) {
  const mentioned = await resolveMentionRecipients(ctx, bark.body);
  const snippet =
    bark.body.length > 140 ? `${bark.body.slice(0, 137)}…` : bark.body;
  await notifyMany(
    ctx,
    mentioned.filter((id) => id !== bark.authorClerkId),
    {
      actorClerkId: bark.authorClerkId,
      category: "mention",
      title: `${bark.authorName} mentioned you`,
      body: snippet,
      href: `/barks/${bark.code}`,
    }
  );
  const followers = await followersOfAuthorClerkIds(
    ctx,
    bark.authorClerkId,
    bark.sourceCreatorId
  );
  await notifyMany(ctx, followers, {
    actorClerkId: bark.authorClerkId,
    category: "following",
    title: `${bark.authorName} published a reaction`,
    body: bark.title,
    href: `/barks/${bark.code}`,
  });
}

async function bumpCreatorOnPublicBark(
  ctx: MutationCtx,
  bark: Doc<"barks">
) {
  if (!bark.sourceCreatorId) return;
  const creator = await ctx.db.get(bark.sourceCreatorId);
  if (!creator) return;
  const priorBarks = await ctx.db
    .query("barks")
    .withIndex("by_sourceCreator_status_publishedAt", (q) =>
      q.eq("sourceCreatorId", bark.sourceCreatorId!).eq("status", "public")
    )
    .take(100);
  const sourceUrl = bark.sourceUrl.trim();
  const isNewSource = !priorBarks.some(
    (row) => row.sourceUrl.trim() === sourceUrl && row.code !== bark.code
  );
  await ctx.db.patch(bark.sourceCreatorId, {
    totalBarksReceived: creator.totalBarksReceived + 1,
    totalSources: creator.totalSources + (isNewSource ? 1 : 0),
    updatedAt: Date.now(),
  });
}

async function countryForAuthor(
  ctx: QueryCtx,
  authorClerkId: string,
  cache: Map<string, string>
) {
  if (!cache.has(authorClerkId)) {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("clerkUserId", authorClerkId))
      .unique();
    cache.set(
      authorClerkId,
      settings?.country?.trim().toUpperCase() ?? ""
    );
  }
  return cache.get(authorClerkId) ?? "";
}

async function countryForBark(
  ctx: QueryCtx,
  bark: Doc<"barks">,
  cache: Map<string, string>
) {
  const stamped = bark.country?.trim().toUpperCase() ?? "";
  if (stamped) return stamped;
  return await countryForAuthor(ctx, bark.authorClerkId, cache);
}

async function barkByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("barks")
    .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
    .unique();
}

function requirePublicBark(bark: Doc<"barks">) {
  if (bark.status !== "public") {
    throw new Error("Reaction is not public");
  }
}

export const create = mutation({
  args: {
    type: barkType,
    title: v.string(),
    body: v.string(),
    status: barkStatus,
    sourceUrl: v.string(),
    sourceTitle: v.string(),
    sourcePlatform,
    sourceCreatorName: v.string(),
    sourceCreatorId: v.optional(v.id("creators")),
    sourceThumbnailUrl: v.optional(v.string()),
    evidence: v.array(evidenceItem),
    topics: v.optional(v.array(caseCategory)),
    quotedBarkCode: v.optional(v.string()),
    claims: v.optional(
      v.array(
        v.object({
          text: v.string(),
          status: v.union(
            v.literal("supported"),
            v.literal("disputed"),
            v.literal("unverified"),
            v.literal("refuted")
          ),
          evidenceIndexes: v.array(v.number()),
        })
      )
    ),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const authorClerkId = clerkUserId(identity);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", authorClerkId))
      .unique();

    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title is required");
    if (!body) throw new Error("Body is required");
    const topics = normalizeTopics(args.topics ?? []);

    let quotedBarkCode: string | undefined;
    if (args.quotedBarkCode?.trim()) {
      const quoted = await barkByCode(ctx, args.quotedBarkCode);
      if (!quoted || quoted.status !== "public") {
        throw new Error("Quoted Reaction not found");
      }
      quotedBarkCode = quoted.code;
    }

    const year = new Date().getUTCFullYear();
    let code = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const n = 1000 + Math.floor(Math.random() * 9000);
      const candidate = `TR-${year}-${String(n).padStart(4, "0")}`;
      const existing = await ctx.db
        .query("barks")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not allocate a Reaction ID");

    const contentBlocks = parseBodyToBlocks(body, args.evidence.length);
    const excerpt = body.slice(0, 220);
    const evidenceRating = scoreEvidenceRating(args.evidence);

    await bindEvidenceUploads(ctx, authorClerkId, args.evidence);

    const authorImageUrl = user?.imageUrl ?? identity.pictureUrl;
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("clerkUserId", authorClerkId))
      .unique();
    const country = settings?.country?.trim().toUpperCase();

    let sourceCreatorId = args.sourceCreatorId;
    if (sourceCreatorId) {
      const creator = await ctx.db.get(sourceCreatorId);
      if (
        !creator ||
        (creator.status !== "approved" && creator.status !== "unclaimed")
      ) {
        throw new Error("Source creator not found");
      }
    }

    const authorName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";

    const now = Date.now();
    const barkId = await ctx.db.insert("barks", {
      code,
      type: args.type,
      title,
      body,
      excerpt,
      status: args.status,
      authorClerkId,
      authorName,
      ...(authorImageUrl ? { authorImageUrl } : {}),
      orgClerkId: clerkOrgId(identity as unknown as Record<string, unknown>),
      sourceUrl: args.sourceUrl,
      sourceTitle: args.sourceTitle,
      sourcePlatform: args.sourcePlatform,
      sourceCreatorName: args.sourceCreatorName,
      ...(sourceCreatorId ? { sourceCreatorId } : {}),
      ...(args.sourceThumbnailUrl
        ? { sourceThumbnailUrl: args.sourceThumbnailUrl }
        : {}),
      evidence: args.evidence,
      evidenceRating,
      publishedAt: now,
      replyCount: 0,
      upvotes: 0,
      saves: 0,
      views: 0,
      topics,
      contentBlocks,
      version: 1,
      ...(country ? { country } : {}),
      ...(quotedBarkCode ? { quotedBarkCode } : {}),
      ...(args.claims && args.claims.length > 0
        ? {
            claims: args.claims.map((claim, i) => ({
              id: `c${i}`,
              text: claim.text.trim(),
              status: claim.status,
              evidenceIndexes: [...new Set(claim.evidenceIndexes)].filter(
                (idx) =>
                  Number.isInteger(idx) &&
                  idx >= 0 &&
                  idx < args.evidence.length
              ),
            })),
          }
        : {}),
    });

    const bark = await ctx.db.get(barkId);
    if (bark) {
      await syncBarkTopicLinks(ctx, bark);
      if (args.status === "public") {
        await bumpCreatorOnPublicBark(ctx, bark);
        await notifyBarkPublished(ctx, bark);
      }
    }

    return { code };
  },
});

export const setTopics = mutation({
  args: {
    code: v.string(),
    topics: v.array(caseCategory),
  },
  returns: v.array(caseCategory),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code.trim().toUpperCase());
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== clerkUserId(identity)) {
      throw new Error("Only the author can edit topics");
    }
    const topics = normalizeTopics(args.topics);
    await ctx.db.patch(bark._id, { topics });
    const updated = await ctx.db.get(bark._id);
    if (updated) await syncBarkTopicLinks(ctx, updated);
    return topics;
  },
});

export const update = mutation({
  args: {
    code: v.string(),
    type: v.optional(barkType),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    sourcePlatform: v.optional(sourcePlatform),
    sourceCreatorName: v.optional(v.string()),
    sourceCreatorId: v.optional(v.id("creators")),
    sourceThumbnailUrl: v.optional(v.string()),
    evidence: v.optional(v.array(evidenceItem)),
    topics: v.optional(v.array(caseCategory)),
    quotedBarkCode: v.optional(v.union(v.string(), v.null())),
  },
  returns: barkDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can edit this reaction");
    }
    if (bark.status !== "draft") {
      throw new Error("Only drafts can be edited");
    }

    const title = args.title?.trim();
    const body = args.body?.trim();
    if (title !== undefined && !title) throw new Error("Title is required");
    if (body !== undefined && !body) throw new Error("Body is required");

    if (args.evidence) {
      await bindEvidenceUploads(ctx, me, args.evidence);
    }
    if (args.sourceCreatorId) {
      const creator = await ctx.db.get(args.sourceCreatorId);
      if (
        !creator ||
        (creator.status !== "approved" && creator.status !== "unclaimed")
      ) {
        throw new Error("Source creator not found");
      }
    }

    let quotedBarkCode: string | undefined | null = undefined;
    if (args.quotedBarkCode !== undefined) {
      if (args.quotedBarkCode === null || !args.quotedBarkCode.trim()) {
        quotedBarkCode = null;
      } else {
        const quoted = await barkByCode(ctx, args.quotedBarkCode);
        if (!quoted || quoted.status !== "public") {
          throw new Error("Quoted Reaction not found");
        }
        quotedBarkCode = quoted.code;
      }
    }

    const nextBody = body ?? bark.body;
    const nextEvidence = args.evidence ?? bark.evidence;
    const topics =
      args.topics !== undefined
        ? normalizeTopics(args.topics)
        : bark.topics;
    const contentBlocks = parseBodyToBlocks(nextBody, nextEvidence.length);

    await ctx.db.patch(bark._id, {
      ...(args.type ? { type: args.type } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(body !== undefined
        ? {
            body: nextBody,
            excerpt: nextBody.slice(0, 220),
            contentBlocks,
          }
        : args.evidence
          ? { contentBlocks }
          : {}),
      ...(args.sourceUrl !== undefined ? { sourceUrl: args.sourceUrl } : {}),
      ...(args.sourceTitle !== undefined
        ? { sourceTitle: args.sourceTitle }
        : {}),
      ...(args.sourcePlatform !== undefined
        ? { sourcePlatform: args.sourcePlatform }
        : {}),
      ...(args.sourceCreatorName !== undefined
        ? { sourceCreatorName: args.sourceCreatorName }
        : {}),
      ...(args.sourceCreatorId !== undefined
        ? { sourceCreatorId: args.sourceCreatorId }
        : {}),
      ...(args.sourceThumbnailUrl !== undefined
        ? { sourceThumbnailUrl: args.sourceThumbnailUrl }
        : {}),
      ...(args.evidence
        ? {
            evidence: nextEvidence,
            evidenceRating: scoreEvidenceRating(nextEvidence),
          }
        : {}),
      ...(topics !== undefined ? { topics } : {}),
      ...(quotedBarkCode === null
        ? { quotedBarkCode: undefined }
        : quotedBarkCode !== undefined
          ? { quotedBarkCode }
          : {}),
      publishedAt: Date.now(),
    });

    const updated = await ctx.db.get(bark._id);
    if (!updated) throw new Error("Reaction not found");
    await syncBarkTopicLinks(ctx, updated);
    return await withResolvedEvidence(ctx, updated);
  },
});

export const publishDraft = mutation({
  args: { code: v.string() },
  returns: barkDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== clerkUserId(identity)) {
      throw new Error("Only the author can publish this reaction");
    }
    if (bark.status !== "draft") {
      throw new Error("Reaction is already published");
    }
    if (!bark.title.trim() || !bark.body.trim()) {
      throw new Error("Title and body are required to publish");
    }

    const now = Date.now();
    await ctx.db.patch(bark._id, {
      status: "public",
      publishedAt: now,
    });
    const published = await ctx.db.get(bark._id);
    if (!published) throw new Error("Reaction not found");
    await syncBarkTopicLinks(ctx, published);
    await bumpCreatorOnPublicBark(ctx, published);
    await notifyBarkPublished(ctx, published);
    return await withResolvedEvidence(ctx, published);
  },
});

export const remove = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== clerkUserId(identity)) {
      throw new Error("Only the author can delete this reaction");
    }
    if (bark.status !== "draft") {
      throw new Error("Only drafts can be deleted");
    }
    const links = await ctx.db
      .query("barkTopicLinks")
      .withIndex("by_bark", (q) => q.eq("barkId", bark._id))
      .take(50);
    for (const link of links) await ctx.db.delete(link._id);
    await ctx.db.delete(bark._id);
    return null;
  },
});

export const topicStats = query({
  args: {},
  returns: v.array(
    v.object({
      topic: caseCategory,
      barkCount: v.number(),
      caseCount: v.number(),
      trending: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const caseCounts = new Map<string, number>();
    const recentCases = await ctx.db
      .query("cases")
      .withIndex("by_updatedAt", (q) => q)
      .order("desc")
      .take(200);
    for (const row of recentCases) {
      caseCounts.set(row.category, (caseCounts.get(row.category) ?? 0) + 1);
    }

    const results = [];
    for (const topic of TOPIC_SLUGS) {
      const links = await ctx.db
        .query("barkTopicLinks")
        .withIndex("by_topic_status_publishedAt", (q) =>
          q.eq("topic", topic).eq("status", "public")
        )
        .order("desc")
        .take(100);
      const barkCount = links.length;
      const caseCount = caseCounts.get(topic) ?? 0;
      results.push({
        topic,
        barkCount,
        caseCount,
        trending: barkCount >= 3,
      });
    }
    return results.sort((a, b) => b.barkCount - a.barkCount);
  },
});

export const listPublicByTopicPage = query({
  args: {
    topic: caseCategory,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(barkDoc),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("barkTopicLinks")
      .withIndex("by_topic_status_publishedAt", (q) =>
        q.eq("topic", args.topic).eq("status", "public")
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const docs: Doc<"barks">[] = [];
    for (const link of page.page) {
      const bark = await ctx.db.get(link.barkId);
      if (!bark || bark.status !== "public") continue;
      docs.push(await withResolvedEvidence(ctx, bark));
    }
    return { ...page, page: docs };
  },
});

export const listPublicPage = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(barkDoc),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map((bark) => withResolvedEvidence(ctx, bark))
      ),
    };
  },
});

export const listPublic = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = identity ? clerkUserId(identity) : null;
    const fetchLimit = clerkId ? Math.min(limit * 3, 150) : limit;
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .take(fetchLimit);
    const filtered = await filterMutedBarks(ctx, clerkId, barks);
    const sliced = filtered.slice(0, limit);
    return await Promise.all(
      sliced.map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

export const listPublicByTopic = query({
  args: { topic: caseCategory, limit: v.optional(v.number()) },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = identity ? clerkUserId(identity) : null;
    const fetchLimit = clerkId ? Math.min(limit * 3, 150) : limit;
    const links = await ctx.db
      .query("barkTopicLinks")
      .withIndex("by_topic_status_publishedAt", (q) =>
        q.eq("topic", args.topic).eq("status", "public")
      )
      .order("desc")
      .take(fetchLimit);
    const result: Doc<"barks">[] = [];
    for (const link of links) {
      const bark = await ctx.db.get(link.barkId);
      if (!bark || bark.status !== "public") continue;
      result.push(bark);
    }
    const filtered = await filterMutedBarks(ctx, clerkId, result);
    return await Promise.all(
      filtered
        .slice(0, limit)
        .map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

export const listBySourceCreator = query({
  args: { creatorId: v.id("creators") },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_sourceCreator_status_publishedAt", (q) =>
        q.eq("sourceCreatorId", args.creatorId).eq("status", "public")
      )
      .order("desc")
      .take(50);
    return await Promise.all(
      barks.map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

const countryStatDoc = v.object({
  code: v.string(),
  barkCount: v.number(),
  activeDiscussions: v.number(),
});

export const countryStats = query({
  args: {},
  returns: v.array(countryStatDoc),
  handler: async (ctx) => {
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .take(200);

    const settingsByAuthor = new Map<string, string>();
    const counts = new Map<
      string,
      { barkCount: number; activeDiscussions: number }
    >();

    for (const bark of barks) {
      const code = await countryForBark(ctx, bark, settingsByAuthor);
      if (!code) continue;
      const row = counts.get(code) ?? { barkCount: 0, activeDiscussions: 0 };
      row.barkCount += 1;
      if (bark.replyCount > 0) row.activeDiscussions += 1;
      counts.set(code, row);
    }

    return [...counts.entries()].map(([code, stats]) => ({
      code,
      barkCount: stats.barkCount,
      activeDiscussions: stats.activeDiscussions,
    }));
  },
});

export const listPublicByCountry = query({
  args: { country: v.string() },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const country = args.country.trim().toUpperCase();
    if (!country) return [];
    const stamped = await ctx.db
      .query("barks")
      .withIndex("by_status_country", (q) =>
        q.eq("status", "public").eq("country", country)
      )
      .take(50);
    if (stamped.length > 0) {
      return await Promise.all(
        stamped
          .sort((a, b) => b.publishedAt - a.publishedAt)
          .map((bark) => withResolvedEvidence(ctx, bark))
      );
    }
    // Legacy rows without country stamp: fall back to author settings.
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .take(200);
    const settingsByAuthor = new Map<string, string>();
    const matched: Doc<"barks">[] = [];
    for (const bark of barks) {
      const code = await countryForBark(ctx, bark, settingsByAuthor);
      if (code !== country) continue;
      matched.push({ ...bark, country });
      if (matched.length >= 50) break;
    }
    return await Promise.all(
      matched.map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

const publicSourceDoc = v.object({
  sourceUrl: v.string(),
  sourceTitle: v.string(),
  sourcePlatform,
  sourceCreatorName: v.string(),
  sourceThumbnailUrl: v.union(v.string(), v.null()),
  barkCount: v.number(),
  replyCount: v.number(),
  evidenceRating: v.number(),
  engagement: v.number(),
  publishedAt: v.number(),
});

export const listPublicSources = query({
  args: {},
  returns: v.array(publicSourceDoc),
  handler: async (ctx) => {
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .take(80);

    const grouped = new Map<
      string,
      {
        sourceUrl: string;
        sourceTitle: string;
        sourcePlatform: (typeof barks)[number]["sourcePlatform"];
        sourceCreatorName: string;
        sourceThumbnailUrl: string | null;
        barkCount: number;
        replyCount: number;
        evidenceSum: number;
        engagement: number;
        publishedAt: number;
      }
    >();

    for (const bark of barks) {
      const sourceUrl = bark.sourceUrl.trim();
      if (!sourceUrl) continue;
      const engagement = bark.views + bark.upvotes + bark.saves;
      const existing = grouped.get(sourceUrl);
      if (!existing) {
        grouped.set(sourceUrl, {
          sourceUrl,
          sourceTitle: bark.sourceTitle,
          sourcePlatform: bark.sourcePlatform,
          sourceCreatorName: bark.sourceCreatorName,
          sourceThumbnailUrl: bark.sourceThumbnailUrl ?? null,
          barkCount: 1,
          replyCount: bark.replyCount,
          evidenceSum: bark.evidenceRating,
          engagement,
          publishedAt: bark.publishedAt,
        });
        continue;
      }
      existing.barkCount += 1;
      existing.replyCount += bark.replyCount;
      existing.evidenceSum += bark.evidenceRating;
      existing.engagement += engagement;
    }

    return [...grouped.values()]
      .map((row) => ({
        sourceUrl: row.sourceUrl,
        sourceTitle: row.sourceTitle,
        sourcePlatform: row.sourcePlatform,
        sourceCreatorName: row.sourceCreatorName,
        sourceThumbnailUrl: row.sourceThumbnailUrl,
        barkCount: row.barkCount,
        replyCount: row.replyCount,
        evidenceRating: Math.round(row.evidenceSum / row.barkCount),
        engagement: row.engagement,
        publishedAt: row.publishedAt,
      }))
      .sort((a, b) => {
        if (b.barkCount !== a.barkCount) return b.barkCount - a.barkCount;
        return b.engagement - a.engagement;
      })
      .slice(0, 24);
  },
});

export const listMine = query({
  args: {
    status: v.optional(barkStatus),
  },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const authorClerkId = clerkUserId(identity);
    if (args.status) {
      const barks = await ctx.db
        .query("barks")
        .withIndex("by_author_status_publishedAt", (q) =>
          q.eq("authorClerkId", authorClerkId).eq("status", args.status!)
        )
        .order("desc")
        .take(50);
      return await Promise.all(
        barks.map((bark) => withResolvedEvidence(ctx, bark))
      );
    }
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_author", (q) => q.eq("authorClerkId", authorClerkId))
      .take(100);
    barks.sort((a, b) => b.publishedAt - a.publishedAt);
    return await Promise.all(
      barks.slice(0, 50).map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

export const listPublicByAuthor = query({
  args: { authorClerkId: v.string() },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    if (!args.authorClerkId) return [];
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_author_status_publishedAt", (q) =>
        q.eq("authorClerkId", args.authorClerkId).eq("status", "public")
      )
      .order("desc")
      .take(50);
    return await Promise.all(
      barks.map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

function barkMatchesCreator(
  bark: Doc<"barks">,
  creator: { _id: Id<"creators">; name: string; handle: string }
) {
  if (bark.sourceCreatorId === creator._id) return true;
  const name = bark.sourceCreatorName.toLowerCase();
  const handleKey = creator.handle.toLowerCase();
  return (
    bark.sourceCreatorName === creator.name ||
    name === handleKey ||
    name === creator.name.toLowerCase()
  );
}

export const listFollowing = query({
  args: {
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(barkDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const clerkId = clerkUserId(identity);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 50);
    const before = args.before ?? Number.MAX_SAFE_INTEGER;

    const [authorFollows, creatorFollows] = await Promise.all([
      ctx.db
        .query("userFollows")
        .withIndex("by_user", (q) => q.eq("clerkUserId", clerkId))
        .take(20),
      ctx.db
        .query("creatorFollows")
        .withIndex("by_user", (q) => q.eq("clerkUserId", clerkId))
        .take(20),
    ]);

    const byId = new Map<Id<"barks">, Doc<"barks">>();
    const authorIds = authorFollows.slice(0, 12).map((row) => row.targetClerkId);
    for (const authorClerkId of authorIds) {
      const rows = await ctx.db
        .query("barks")
        .withIndex("by_author_status_publishedAt", (q) =>
          q.eq("authorClerkId", authorClerkId).eq("status", "public")
        )
        .order("desc")
        .take(8);
      for (const row of rows) {
        if (row.publishedAt < before) byId.set(row._id, row);
      }
    }

    for (const follow of creatorFollows.slice(0, 12)) {
      const rows = await ctx.db
        .query("barks")
        .withIndex("by_sourceCreator_status_publishedAt", (q) =>
          q.eq("sourceCreatorId", follow.creatorId).eq("status", "public")
        )
        .order("desc")
        .take(8);
      for (const row of rows) {
        if (row.publishedAt < before) byId.set(row._id, row);
      }
      // Legacy rows without sourceCreatorId.
      if (rows.length === 0) {
        const creator = await ctx.db.get(follow.creatorId);
        if (!creator) continue;
        const recent = await ctx.db
          .query("barks")
          .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
          .order("desc")
          .take(40);
        for (const bark of recent) {
          if (
            bark.publishedAt < before &&
            barkMatchesCreator(bark, creator)
          ) {
            byId.set(bark._id, bark);
          }
        }
      }
    }

    const merged = [...byId.values()]
      .sort((a, b) => b.publishedAt - a.publishedAt);
    const filtered = await filterMutedBarks(ctx, clerkId, merged);
    const page = filtered.slice(0, limit);
    return await Promise.all(
      page.map((bark) => withResolvedEvidence(ctx, bark))
    );
  },
});

export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(barkDoc, v.null()),
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!code) return null;
    const bark = await ctx.db
      .query("barks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!bark) return null;
    if (bark.status !== "public") {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || bark.authorClerkId !== clerkUserId(identity)) {
        return null;
      }
    }
    return await withResolvedEvidence(ctx, bark);
  },
});

const quotedBarkPreview = v.object({
  code: v.string(),
  title: v.string(),
  excerpt: v.string(),
  authorName: v.string(),
  type: barkType,
  evidenceRating: v.number(),
});

export const getQuotedPreview = query({
  args: { code: v.string() },
  returns: v.union(quotedBarkPreview, v.null()),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return null;
    return {
      code: bark.code,
      title: bark.title,
      excerpt: bark.excerpt,
      authorName: bark.authorName,
      type: bark.type,
      evidenceRating: bark.evidenceRating,
    };
  },
});

const likeStateDoc = v.object({
  upvotes: v.number(),
  liked: v.boolean(),
});

const commentDoc = v.object({
  ...barkCommentFields,
  _id: v.id("barkComments"),
  _creationTime: v.number(),
  voiceUrl: v.union(v.string(), v.null()),
});

export const likeState = query({
  args: { code: v.string() },
  returns: v.union(likeStateDoc, v.null()),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark) return null;
    const identity = await ctx.auth.getUserIdentity();
    let liked = false;
    if (identity) {
      const existing = await ctx.db
        .query("barkLikes")
        .withIndex("by_bark_user", (q) =>
          q.eq("barkId", bark._id).eq("clerkUserId", clerkUserId(identity))
        )
        .unique();
      liked = Boolean(existing);
    }
    return { upvotes: bark.upvotes, liked };
  },
});

export const toggleLike = mutation({
  args: { code: v.string() },
  returns: likeStateDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("barkLikes")
      .withIndex("by_bark_user", (q) =>
        q.eq("barkId", bark._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const upvotes = Math.max(0, bark.upvotes - 1);
      await ctx.db.patch(bark._id, { upvotes });
      return { upvotes, liked: false };
    }
    await ctx.db.insert("barkLikes", {
      barkId: bark._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    const upvotes = bark.upvotes + 1;
    await ctx.db.patch(bark._id, { upvotes });
    return { upvotes, liked: true };
  },
});

const saveStateDoc = v.object({
  saved: v.boolean(),
  saves: v.number(),
});

export const saveState = query({
  args: { code: v.string() },
  returns: v.union(saveStateDoc, v.null()),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark) return null;
    const identity = await ctx.auth.getUserIdentity();
    let saved = false;
    if (identity) {
      const existing = await ctx.db
        .query("barkSaves")
        .withIndex("by_bark_user", (q) =>
          q.eq("barkId", bark._id).eq("clerkUserId", clerkUserId(identity))
        )
        .unique();
      saved = Boolean(existing);
    }
    return { saved, saves: bark.saves };
  },
});

export const toggleSave = mutation({
  args: {
    code: v.string(),
    collectionId: v.optional(v.id("saveCollections")),
    note: v.optional(v.string()),
  },
  returns: saveStateDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("barkSaves")
      .withIndex("by_bark_user", (q) =>
        q.eq("barkId", bark._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const saves = Math.max(0, bark.saves - 1);
      await ctx.db.patch(bark._id, { saves });
      return { saved: false, saves };
    }
    if (args.collectionId) {
      const collection = await ctx.db.get(args.collectionId);
      if (!collection || collection.clerkUserId !== clerkId) {
        throw new Error("Collection not found");
      }
    }
    const note = args.note?.trim();
    await ctx.db.insert("barkSaves", {
      barkId: bark._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
      ...(args.collectionId ? { collectionId: args.collectionId } : {}),
      ...(note ? { note } : {}),
    });
    const saves = bark.saves + 1;
    await ctx.db.patch(bark._id, { saves });
    return { saved: true, saves };
  },
});

const savedLibraryItem = v.object({
  bark: barkDoc,
  saveId: v.id("barkSaves"),
  note: v.optional(v.string()),
  collectionId: v.optional(v.id("saveCollections")),
  savedAt: v.number(),
});

export const listMineSaved = query({
  args: {},
  returns: v.array(barkDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rows = await ctx.db
      .query("barkSaves")
      .withIndex("by_user", (q) =>
        q.eq("clerkUserId", clerkUserId(identity))
      )
      .take(50);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const row of rows) {
      const bark = await ctx.db.get(row.barkId);
      if (bark && bark.status === "public") {
        result.push(await withResolvedEvidence(ctx, bark));
      }
    }
    return result;
  },
});

export const listMineSavedLibrary = query({
  args: {
    collectionId: v.optional(v.union(v.id("saveCollections"), v.null())),
  },
  returns: v.array(savedLibraryItem),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const clerkId = clerkUserId(identity);
    const rows = await ctx.db
      .query("barkSaves")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkId))
      .take(100);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const result = [];
    for (const row of rows) {
      if (args.collectionId === null) {
        if (row.collectionId) continue;
      } else if (args.collectionId !== undefined) {
        if (row.collectionId !== args.collectionId) continue;
      }
      const bark = await ctx.db.get(row.barkId);
      if (!bark || bark.status !== "public") continue;
      result.push({
        bark: await withResolvedEvidence(ctx, bark),
        saveId: row._id,
        note: row.note,
        collectionId: row.collectionId,
        savedAt: row.createdAt,
      });
    }
    return result;
  },
});

const collectionDoc = v.object({
  _id: v.id("saveCollections"),
  _creationTime: v.number(),
  clerkUserId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  count: v.number(),
});

export const listSaveCollections = query({
  args: {},
  returns: v.array(collectionDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const clerkId = clerkUserId(identity);
    const collections = await ctx.db
      .query("saveCollections")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkId))
      .take(40);
    collections.sort((a, b) => a.name.localeCompare(b.name));
    const result = [];
    for (const collection of collections) {
      const saves = await ctx.db
        .query("barkSaves")
        .withIndex("by_user_collection", (q) =>
          q.eq("clerkUserId", clerkId).eq("collectionId", collection._id)
        )
        .take(200);
      result.push({
        ...collection,
        count: saves.length,
      });
    }
    return result;
  },
});

export const createSaveCollection = mutation({
  args: { name: v.string() },
  returns: v.id("saveCollections"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const name = args.name.trim();
    if (!name) throw new Error("Collection name is required");
    if (name.length > 60) throw new Error("Name is too long");
    const existing = await ctx.db
      .query("saveCollections")
      .withIndex("by_user_name", (q) =>
        q.eq("clerkUserId", clerkId).eq("name", name)
      )
      .unique();
    if (existing) throw new Error("A collection with that name already exists");
    return await ctx.db.insert("saveCollections", {
      clerkUserId: clerkId,
      name,
      createdAt: Date.now(),
    });
  },
});

export const renameSaveCollection = mutation({
  args: {
    collectionId: v.id("saveCollections"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.clerkUserId !== clerkId) {
      throw new Error("Collection not found");
    }
    const name = args.name.trim();
    if (!name) throw new Error("Collection name is required");
    if (name.length > 60) throw new Error("Name is too long");
    await ctx.db.patch(collection._id, { name });
    return null;
  },
});

export const deleteSaveCollection = mutation({
  args: { collectionId: v.id("saveCollections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkId = clerkUserId(identity);
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.clerkUserId !== clerkId) {
      throw new Error("Collection not found");
    }
    const saves = await ctx.db
      .query("barkSaves")
      .withIndex("by_user_collection", (q) =>
        q.eq("clerkUserId", clerkId).eq("collectionId", collection._id)
      )
      .take(200);
    for (const save of saves) {
      await ctx.db.patch(save._id, { collectionId: undefined });
    }
    await ctx.db.delete(collection._id);
    return null;
  },
});

export const updateSaveMeta = mutation({
  args: {
    code: v.string(),
    collectionId: v.optional(v.union(v.id("saveCollections"), v.null())),
    note: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("barkSaves")
      .withIndex("by_bark_user", (q) =>
        q.eq("barkId", bark._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (!existing) throw new Error("Reaction is not saved");

    const patch: {
      collectionId?: Id<"saveCollections"> | undefined;
      note?: string | undefined;
    } = {};

    if (args.collectionId !== undefined) {
      if (args.collectionId === null) {
        patch.collectionId = undefined;
      } else {
        const collection = await ctx.db.get(args.collectionId);
        if (!collection || collection.clerkUserId !== clerkId) {
          throw new Error("Collection not found");
        }
        patch.collectionId = args.collectionId;
      }
    }

    if (args.note !== undefined) {
      if (args.note === null || !args.note.trim()) {
        patch.note = undefined;
      } else {
        const note = args.note.trim();
        if (note.length > 500) throw new Error("Note is too long");
        patch.note = note;
      }
    }

    await ctx.db.patch(existing._id, patch);
    return null;
  },
});

const commentSort = v.union(
  v.literal("newest"),
  v.literal("evidenced"),
  v.literal("op")
);

function evidenceSignal(body: string): number {
  const urls = body.match(/https?:\/\/\S+/gi)?.length ?? 0;
  const markers = body.match(/\[\[ev:\d+\]\]/gi)?.length ?? 0;
  const citeWords = /\b(source|evidence|citation|according to)\b/i.test(body)
    ? 1
    : 0;
  return urls * 3 + markers * 4 + citeWords;
}

export const listComments = query({
  args: {
    code: v.string(),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
    offset: v.optional(v.number()),
    sort: v.optional(commentSort),
  },
  returns: v.object({
    comments: v.array(commentDoc),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark) return { comments: [], hasMore: false };

    const limit = Math.min(Math.max(args.limit ?? 5, 1), 30);
    const sort = args.sort ?? "newest";
    const before = args.before;
    const offset = Math.max(0, args.offset ?? 0);
    const scan = await ctx.db
      .query("barkComments")
      .withIndex("by_bark_created", (q) => q.eq("barkId", bark._id))
      .order("desc")
      .take(400);

    const allTop = scan.filter((row) => !row.parentId);
    const childCount = new Map<string, number>();
    for (const row of scan) {
      if (!row.parentId) continue;
      childCount.set(
        row.parentId,
        (childCount.get(row.parentId) ?? 0) + 1
      );
    }

    let orderedTop: Doc<"barkComments">[];
    if (sort === "evidenced") {
      orderedTop = [...allTop].sort((a, b) => {
        const scoreA =
          evidenceSignal(a.body) + (childCount.get(a._id) ?? 0) * 2;
        const scoreB =
          evidenceSignal(b.body) + (childCount.get(b._id) ?? 0) * 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.createdAt - a.createdAt;
      });
    } else if (sort === "op") {
      orderedTop = [...allTop].sort((a, b) => {
        const aOp = a.authorClerkId === bark.authorClerkId ? 1 : 0;
        const bOp = b.authorClerkId === bark.authorClerkId ? 1 : 0;
        if (bOp !== aOp) return bOp - aOp;
        return b.createdAt - a.createdAt;
      });
    } else {
      orderedTop = [...allTop].sort((a, b) => b.createdAt - a.createdAt);
    }

    let topLevelPage: Doc<"barkComments">[] = [];
    let hasMore = false;
    if (sort === "newest" && before !== undefined) {
      for (const row of orderedTop) {
        if (row.createdAt >= before) continue;
        if (topLevelPage.length < limit) {
          topLevelPage.push(row);
        } else {
          hasMore = true;
          break;
        }
      }
    } else {
      topLevelPage = orderedTop.slice(offset, offset + limit);
      hasMore = offset + limit < orderedTop.length;
    }

    const topIds = new Set(topLevelPage.map((row) => row._id));
    const children = scan.filter(
      (row) => row.parentId !== undefined && topIds.has(row.parentId)
    );
    const selected =
      sort === "newest"
        ? [...topLevelPage, ...children].sort(
            (a, b) => a.createdAt - b.createdAt
          )
        : [
            ...topLevelPage,
            ...[...children].sort((a, b) => a.createdAt - b.createdAt),
          ];

    const comments = [];
    for (const row of selected) {
      const voiceUrl = row.voiceStorageId
        ? await ctx.storage.getUrl(row.voiceStorageId)
        : null;
      comments.push({ ...row, voiceUrl: voiceUrl ?? null });
    }
    return { comments, hasMore };
  },
});

export const addComment = mutation({
  args: {
    code: v.string(),
    body: v.string(),
    parentId: v.optional(v.id("barkComments")),
    stickerId: v.optional(barkStickerId),
    voiceStorageId: v.optional(v.id("_storage")),
    voiceDurationMs: v.optional(v.number()),
  },
  returns: v.id("barkComments"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    const body = args.body.trim();
    if (args.voiceStorageId && args.voiceDurationMs === undefined) {
      throw new Error("Voice duration is required");
    }
    if (
      args.voiceDurationMs !== undefined &&
      (args.voiceDurationMs < 1 || args.voiceDurationMs > 60_000)
    ) {
      throw new Error("Voice notes must be 60 seconds or shorter");
    }
    if (!body && !args.stickerId && !args.voiceStorageId) {
      throw new Error("Write a comment, send a sticker, or record a voice note");
    }
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.barkId !== bark._id) {
        throw new Error("Reply target not found");
      }
      if (parent.parentId) {
        throw new Error("Replies can only be one level deep");
      }
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId(identity)))
      .unique();
    const authorImageUrl = user?.imageUrl ?? identity.pictureUrl;
    const authorClerkId = clerkUserId(identity);
    const authorName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";
    const commentId = await ctx.db.insert("barkComments", {
      barkId: bark._id,
      ...(args.parentId ? { parentId: args.parentId } : {}),
      body,
      authorClerkId,
      authorName,
      ...(authorImageUrl ? { authorImageUrl } : {}),
      ...(args.stickerId ? { stickerId: args.stickerId } : {}),
      ...(args.voiceStorageId
        ? {
            voiceStorageId: args.voiceStorageId,
            voiceDurationMs: args.voiceDurationMs,
          }
        : {}),
      createdAt: Date.now(),
    });
    await ctx.db.patch(bark._id, { replyCount: bark.replyCount + 1 });
    const href = `/barks/${bark.code}`;
    const snippet = body
      ? body.length > 140
        ? `${body.slice(0, 137)}…`
        : body
      : args.stickerId
        ? "Sent a sticker"
        : "Sent a voice note";
    const replyTargets = new Set<string>([bark.authorClerkId]);
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) replyTargets.add(parent.authorClerkId);
    }
    await notifyMany(ctx, [...replyTargets], {
      actorClerkId: authorClerkId,
      category: "reply",
      title: `${authorName} replied to your reaction`,
      body: snippet,
      href,
    });
    const mentioned = await resolveBarkMentionRecipients(ctx, bark, body);
    await notifyMany(ctx, mentioned, {
      actorClerkId: authorClerkId,
      category: "mention",
      title: `${authorName} mentioned you`,
      body: snippet,
      href,
    });
    return commentId;
  },
});

export const submitReport = mutation({
  args: {
    code: v.string(),
    targetKind: v.union(v.literal("bark"), v.literal("comment")),
    targetId: v.string(),
    category: reportCategory,
    details: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    if (args.targetKind === "comment") {
      const comment = await ctx.db.get(args.targetId as Id<"barkComments">);
      if (!comment || comment.barkId !== bark._id) {
        throw new Error("Comment not found");
      }
    }
    const targetLabel =
      args.targetKind === "comment" ? `${bark.code} comment` : bark.code;
    await ctx.db.insert("barkReports", {
      barkId: bark._id,
      targetKind: args.targetKind,
      targetId: args.targetId,
      category: args.category,
      details: args.details.trim(),
      reporterClerkId: clerkUserId(identity),
      createdAt: Date.now(),
    });
    await recordModerationEvent(ctx, {
      kind: "report",
      actorClerkId: clerkUserId(identity),
      actorName: "System",
      targetLabel,
      note: `Report filed: ${args.category}`,
    });
    return null;
  },
});

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

export const respondOfficially = mutation({
  args: {
    code: v.string(),
    content: v.string(),
    evidence: v.optional(v.array(evidenceItem)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const content = args.content.trim();
    if (!content) throw new Error("Write an official response first");

    const bark = await barkByCode(ctx, args.code.trim().toUpperCase());
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (!bark.sourceCreatorId) {
      throw new Error("This reaction is not linked to a creator profile");
    }

    const creator = await approvedCreatorFor(ctx, me);
    if (!creator || creator._id !== bark.sourceCreatorId) {
      throw new Error("Only the named approved creator can respond");
    }

    const dialogue = [...(bark.creatorDialogue ?? [])];
    if (
      dialogue.length === 0 &&
      bark.creatorResponse &&
      !bark.creatorDialogue
    ) {
      dialogue.push({
        role: "creator",
        content: bark.creatorResponse.content,
        respondedAt: bark.creatorResponse.respondedAt,
        verified: bark.creatorResponse.verified,
      });
    }
    if (dialogue.length >= 8) {
      throw new Error("This dialogue has reached the round limit");
    }
    const last = dialogue[dialogue.length - 1];
    if (last?.role === "creator") {
      throw new Error("Wait for the author to reply before another round");
    }

    const evidence = args.evidence ?? [];
    if (evidence.length > 0) {
      await bindEvidenceUploads(ctx, me, evidence);
    }

    const now = Date.now();
    const turn = {
      role: "creator" as const,
      content,
      respondedAt: now,
      verified: true,
      ...(evidence.length > 0 ? { evidence } : {}),
    };
    dialogue.push(turn);

    const isFirst = !bark.creatorResponse;
    await ctx.db.patch(bark._id, {
      creatorResponse: isFirst
        ? { content, respondedAt: now, verified: true }
        : bark.creatorResponse,
      creatorDialogue: dialogue,
    });

    if (isFirst) {
      const newCount = (creator.officialResponseCount ?? 0) + 1;
      const responseRate =
        creator.totalBarksReceived > 0
          ? Math.min(
              100,
              Math.round((newCount / creator.totalBarksReceived) * 100)
            )
          : creator.responseRate;
      await ctx.db.patch(creator._id, {
        officialResponseCount: newCount,
        responseRate,
        updatedAt: now,
      });
    }

    const snippet =
      content.length > 140 ? `${content.slice(0, 137)}…` : content;
    const audience = await barkAudienceClerkIds(ctx, bark);
    await notifyMany(ctx, audience, {
      actorClerkId: me,
      category: "creator-response",
      title: `${creator.name} responded to ${bark.code}`,
      body: snippet,
      href: `/barks/${bark.code}`,
    });
    return null;
  },
});

export const replyToCreator = mutation({
  args: {
    code: v.string(),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const content = args.content.trim();
    if (!content) throw new Error("Write a reply first");
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can reply in this dialogue");
    }
    const dialogue = [...(bark.creatorDialogue ?? [])];
    if (
      dialogue.length === 0 &&
      bark.creatorResponse &&
      !bark.creatorDialogue
    ) {
      dialogue.push({
        role: "creator",
        content: bark.creatorResponse.content,
        respondedAt: bark.creatorResponse.respondedAt,
        verified: bark.creatorResponse.verified,
      });
    }
    if (dialogue.length === 0) {
      throw new Error("No official creator response to reply to yet");
    }
    if (dialogue.length >= 8) {
      throw new Error("This dialogue has reached the round limit");
    }
    const last = dialogue[dialogue.length - 1];
    if (last.role !== "creator") {
      throw new Error("Wait for the creator before another author reply");
    }
    dialogue.push({
      role: "author",
      content,
      respondedAt: Date.now(),
      verified: false,
    });
    await ctx.db.patch(bark._id, { creatorDialogue: dialogue });
    if (bark.sourceCreatorId) {
      const creator = await ctx.db.get(bark.sourceCreatorId);
      if (creator?.applicantClerkId) {
        await notifyMany(ctx, [creator.applicantClerkId], {
          actorClerkId: me,
          category: "creator-response",
          title: `${bark.authorName} replied on ${bark.code}`,
          body:
            content.length > 140 ? `${content.slice(0, 137)}…` : content,
          href: `/barks/${bark.code}`,
        });
      }
    }
    return null;
  },
});

export const amend = mutation({
  args: {
    code: v.string(),
    title: v.string(),
    body: v.string(),
    changeNote: v.string(),
    evidence: v.optional(v.array(evidenceItem)),
  },
  returns: barkDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can amend this reaction");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    const changeNote = args.changeNote.trim();
    if (!title || !body) throw new Error("Title and body are required");
    if (!changeNote) throw new Error("Describe what changed");

    const evidence = args.evidence ?? bark.evidence;
    if (args.evidence) await bindEvidenceUploads(ctx, me, evidence);
    const contentBlocks = parseBodyToBlocks(body, evidence.length);
    const version = bark.version ?? 1;
    const now = Date.now();

    await ctx.db.insert("barkVersions", {
      barkId: bark._id,
      version,
      title: bark.title,
      body: bark.body,
      excerpt: bark.excerpt,
      contentBlocks: bark.contentBlocks,
      changeNote: version === 1 ? "Original published version" : `Superseded: ${changeNote}`,
      authorClerkId: me,
      createdAt: now,
    });

    await ctx.db.patch(bark._id, {
      title,
      body,
      excerpt: body.slice(0, 220),
      evidence,
      evidenceRating: scoreEvidenceRating(evidence),
      contentBlocks,
      version: version + 1,
      amendedAt: now,
    });

    const updated = await ctx.db.get(bark._id);
    if (!updated) throw new Error("Reaction not found");
    const audience = await barkAudienceClerkIds(ctx, updated);
    await notifyMany(ctx, audience, {
      actorClerkId: me,
      category: "evidence",
      title: `${bark.authorName} amended ${bark.code}`,
      body: changeNote,
      href: `/barks/${bark.code}`,
    });

    if ((args.evidence?.length ?? 0) > bark.evidence.length) {
      const openRequests = await ctx.db
        .query("evidenceRequests")
        .withIndex("by_bark_status", (q) =>
          q.eq("barkId", bark._id).eq("status", "open")
        )
        .take(40);
      for (const req of openRequests) {
        await ctx.db.patch(req._id, {
          status: "resolved",
          resolvedAt: now,
          resolvedByClerkId: me,
        });
        await notify(ctx, {
          recipientClerkId: req.requesterClerkId,
          actorClerkId: me,
          category: "evidence",
          title: `Evidence added on ${bark.code}`,
          body: `Your request on “${req.claimSnippet.slice(0, 80)}” was addressed.`,
          href: `/barks/${bark.code}#${req.blockHash}`,
        });
      }
    }

    return await withResolvedEvidence(ctx, updated);
  },
});

export const listVersions = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      version: v.number(),
      changeNote: v.string(),
      createdAt: v.number(),
      title: v.string(),
      excerpt: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return [];
    const rows = await ctx.db
      .query("barkVersions")
      .withIndex("by_bark", (q) => q.eq("barkId", bark._id))
      .take(50);
    return rows
      .sort((a, b) => b.version - a.version)
      .map((row) => ({
        version: row.version,
        changeNote: row.changeNote,
        createdAt: row.createdAt,
        title: row.title,
        excerpt: row.excerpt,
      }));
  },
});

export const voteEvidence = mutation({
  args: {
    code: v.string(),
    evidenceIndex: v.number(),
    vote: v.union(v.literal("attest"), v.literal("challenge"), v.literal("clear")),
  },
  returns: barkDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (
      args.evidenceIndex < 0 ||
      args.evidenceIndex >= bark.evidence.length
    ) {
      throw new Error("Evidence item not found");
    }

    const existing = await ctx.db
      .query("barkEvidenceVotes")
      .withIndex("by_bark_evidence_user", (q) =>
        q
          .eq("barkId", bark._id)
          .eq("evidenceIndex", args.evidenceIndex)
          .eq("clerkUserId", me)
      )
      .unique();

    if (args.vote === "clear") {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, {
        vote: args.vote,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("barkEvidenceVotes", {
        barkId: bark._id,
        evidenceIndex: args.evidenceIndex,
        clerkUserId: me,
        vote: args.vote,
        createdAt: Date.now(),
      });
    }

    const votes = await ctx.db
      .query("barkEvidenceVotes")
      .withIndex("by_bark_evidence", (q) =>
        q.eq("barkId", bark._id).eq("evidenceIndex", args.evidenceIndex)
      )
      .take(200);
    let attestCount = 0;
    let challengeCount = 0;
    for (const vote of votes) {
      if (vote.vote === "attest") attestCount += 1;
      else challengeCount += 1;
    }

    const evidence = bark.evidence.map((item, i) =>
      i === args.evidenceIndex
        ? { ...item, attestCount, challengeCount }
        : item
    );
    await ctx.db.patch(bark._id, {
      evidence,
      evidenceRating: scoreEvidenceRating(evidence),
    });
    const updated = await ctx.db.get(bark._id);
    if (!updated) throw new Error("Reaction not found");
    return await withResolvedEvidence(ctx, updated);
  },
});

export const evidenceVoteState = query({
  args: { code: v.string() },
  returns: v.array(
    v.object({
      evidenceIndex: v.number(),
      myVote: v.union(
        v.literal("attest"),
        v.literal("challenge"),
        v.null()
      ),
      attestCount: v.number(),
      challengeCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark) return [];
    const identity = await ctx.auth.getUserIdentity();
    const me = identity ? clerkUserId(identity) : null;
    const result = [];
    for (let i = 0; i < bark.evidence.length; i++) {
      const item = bark.evidence[i];
      let myVote: "attest" | "challenge" | null = null;
      if (me) {
        const row = await ctx.db
          .query("barkEvidenceVotes")
          .withIndex("by_bark_evidence_user", (q) =>
            q.eq("barkId", bark._id).eq("evidenceIndex", i).eq("clerkUserId", me)
          )
          .unique();
        myVote = row?.vote ?? null;
      }
      result.push({
        evidenceIndex: i,
        myVote,
        attestCount: item.attestCount ?? 0,
        challengeCount: item.challengeCount ?? 0,
      });
    }
    return result;
  },
});

export const listRelatedBySource = query({
  args: {
    sourceUrl: v.string(),
    excludeCode: v.optional(v.string()),
  },
  returns: v.object({
    total: v.number(),
    byType: v.object({
      agree: v.number(),
      disagree: v.number(),
      mixed: v.number(),
      unpack: v.number(),
    }),
    related: v.array(barkDoc),
  }),
  handler: async (ctx, args) => {
    const sourceUrl = args.sourceUrl.trim();
    if (!sourceUrl) {
      return {
        total: 0,
        byType: { agree: 0, disagree: 0, mixed: 0, unpack: 0 },
        related: [],
      };
    }
    const recent = await ctx.db
      .query("barks")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "public"))
      .order("desc")
      .take(120);
    const exclude = args.excludeCode?.trim().toUpperCase();
    const matched = recent.filter(
      (row) =>
        row.sourceUrl.trim() === sourceUrl &&
        (!exclude || row.code !== exclude)
    );
    const byType = { agree: 0, disagree: 0, mixed: 0, unpack: 0 };
    for (const row of matched) byType[row.type] += 1;
    const related = await Promise.all(
      matched.slice(0, 8).map((row) => withResolvedEvidence(ctx, row))
    );
    return { total: matched.length, byType, related };
  },
});

export const promoteToCase = mutation({
  args: { code: v.string() },
  returns: v.object({ caseCode: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can promote this reaction");
    }
    if (bark.promotedCaseCode) {
      return { caseCode: bark.promotedCaseCode };
    }
    if (bark.evidence.length === 0) {
      throw new Error("Add evidence before promoting to a case");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", me))
      .unique();
    const year = new Date().getUTCFullYear();
    let caseCode = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const n = 1000 + Math.floor(Math.random() * 9000);
      const candidate = `CASE-${year}-${String(n).padStart(4, "0")}`;
      const existing = await ctx.db
        .query("cases")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!existing) {
        caseCode = candidate;
        break;
      }
    }
    if (!caseCode) throw new Error("Could not allocate a case code");

    const category = (bark.topics?.[0] ?? "misinformation") as
      | "racism"
      | "discrimination"
      | "harassment"
      | "misinformation"
      | "fabricated-content"
      | "undisclosed-sponsorship"
      | "scam"
      | "plagiarism";

    const evidence = bark.evidence.map((item, i) => ({
      id: `c0-e${i}`,
      type: item.type,
      title: item.title,
      url: item.url,
    }));
    const now = Date.now();
    const openedByName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      bark.authorName;

    await ctx.db.insert("cases", {
      code: caseCode,
      title: bark.title,
      summary: bark.excerpt || bark.body.slice(0, 220),
      status: "under-review",
      category,
      creatorId: bark.sourceCreatorId ?? bark.sourceCreatorName,
      creatorName: bark.sourceCreatorName || "Unknown creator",
      creatorHandle: "source",
      creatorVerified: false,
      openedByClerkId: me,
      openedByName,
      ...(bark.orgClerkId ? { orgClerkId: bark.orgClerkId } : {}),
      openedAt: now,
      updatedAt: now,
      followers: 0,
      claims: [
        {
          id: "c0",
          text: bark.excerpt || bark.title,
          status: "unverified",
          evidenceIds: evidence.map((e) => e.id),
        },
      ],
      evidence,
      timeline: [
        {
          id: "opened",
          date: now,
          title: "Case opened from reaction",
          description: `Escalated from ${bark.code}.`,
          type: "created",
        },
      ],
      strengths: [],
      weaknesses: [],
      contradictions: [],
      missingEvidence: [],
    });

    await ctx.db.patch(bark._id, { promotedCaseCode: caseCode });
    return { caseCode };
  },
});

export const recordView = mutation({
  args: {
    code: v.string(),
    viewerKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code.trim().toUpperCase());
    if (!bark || bark.status !== "public") return null;

    const identity = await ctx.auth.getUserIdentity();
    const viewerKey =
      (identity ? clerkUserId(identity) : null) ||
      args.viewerKey?.trim() ||
      null;
    if (!viewerKey) return null;

    const dayKey = new Date().toISOString().slice(0, 10);
    const existing = await ctx.db
      .query("barkViews")
      .withIndex("by_bark_viewer_day", (q) =>
        q
          .eq("barkId", bark._id)
          .eq("viewerKey", viewerKey)
          .eq("dayKey", dayKey)
      )
      .unique();
    if (existing) return null;

    await ctx.db.insert("barkViews", {
      barkId: bark._id,
      viewerKey,
      dayKey,
    });
    await ctx.db.patch(bark._id, { views: (bark.views ?? 0) + 1 });
    return null;
  },
});

const evidenceRequestDoc = v.object({
  ...evidenceRequestFields,
  _id: v.id("evidenceRequests"),
  _creationTime: v.number(),
});

export const listEvidenceRequests = query({
  args: { code: v.string() },
  returns: v.array(evidenceRequestDoc),
  handler: async (ctx, args) => {
    const bark = await barkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return [];
    const rows = await ctx.db
      .query("evidenceRequests")
      .withIndex("by_bark_status", (q) => q.eq("barkId", bark._id))
      .take(60);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const requestEvidence = mutation({
  args: {
    code: v.string(),
    blockIndex: v.number(),
    claimSnippet: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("evidenceRequests"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    requirePublicBark(bark);
    if (bark.authorClerkId === me) {
      throw new Error("You cannot request evidence on your own reaction");
    }
    const blockIndex = Math.floor(args.blockIndex);
    if (blockIndex < 0 || blockIndex > 500) {
      throw new Error("Invalid block");
    }
    const snippet = args.claimSnippet.trim().slice(0, 280);
    if (!snippet) throw new Error("Select a claim to request evidence for");
    const note = args.note?.trim().slice(0, 400);
    const blockHash = `block-${blockIndex + 1}`;

    const existing = await ctx.db
      .query("evidenceRequests")
      .withIndex("by_bark_block_requester", (q) =>
        q
          .eq("barkId", bark._id)
          .eq("blockIndex", blockIndex)
          .eq("requesterClerkId", me)
      )
      .unique();
    if (existing && existing.status === "open") {
      throw new Error("You already asked for evidence on this claim");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", me))
      .unique();
    const requesterName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";

    let id: Id<"evidenceRequests">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        claimSnippet: snippet,
        ...(note ? { note } : { note: undefined }),
        requesterName,
        status: "open",
        createdAt: Date.now(),
        resolvedAt: undefined,
        resolvedByClerkId: undefined,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("evidenceRequests", {
        barkId: bark._id,
        blockIndex,
        blockHash,
        claimSnippet: snippet,
        ...(note ? { note } : {}),
        requesterClerkId: me,
        requesterName,
        status: "open",
        createdAt: Date.now(),
      });
    }

    await notify(ctx, {
      recipientClerkId: bark.authorClerkId,
      actorClerkId: me,
      category: "evidence",
      title: `${requesterName} asked for evidence on ${bark.code}`,
      body: snippet,
      href: `/barks/${bark.code}#${blockHash}`,
    });

    return id;
  },
});

export const resolveEvidenceRequest = mutation({
  args: {
    requestId: v.id("evidenceRequests"),
    action: v.union(v.literal("resolved"), v.literal("dismissed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    const bark = await ctx.db.get(req.barkId);
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can resolve evidence requests");
    }
    if (req.status !== "open") return null;

    const now = Date.now();
    await ctx.db.patch(req._id, {
      status: args.action,
      resolvedAt: now,
      resolvedByClerkId: me,
    });

    await notify(ctx, {
      recipientClerkId: req.requesterClerkId,
      actorClerkId: me,
      category: "evidence",
      title:
        args.action === "resolved"
          ? `Evidence request resolved on ${bark.code}`
          : `Evidence request dismissed on ${bark.code}`,
      body: req.claimSnippet.slice(0, 120),
      href: `/barks/${bark.code}#${req.blockHash}`,
    });
    return null;
  },
});

const visitDigestDoc = v.object({
  lastVisitedAt: v.union(v.number(), v.null()),
  amendmentCount: v.number(),
  dialogueCount: v.number(),
  evidenceAdded: v.number(),
  openEvidenceRequests: v.number(),
  highlights: v.array(v.string()),
});

export const getVisitDigest = query({
  args: { code: v.string() },
  returns: v.union(visitDigestDoc, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return null;

    const [authorFollow, save, visit] = await Promise.all([
      ctx.db
        .query("userFollows")
        .withIndex("by_target_user", (q) =>
          q.eq("targetClerkId", bark.authorClerkId).eq("clerkUserId", me)
        )
        .unique(),
      ctx.db
        .query("barkSaves")
        .withIndex("by_bark_user", (q) =>
          q.eq("barkId", bark._id).eq("clerkUserId", me)
        )
        .unique(),
      ctx.db
        .query("contentVisits")
        .withIndex("by_user_target", (q) =>
          q
            .eq("clerkUserId", me)
            .eq("targetKind", "bark")
            .eq("targetCode", bark.code)
        )
        .unique(),
    ]);

    const isAudience =
      Boolean(authorFollow) ||
      Boolean(save) ||
      bark.authorClerkId === me;
    if (!isAudience) return null;

    const since = visit?.lastVisitedAt ?? null;
    if (since === null) {
      return {
        lastVisitedAt: null,
        amendmentCount: 0,
        dialogueCount: 0,
        evidenceAdded: 0,
        openEvidenceRequests: 0,
        highlights: ["First visit — we’ll track updates for next time."],
      };
    }

    const versions = await ctx.db
      .query("barkVersions")
      .withIndex("by_bark", (q) => q.eq("barkId", bark._id))
      .take(40);
    const amendmentCount = versions.filter((row) => row.createdAt > since)
      .length;

    const dialogueCount = (bark.creatorDialogue ?? []).filter(
      (turn) => turn.respondedAt > since
    ).length;

    const evidenceAdded =
      bark.amendedAt && bark.amendedAt > since
        ? Math.max(0, bark.evidence.length)
        : 0;

    const openReqs = await ctx.db
      .query("evidenceRequests")
      .withIndex("by_bark_status", (q) =>
        q.eq("barkId", bark._id).eq("status", "open")
      )
      .take(20);

    const highlights: string[] = [];
    if (amendmentCount > 0) {
      highlights.push(
        `${amendmentCount} amendment${amendmentCount === 1 ? "" : "s"} since your last visit`
      );
    }
    if (dialogueCount > 0) {
      highlights.push(
        `${dialogueCount} new official dialogue turn${dialogueCount === 1 ? "" : "s"}`
      );
    }
    if (bark.amendedAt && bark.amendedAt > since) {
      highlights.push("Evidence or analysis was updated");
    }
    if (openReqs.length > 0) {
      highlights.push(
        `${openReqs.length} open ask-for-evidence request${openReqs.length === 1 ? "" : "s"}`
      );
    }

    return {
      lastVisitedAt: since,
      amendmentCount,
      dialogueCount,
      evidenceAdded,
      openEvidenceRequests: openReqs.length,
      highlights,
    };
  },
});

export const markBarkVisited = mutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark || bark.status !== "public") return null;
    const existing = await ctx.db
      .query("contentVisits")
      .withIndex("by_user_target", (q) =>
        q
          .eq("clerkUserId", me)
          .eq("targetKind", "bark")
          .eq("targetCode", bark.code)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastVisitedAt: now });
    } else {
      await ctx.db.insert("contentVisits", {
        clerkUserId: me,
        targetKind: "bark",
        targetCode: bark.code,
        lastVisitedAt: now,
      });
    }
    return null;
  },
});

const barkClaimInput = v.object({
  id: v.optional(v.string()),
  text: v.string(),
  status: v.union(
    v.literal("supported"),
    v.literal("disputed"),
    v.literal("unverified"),
    v.literal("refuted")
  ),
  evidenceIndexes: v.array(v.number()),
});

export const setClaims = mutation({
  args: {
    code: v.string(),
    claims: v.array(barkClaimInput),
  },
  returns: barkDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const bark = await barkByCode(ctx, args.code);
    if (!bark) throw new Error("Reaction not found");
    if (bark.authorClerkId !== me) {
      throw new Error("Only the author can edit the claim map");
    }
    if (bark.status !== "public" && bark.status !== "draft") {
      throw new Error("Reaction not found");
    }

    const maxIndex = bark.evidence.length - 1;
    const claims = args.claims.map((claim, i) => {
      const text = claim.text.trim();
      if (!text) throw new Error("Claim text is required");
      const indexes = [...new Set(claim.evidenceIndexes)].filter(
        (idx) => Number.isInteger(idx) && idx >= 0 && idx <= maxIndex
      );
      if (bark.evidence.length > 0 && indexes.length === 0) {
        throw new Error(
          `Claim ${i + 1} needs at least one linked evidence item`
        );
      }
      return {
        id: claim.id?.trim() || `c${i}`,
        text,
        status: claim.status,
        evidenceIndexes: indexes,
      };
    });

    if (claims.length > 30) throw new Error("Too many claims");

    await ctx.db.patch(bark._id, { claims });
    const updated = await ctx.db.get(bark._id);
    if (!updated) throw new Error("Reaction not found");
    return await withResolvedEvidence(ctx, updated);
  },
});
