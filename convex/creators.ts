import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import {
  applicantMatchesCreatorIdentity,
  normalizeCreatorKey,
  resolveExternalIdentityFromLink,
  urlsReferToSameChannel,
} from "./lib/creator_identity";
import { recordModerationEvent } from "./lib/moderation";
import { displayName, notify } from "./lib/notify";
import {
  creatorDocFields,
  creatorVerificationMethod,
  emergencyContactFields,
  sourcePlatform,
} from "./lib/validators";

const creatorDoc = v.object({
  ...creatorDocFields,
  _id: v.id("creators"),
  _creationTime: v.number(),
});

const publicCreatorStatuses = new Set(["approved", "unclaimed"]);

function isPublicCreator(creator: Doc<"creators">) {
  return publicCreatorStatuses.has(creator.status);
}

function isFollowableCreatorDoc(creator: Doc<"creators">) {
  return creator.status === "approved";
}

async function applicantLinksMatchStub(
  ctx: QueryCtx | MutationCtx,
  stub: Doc<"creators">,
  platforms: Doc<"creators">["platforms"],
  officialLinks: { url: string }[]
): Promise<boolean> {
  if (applicantMatchesCreatorIdentity(stub, platforms, officialLinks)) {
    return true;
  }

  for (const link of officialLinks) {
    if (!link.url.trim()) continue;
    for (const platform of platforms) {
      const identity = resolveExternalIdentityFromLink(link.url, platform);
      if (!identity) continue;
      const found = await findByExternalIdentity(
        ctx,
        identity.platform as Doc<"creators">["externalPlatform"],
        identity.externalHandle
      );
      if (found && found._id === stub._id) return true;
    }
  }

  for (const submitted of officialLinks) {
    if (!submitted.url.trim()) continue;
    for (const stubLink of stub.officialLinks) {
      if (urlsReferToSameChannel(submitted.url, stubLink.url)) return true;
    }
  }

  return false;
}

function assertCanUpgradeUnclaimed(stub: Doc<"creators">) {
  if (stub.status !== "unclaimed") {
    throw new Error("This profile is not available to claim");
  }
}

async function assertCanUpgradeUnclaimedWithLinks(
  ctx: MutationCtx,
  stub: Doc<"creators">,
  platforms: Doc<"creators">["platforms"],
  officialLinks: { url: string }[]
) {
  assertCanUpgradeUnclaimed(stub);
  if (!(await applicantLinksMatchStub(ctx, stub, platforms, officialLinks))) {
    throw new Error("Official links must match this profile's platform handle");
  }
}

function slugifyHandle(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "creator";
  return base;
}

async function findByExternalIdentity(
  ctx: QueryCtx | MutationCtx,
  platform: Doc<"creators">["externalPlatform"],
  externalHandle: string
) {
  if (!platform) return null;
  const canonical = normalizeCreatorKey(externalHandle);
  if (!canonical) return null;

  const exact = await ctx.db
    .query("creators")
    .withIndex("by_external_identity", (q) =>
      q.eq("externalPlatform", platform).eq("externalHandle", canonical)
    )
    .unique();
  if (exact) return exact;

  const lowered = externalHandle.trim().toLowerCase().replace(/^@/, "");
  if (lowered && lowered !== canonical) {
    const raw = await ctx.db
      .query("creators")
      .withIndex("by_external_identity", (q) =>
        q.eq("externalPlatform", platform).eq("externalHandle", lowered)
      )
      .unique();
    if (raw) return raw;
  }

  const unclaimed = await ctx.db
    .query("creators")
    .withIndex("by_status_createdAt", (q) => q.eq("status", "unclaimed"))
    .order("desc")
    .take(200);
  return (
    unclaimed.find(
      (row) =>
        row.externalPlatform === platform &&
        Boolean(row.externalHandle) &&
        normalizeCreatorKey(row.externalHandle ?? "") === canonical
    ) ?? null
  );
}

async function listUnclaimedHandleVariants(
  ctx: QueryCtx | MutationCtx,
  survivorId: Doc<"creators">["_id"],
  platform: Doc<"creators">["externalPlatform"],
  canonical: string
) {
  if (!platform || !canonical) return [];
  const unclaimed = await ctx.db
    .query("creators")
    .withIndex("by_status_createdAt", (q) => q.eq("status", "unclaimed"))
    .order("desc")
    .take(200);
  return unclaimed.filter(
    (row) =>
      row._id !== survivorId &&
      row.externalPlatform === platform &&
      Boolean(row.externalHandle) &&
      normalizeCreatorKey(row.externalHandle ?? "") === canonical
  );
}

async function retargetCreatorReferences(
  ctx: MutationCtx,
  fromId: Doc<"creators">["_id"],
  toId: Doc<"creators">["_id"]
) {
  for (;;) {
    const barks = await ctx.db
      .query("barks")
      .withIndex("by_sourceCreator_status_publishedAt", (q) =>
        q.eq("sourceCreatorId", fromId)
      )
      .take(100);
    if (barks.length === 0) break;
    for (const bark of barks) {
      await ctx.db.patch(bark._id, { sourceCreatorId: toId });
    }
  }

  for (;;) {
    const reviews = await ctx.db
      .query("creatorReviews")
      .withIndex("by_creator_status_publishedAt", (q) =>
        q.eq("creatorId", fromId)
      )
      .take(100);
    if (reviews.length === 0) break;
    for (const review of reviews) {
      await ctx.db.patch(review._id, { creatorId: toId });
    }
  }

  for (;;) {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_creatorId_updatedAt", (q) => q.eq("creatorId", fromId))
      .take(100);
    if (cases.length === 0) break;
    for (const row of cases) {
      await ctx.db.patch(row._id, { creatorId: toId });
    }
  }

  for (;;) {
    const follows = await ctx.db
      .query("creatorFollows")
      .withIndex("by_creator_user", (q) => q.eq("creatorId", fromId))
      .take(100);
    if (follows.length === 0) break;
    for (const follow of follows) {
      const existing = await ctx.db
        .query("creatorFollows")
        .withIndex("by_creator_user", (q) =>
          q.eq("creatorId", toId).eq("clerkUserId", follow.clerkUserId)
        )
        .unique();
      if (existing) {
        await ctx.db.delete(follow._id);
      } else {
        await ctx.db.patch(follow._id, { creatorId: toId });
      }
    }
  }

  const verifications = await ctx.db
    .query("creatorVerifications")
    .withIndex("by_creator", (q) => q.eq("creatorId", fromId))
    .take(50);
  for (const row of verifications) {
    await ctx.db.delete(row._id);
  }
}

async function absorbUnclaimedHandleVariants(
  ctx: MutationCtx,
  survivor: Doc<"creators">
) {
  if (!survivor.externalPlatform || !survivor.externalHandle) return;
  const canonical = normalizeCreatorKey(survivor.externalHandle);
  if (!canonical) return;

  const siblings = await listUnclaimedHandleVariants(
    ctx,
    survivor._id,
    survivor.externalPlatform,
    canonical
  );
  if (siblings.length === 0) {
    if (survivor.externalHandle !== canonical) {
      const occupied = await ctx.db
        .query("creators")
        .withIndex("by_external_identity", (q) =>
          q
            .eq("externalPlatform", survivor.externalPlatform)
            .eq("externalHandle", canonical)
        )
        .unique();
      if (!occupied || occupied._id === survivor._id) {
        await ctx.db.patch(survivor._id, {
          externalHandle: canonical,
          updatedAt: Date.now(),
        });
      }
    }
    return;
  }

  let extraFollowers = 0;
  let extraBarks = 0;
  let extraSources = 0;
  const officialLinks = [...survivor.officialLinks];

  for (const sibling of siblings) {
    extraFollowers += sibling.followers;
    extraBarks += sibling.totalBarksReceived;
    extraSources += sibling.totalSources;
    for (const link of sibling.officialLinks) {
      if (!officialLinks.some((item) => item.url === link.url)) {
        officialLinks.push(link);
      }
    }
    await retargetCreatorReferences(ctx, sibling._id, survivor._id);
    await ctx.db.delete(sibling._id);
  }

  const latest = await ctx.db.get(survivor._id);
  if (!latest) return;
  await ctx.db.patch(survivor._id, {
    followers: latest.followers + extraFollowers,
    totalBarksReceived: latest.totalBarksReceived + extraBarks,
    totalSources: latest.totalSources + extraSources,
    officialLinks,
    externalHandle: canonical,
    updatedAt: Date.now(),
  });
}

async function allocateUniqueHandle(ctx: QueryCtx | MutationCtx, baseHandle: string) {
  let handle = baseHandle.slice(0, 24) || "creator";
  for (let attempt = 0; attempt < 12; attempt++) {
    const taken = await ctx.db
      .query("creators")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!taken) return handle;
    handle = `${baseHandle.slice(0, 20)}${attempt + 2}`;
  }
  throw new Error("Could not allocate a unique handle");
}

async function allocateUnclaimedApplicationCode(ctx: MutationCtx) {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const n = 1000 + Math.floor(Math.random() * 9000);
    const candidate = `UNC-${year}-${String(n).padStart(4, "0")}`;
    const clash = await ctx.db
      .query("creators")
      .withIndex("by_applicationCode", (q) =>
        q.eq("applicationCode", candidate)
      )
      .unique();
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate an unclaimed application code");
}

async function allocateVerificationId(
  ctx: MutationCtx,
  preferred?: string
): Promise<string> {
  const trimmed = preferred?.trim().toUpperCase();
  if (trimmed && /^TR-[A-Z0-9]{6}$/.test(trimmed)) {
    const clash = await ctx.db
      .query("creatorVerifications")
      .withIndex("by_verificationId", (q) => q.eq("verificationId", trimmed))
      .unique();
    if (!clash) return trimmed;
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 12; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `TR-${suffix}`;
    const clash = await ctx.db
      .query("creatorVerifications")
      .withIndex("by_verificationId", (q) =>
        q.eq("verificationId", candidate)
      )
      .unique();
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a verification ID");
}

async function saveCreatorVerification(
  ctx: MutationCtx,
  input: {
    creatorId: Doc<"creators">["_id"];
    applicantClerkId: string;
    legalName: string;
    email: string;
    phone: string;
    proofPostUrl?: string;
    emergencyContacts: {
      name: string;
      phone: string;
      relationship: string;
    }[];
    verificationIdHint?: string;
  }
) {
  const verificationId = await allocateVerificationId(
    ctx,
    input.verificationIdHint
  );
  const now = Date.now();
  await ctx.db.insert("creatorVerifications", {
    creatorId: input.creatorId,
    applicantClerkId: input.applicantClerkId,
    legalName: input.legalName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    verificationId,
    proofPostUrl: input.proofPostUrl?.trim() || undefined,
    emergencyContacts: input.emergencyContacts,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
  });
  return verificationId;
}

export const apply = mutation({
  args: {
    name: v.string(),
    bio: v.string(),
    country: v.string(),
    category: v.string(),
    platforms: v.array(sourcePlatform),
    officialLinks: v.array(
      v.object({
        label: v.string(),
        url: v.string(),
      })
    ),
    verificationMethod: creatorVerificationMethod,
    upgradeCreatorId: v.optional(v.id("creators")),
    verificationIdHint: v.optional(v.string()),
    legalName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    proofPostUrl: v.optional(v.string()),
    emergencyContacts: v.optional(v.array(emergencyContactFields)),
  },
  returns: v.object({
    applicationCode: v.string(),
    verificationId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const applicantClerkId = clerkUserId(identity);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", applicantClerkId))
      .unique();

    const name = args.name.trim();
    if (!name) throw new Error("Public name is required");
    if (!args.category.trim()) throw new Error("Choose a content category");
    if (args.platforms.length === 0) {
      throw new Error("Select at least one platform");
    }

    const existing = await ctx.db
      .query("creators")
      .withIndex("by_applicant", (q) =>
        q.eq("applicantClerkId", applicantClerkId)
      )
      .take(20);
    if (existing.some((row) => row.status === "pending")) {
      throw new Error("You already have an application under review");
    }
    if (existing.some((row) => row.status === "approved")) {
      throw new Error("You already have an approved creator profile");
    }

    const filteredLinks = args.officialLinks.filter((link) => link.url.trim());
    const now = Date.now();
    const applicantName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      name;

    const verificationPayload =
      args.legalName?.trim() &&
      args.email?.trim() &&
      args.phone?.trim() &&
      args.emergencyContacts &&
      args.emergencyContacts.length >= 2
        ? {
            legalName: args.legalName,
            email: args.email,
            phone: args.phone,
            proofPostUrl: args.proofPostUrl,
            emergencyContacts: args.emergencyContacts.filter(
              (contact) =>
                contact.name.trim() &&
                contact.phone.trim() &&
                contact.relationship.trim()
            ),
          }
        : null;

    let creatorId: Doc<"creators">["_id"];
    let applicationCode: string;

    if (args.upgradeCreatorId) {
      const stub = await ctx.db.get(args.upgradeCreatorId);
      if (!stub || stub.status !== "unclaimed") {
        throw new Error("Unclaimed profile not found");
      }
      await assertCanUpgradeUnclaimedWithLinks(
        ctx,
        stub,
        args.platforms,
        filteredLinks
      );
      const year = new Date().getUTCFullYear();
      applicationCode = stub.applicationCode;
      if (!applicationCode.startsWith("APP-")) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const n = 1000 + Math.floor(Math.random() * 9000);
          const candidate = `APP-${year}-${String(n).padStart(4, "0")}`;
          const clash = await ctx.db
            .query("creators")
            .withIndex("by_applicationCode", (q) =>
              q.eq("applicationCode", candidate)
            )
            .unique();
          if (!clash) {
            applicationCode = candidate;
            break;
          }
        }
      }

      await ctx.db.patch(stub._id, {
        applicationCode,
        name,
        bio: args.bio.trim(),
        country: args.country.trim() || "US",
        category: args.category.trim(),
        platforms: args.platforms,
        officialLinks: filteredLinks,
        verificationMethod: args.verificationMethod,
        applicantClerkId,
        applicantName,
        status: "pending",
        updatedAt: now,
      });
      creatorId = stub._id;
      const upgraded = await ctx.db.get(stub._id);
      if (upgraded) await absorbUnclaimedHandleVariants(ctx, upgraded);
    } else {
      const year = new Date().getUTCFullYear();
      applicationCode = "";
      for (let attempt = 0; attempt < 8; attempt++) {
        const n = 1000 + Math.floor(Math.random() * 9000);
        const candidate = `APP-${year}-${String(n).padStart(4, "0")}`;
        const clash = await ctx.db
          .query("creators")
          .withIndex("by_applicationCode", (q) =>
            q.eq("applicationCode", candidate)
          )
          .unique();
        if (!clash) {
          applicationCode = candidate;
          break;
        }
      }
      if (!applicationCode) {
        throw new Error("Could not allocate an application code");
      }

      const base = slugifyHandle(name);
      const handle = await allocateUniqueHandle(ctx, base);

      creatorId = await ctx.db.insert("creators", {
        applicationCode,
        handle,
        name,
        bio: args.bio.trim(),
        country: args.country.trim() || "US",
        category: args.category.trim(),
        platforms: args.platforms,
        officialLinks: filteredLinks,
        verificationMethod: args.verificationMethod,
        applicantClerkId,
        applicantName,
        status: "pending",
        verified: false,
        followers: 0,
        totalSources: 0,
        totalBarksReceived: 0,
        responseRate: 0,
        officialResponseCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    let verificationId: string | undefined;
    if (verificationPayload && verificationPayload.emergencyContacts.length >= 2) {
      verificationId = await saveCreatorVerification(ctx, {
        creatorId,
        applicantClerkId,
        verificationIdHint: args.verificationIdHint,
        ...verificationPayload,
      });
    }

    return { applicationCode, verificationId };
  },
});

export const listApproved = query({
  args: {},
  returns: v.array(creatorDoc),
  handler: async (ctx) => {
    return await ctx.db
      .query("creators")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(50);
  },
});

export const listPublic = query({
  args: {},
  returns: v.array(creatorDoc),
  handler: async (ctx) => {
    const [approved, unclaimed] = await Promise.all([
      ctx.db
        .query("creators")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
        .order("desc")
        .take(50),
      ctx.db
        .query("creators")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "unclaimed"))
        .order("desc")
        .take(50),
    ]);
    return [...approved, ...unclaimed].sort(
      (a, b) => b.totalBarksReceived - a.totalBarksReceived
    );
  },
});

export const getByExternalIdentity = query({
  args: {
    platform: sourcePlatform,
    externalHandle: v.string(),
  },
  returns: v.union(creatorDoc, v.null()),
  handler: async (ctx, args) => {
    const creator = await findByExternalIdentity(
      ctx,
      args.platform,
      args.externalHandle
    );
    if (!creator || !isPublicCreator(creator)) return null;
    return creator;
  },
});

export const ensureUnclaimedFromSource = mutation({
  args: {
    platform: sourcePlatform,
    externalHandle: v.string(),
    displayName: v.string(),
    sourceUrl: v.string(),
    channelUrl: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
  },
  returns: v.object({ creatorId: v.id("creators") }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const linkedByClerkId = clerkUserId(identity);
    const externalHandle = normalizeCreatorKey(args.externalHandle);
    if (!externalHandle) throw new Error("External handle is required");

    const existing = await findByExternalIdentity(
      ctx,
      args.platform,
      externalHandle
    );
    const now = Date.now();
    const displayName = args.displayName.trim() || externalHandle;

    if (existing) {
      if (existing.status === "approved") {
        return { creatorId: existing._id };
      }
      if (existing.status === "unclaimed") {
        const patch: Partial<Doc<"creators">> = { updatedAt: now };
        if (displayName && displayName !== existing.name) {
          patch.name = displayName;
        }
        const channelUrl = args.channelUrl?.trim();
        if (
          channelUrl &&
          !existing.officialLinks.some((link) => link.url === channelUrl)
        ) {
          patch.officialLinks = [
            ...existing.officialLinks,
            { label: args.platform, url: channelUrl },
          ];
        }
        const imageUrl = args.profileImageUrl?.trim();
        if (imageUrl && imageUrl !== existing.profileImageUrl) {
          patch.profileImageUrl = imageUrl;
        }
        if (!existing.linkedByClerkId) {
          patch.linkedByClerkId = linkedByClerkId;
        }
        if (existing.externalHandle !== externalHandle) {
          const occupied = await ctx.db
            .query("creators")
            .withIndex("by_external_identity", (q) =>
              q
                .eq("externalPlatform", args.platform)
                .eq("externalHandle", externalHandle)
            )
            .unique();
          if (!occupied || occupied._id === existing._id) {
            patch.externalHandle = externalHandle;
          }
        }
        if (Object.keys(patch).length > 1) {
          await ctx.db.patch(existing._id, patch);
        }
        return { creatorId: existing._id };
      }
      return { creatorId: existing._id };
    }

    const handle = await allocateUniqueHandle(ctx, externalHandle);
    const applicationCode = await allocateUnclaimedApplicationCode(ctx);
    const channelUrl = args.channelUrl?.trim();
    const officialLinks = channelUrl
      ? [{ label: args.platform, url: channelUrl }]
      : args.sourceUrl.trim()
        ? [{ label: "Source", url: args.sourceUrl.trim() }]
        : [];

    const creatorId = await ctx.db.insert("creators", {
      applicationCode,
      handle,
      name: displayName,
      bio: "",
      country: "",
      category: "Uncategorized",
      platforms: [args.platform],
      officialLinks,
      verificationMethod: "connect",
      applicantClerkId: "",
      applicantName: "",
      status: "unclaimed",
      verified: false,
      followers: 0,
      totalSources: 0,
      totalBarksReceived: 0,
      responseRate: 0,
      officialResponseCount: 0,
      externalPlatform: args.platform,
      externalHandle,
      profileImageUrl: args.profileImageUrl?.trim() || undefined,
      linkedByClerkId,
      createdAt: now,
      updatedAt: now,
    });

    return { creatorId };
  },
});

const canClaimResult = v.object({
  allowed: v.boolean(),
  reason: v.optional(v.string()),
});

export const canClaimCreator = query({
  args: { creatorId: v.id("creators") },
  returns: canClaimResult,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        allowed: false,
        reason: "Sign in to claim a creator profile",
      };
    }
    const clerkId = clerkUserId(identity);
    const creator = await ctx.db.get(args.creatorId);
    if (!creator || creator.status !== "unclaimed") {
      return {
        allowed: false,
        reason: "This profile is not available to claim",
      };
    }
    const existing = await ctx.db
      .query("creators")
      .withIndex("by_applicant", (q) => q.eq("applicantClerkId", clerkId))
      .take(20);
    if (existing.some((row) => row.status === "pending")) {
      return {
        allowed: false,
        reason: "You already have an application under review",
      };
    }
    if (existing.some((row) => row.status === "approved")) {
      return {
        allowed: false,
        reason: "You already have an approved creator profile",
      };
    }
    return { allowed: true };
  },
});

export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(creatorDoc, v.null()),
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();
    if (!creator || !isPublicCreator(creator)) return null;
    return creator;
  },
});

export const getById = query({
  args: { id: v.id("creators") },
  returns: v.union(creatorDoc, v.null()),
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.id);
    if (!creator || !isPublicCreator(creator)) return null;
    return creator;
  },
});

export const getMine = query({
  args: {},
  returns: v.union(creatorDoc, v.null()),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("creators")
      .withIndex("by_applicant", (q) =>
        q.eq("applicantClerkId", clerkUserId(identity))
      )
      .take(20);
    return rows.find((row) => row.status === "approved") ?? null;
  },
});

export const listPending = query({
  args: {},
  returns: v.array(creatorDoc),
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.db
      .query("creators")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(50);
  },
});

export const approve = mutation({
  args: { creatorId: v.id("creators") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Application not found");
    await ctx.db.patch(args.creatorId, {
      status: "approved",
      verified: true,
      updatedAt: Date.now(),
    });
    const approved = await ctx.db.get(args.creatorId);
    if (approved) await absorbUnclaimedHandleVariants(ctx, approved);
    await notify(ctx, {
      recipientClerkId: creator.applicantClerkId,
      category: "verification",
      title: "Your creator profile was verified",
      body: `@${creator.handle} is now live on TypeReact.`,
      href: `/creators/${creator.handle}`,
    });
    const clerkId = clerkUserId(identity);
    await recordModerationEvent(ctx, {
      kind: "creator_approve",
      actorClerkId: clerkId,
      actorName: await displayName(ctx, clerkId, "Admin"),
      targetLabel: `@${creator.handle}`,
      note: `${creator.name} was verified and published.`,
    });
    return null;
  },
});

const followStateDoc = v.object({
  followers: v.number(),
  following: v.boolean(),
  isSelf: v.boolean(),
});

export const followState = query({
  args: { creatorId: v.id("creators") },
  returns: v.union(followStateDoc, v.null()),
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator || !isFollowableCreatorDoc(creator)) return null;
    const identity = await ctx.auth.getUserIdentity();
    let following = false;
    let isSelf = false;
    if (identity) {
      const clerkId = clerkUserId(identity);
      isSelf = creator.applicantClerkId === clerkId;
      const existing = await ctx.db
        .query("creatorFollows")
        .withIndex("by_creator_user", (q) =>
          q
            .eq("creatorId", creator._id)
            .eq("clerkUserId", clerkId)
        )
        .unique();
      following = Boolean(existing);
    }
    return { followers: creator.followers, following, isSelf };
  },
});

export const toggleFollow = mutation({
  args: { creatorId: v.id("creators") },
  returns: followStateDoc,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const creator = await ctx.db.get(args.creatorId);
    if (!creator || !isFollowableCreatorDoc(creator)) {
      throw new Error("Only claimed creator profiles can be followed");
    }
    const clerkId = clerkUserId(identity);
    if (creator.applicantClerkId === clerkId) {
      throw new Error("You cannot follow your own creator profile");
    }
    const existing = await ctx.db
      .query("creatorFollows")
      .withIndex("by_creator_user", (q) =>
        q.eq("creatorId", creator._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const followers = Math.max(0, creator.followers - 1);
      await ctx.db.patch(creator._id, { followers, updatedAt: Date.now() });
      return { followers, following: false, isSelf: false };
    }
    await ctx.db.insert("creatorFollows", {
      creatorId: creator._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    const followers = creator.followers + 1;
    await ctx.db.patch(creator._id, { followers, updatedAt: Date.now() });
    const actorName = await displayName(ctx, clerkId, "Someone");
    await notify(ctx, {
      recipientClerkId: creator.applicantClerkId,
      actorClerkId: clerkId,
      category: "follower",
      title: `${actorName} started following you`,
      body: `${actorName} followed @${creator.handle}.`,
      href: `/creators/${creator.handle}`,
    });
    return { followers, following: true, isSelf: false };
  },
});

export const listMineFollows = query({
  args: {},
  returns: v.array(creatorDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rows = await ctx.db
      .query("creatorFollows")
      .withIndex("by_user", (q) =>
        q.eq("clerkUserId", clerkUserId(identity))
      )
      .take(20);
    const result = [];
    for (const row of rows) {
      const creator = await ctx.db.get(row.creatorId);
      if (creator && isFollowableCreatorDoc(creator)) result.push(creator);
    }
    return result;
  },
});

export const reject = mutation({
  args: { creatorId: v.id("creators") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) throw new Error("Application not found");
    await ctx.db.patch(args.creatorId, {
      status: "rejected",
      verified: false,
      updatedAt: Date.now(),
    });
    await notify(ctx, {
      recipientClerkId: creator.applicantClerkId,
      category: "verification",
      title: "Creator application was not approved",
      body: "You can review the requirements and apply again.",
      href: "/creators",
    });
    const clerkId = clerkUserId(identity);
    await recordModerationEvent(ctx, {
      kind: "creator_reject",
      actorClerkId: clerkId,
      actorName: await displayName(ctx, clerkId, "Admin"),
      targetLabel: `@${creator.handle}`,
      note: `${creator.name} application was rejected.`,
    });
    return null;
  },
});
