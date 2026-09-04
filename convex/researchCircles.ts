import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { clerkUserId, requireIdentity } from "./lib/auth";
import {
  displayName,
  notify,
  notifyMany,
  resolveMentionRecipients,
} from "./lib/notify";
import {
  caseCategory,
  researchCircleFields,
  researchCircleInviteFields,
  researchCircleMemberFields,
} from "./lib/validators";

const MAX_MEMBERS = 40;

const circleDoc = v.object({
  ...researchCircleFields,
  _id: v.id("researchCircles"),
  _creationTime: v.number(),
  memberCount: v.number(),
  myRole: v.union(v.literal("owner"), v.literal("member"), v.null()),
});

const inviteDoc = v.object({
  ...researchCircleInviteFields,
  _id: v.id("researchCircleInvites"),
  _creationTime: v.number(),
  circleName: v.string(),
  inviterName: v.string(),
});

async function requireMember(
  ctx: QueryCtx | MutationCtx,
  circleId: Id<"researchCircles">,
  clerkId: string
) {
  const membership = await ctx.db
    .query("researchCircleMembers")
    .withIndex("by_circle_user", (q) =>
      q.eq("circleId", circleId).eq("clerkUserId", clerkId)
    )
    .unique();
  if (!membership) throw new Error("Not a member of this circle");
  return membership;
}

async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  circleId: Id<"researchCircles">,
  clerkId: string
) {
  const membership = await requireMember(ctx, circleId, clerkId);
  if (membership.role !== "owner") {
    throw new Error("Only the owner can do that");
  }
  return membership;
}

async function resolveUserByUsername(ctx: QueryCtx | MutationCtx, raw: string) {
  const username = raw.trim().replace(/^@/, "");
  if (!username) throw new Error("Username is required");
  const lowered = username.toLowerCase();
  let user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", lowered))
    .unique();
  if (!user) {
    user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
  }
  if (!user) throw new Error("User not found");
  return { user, username: (user.username ?? lowered).toLowerCase() };
}

export const listMine = query({
  args: {},
  returns: v.array(circleDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = clerkUserId(identity);
    const memberships = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", me))
      .take(40);
    const result = [];
    for (const membership of memberships) {
      const circle = await ctx.db.get(membership.circleId);
      if (!circle) continue;
      const members = await ctx.db
        .query("researchCircleMembers")
        .withIndex("by_circle_user", (q) => q.eq("circleId", circle._id))
        .take(MAX_MEMBERS);
      result.push({
        ...circle,
        memberCount: members.length,
        myRole: membership.role,
      });
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { circleId: v.id("researchCircles") },
  returns: v.union(
    v.object({
      circle: circleDoc,
      members: v.array(
        v.object({
          ...researchCircleMemberFields,
          _id: v.id("researchCircleMembers"),
          _creationTime: v.number(),
          name: v.string(),
          username: v.union(v.string(), v.null()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = clerkUserId(identity);
    const circle = await ctx.db.get(args.circleId);
    if (!circle) return null;
    const membership = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", circle._id).eq("clerkUserId", me)
      )
      .unique();
    if (!membership) return null;

    const memberRows = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) => q.eq("circleId", circle._id))
      .take(MAX_MEMBERS);
    const members = [];
    for (const row of memberRows) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", row.clerkUserId))
        .unique();
      members.push({
        ...row,
        name: user?.name || row.clerkUserId.slice(0, 12),
        username: user?.username ?? null,
      });
    }

    return {
      circle: {
        ...circle,
        memberCount: members.length,
        myRole: membership.role,
      },
      members,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    anchorKind: v.union(v.literal("case"), v.literal("topic")),
    caseCode: v.optional(v.string()),
    topic: v.optional(caseCategory),
  },
  returns: v.id("researchCircles"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    if (name.length > 80) throw new Error("Name is too long");
    const description = args.description?.trim();

    if (args.anchorKind === "case") {
      const code = args.caseCode?.trim().toUpperCase();
      if (!code) throw new Error("Case code is required");
      const accountabilityCase = await ctx.db
        .query("cases")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!accountabilityCase) throw new Error("Case not found");
    } else if (!args.topic) {
      throw new Error("Topic is required");
    }

    const circleId = await ctx.db.insert("researchCircles", {
      name,
      ...(description ? { description } : {}),
      anchorKind: args.anchorKind,
      ...(args.anchorKind === "case"
        ? { caseCode: args.caseCode!.trim().toUpperCase() }
        : { topic: args.topic }),
      ownerClerkId: me,
      createdAt: Date.now(),
    });

    await ctx.db.insert("researchCircleMembers", {
      circleId,
      clerkUserId: me,
      role: "owner",
      joinedAt: Date.now(),
    });

    return circleId;
  },
});

export const update = mutation({
  args: {
    circleId: v.id("researchCircles"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    await requireOwner(ctx, args.circleId, me);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    if (name.length > 80) throw new Error("Name is too long");
    const description = args.description?.trim();
    await ctx.db.patch(args.circleId, {
      name,
      description: description || undefined,
    });
    return null;
  },
});

export const inviteByUsername = mutation({
  args: {
    circleId: v.id("researchCircles"),
    username: v.string(),
  },
  returns: v.id("researchCircleInvites"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    await requireOwner(ctx, args.circleId, me);
    const circle = await ctx.db.get(args.circleId);
    if (!circle) throw new Error("Circle not found");

    const members = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) => q.eq("circleId", args.circleId))
      .take(MAX_MEMBERS);
    if (members.length >= MAX_MEMBERS) {
      throw new Error("Circle is full (40 members)");
    }

    const { user, username } = await resolveUserByUsername(ctx, args.username);
    if (user.clerkId === me) throw new Error("You are already a member");

    const existingMember = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("clerkUserId", user.clerkId)
      )
      .unique();
    if (existingMember) throw new Error("Already a member");

    const existingInvites = await ctx.db
      .query("researchCircleInvites")
      .withIndex("by_circle_invitee", (q) =>
        q.eq("circleId", args.circleId).eq("inviteeClerkId", user.clerkId)
      )
      .take(10);
    const pending = existingInvites.find((row) => row.status === "pending");
    if (pending) throw new Error("Invite already pending");

    const inviteId = await ctx.db.insert("researchCircleInvites", {
      circleId: args.circleId,
      inviterClerkId: me,
      inviteeClerkId: user.clerkId,
      inviteeUsername: username,
      status: "pending",
      createdAt: Date.now(),
    });

    const inviterName = await displayName(ctx, me, "Someone");
    await notify(ctx, {
      recipientClerkId: user.clerkId,
      actorClerkId: me,
      category: "circle",
      title: "Circle invite",
      body: `${inviterName} invited you to join “${circle.name}”`,
      href: `/circles?invite=${inviteId}`,
    });

    return inviteId;
  },
});

export const listMyPendingInvites = query({
  args: {},
  returns: v.array(inviteDoc),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = clerkUserId(identity);
    const rows = await ctx.db
      .query("researchCircleInvites")
      .withIndex("by_invitee_status", (q) =>
        q.eq("inviteeClerkId", me).eq("status", "pending")
      )
      .take(40);
    const result = [];
    for (const row of rows) {
      const circle = await ctx.db.get(row.circleId);
      if (!circle) continue;
      result.push({
        ...row,
        circleName: circle.name,
        inviterName: await displayName(ctx, row.inviterClerkId, "Someone"),
      });
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listCirclePendingInvites = query({
  args: { circleId: v.id("researchCircles") },
  returns: v.array(inviteDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = clerkUserId(identity);
    const membership = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("clerkUserId", me)
      )
      .unique();
    if (!membership || membership.role !== "owner") return [];

    const rows = await ctx.db
      .query("researchCircleInvites")
      .withIndex("by_circle_status", (q) =>
        q.eq("circleId", args.circleId).eq("status", "pending")
      )
      .take(40);
    const circle = await ctx.db.get(args.circleId);
    const circleName = circle?.name ?? "Circle";
    const result = [];
    for (const row of rows) {
      result.push({
        ...row,
        circleName,
        inviterName: await displayName(ctx, row.inviterClerkId, "Someone"),
      });
    }
    return result;
  },
});

export const acceptInvite = mutation({
  args: { inviteId: v.id("researchCircleInvites") },
  returns: v.id("researchCircles"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.inviteeClerkId !== me) {
      throw new Error("Invite not found");
    }
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }
    const circle = await ctx.db.get(invite.circleId);
    if (!circle) throw new Error("Circle not found");

    const members = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) => q.eq("circleId", invite.circleId))
      .take(MAX_MEMBERS);
    if (members.length >= MAX_MEMBERS) {
      throw new Error("Circle is full (40 members)");
    }

    const existing = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", invite.circleId).eq("clerkUserId", me)
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("researchCircleMembers", {
        circleId: invite.circleId,
        clerkUserId: me,
        role: "member",
        joinedAt: Date.now(),
      });
    }

    await ctx.db.patch(invite._id, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    const inviteeName = await displayName(ctx, me, "Someone");
    await notify(ctx, {
      recipientClerkId: invite.inviterClerkId,
      actorClerkId: me,
      category: "circle",
      title: "Invite accepted",
      body: `${inviteeName} joined “${circle.name}”`,
      href: `/circles/${invite.circleId}`,
    });

    return invite.circleId;
  },
});

export const declineInvite = mutation({
  args: { inviteId: v.id("researchCircleInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.inviteeClerkId !== me) {
      throw new Error("Invite not found");
    }
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }
    await ctx.db.patch(invite._id, {
      status: "declined",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const cancelInvite = mutation({
  args: { inviteId: v.id("researchCircleInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    await requireOwner(ctx, invite.circleId, me);
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }
    await ctx.db.patch(invite._id, {
      status: "cancelled",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const removeMember = mutation({
  args: {
    circleId: v.id("researchCircles"),
    memberClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    await requireOwner(ctx, args.circleId, me);
    if (args.memberClerkId === me) {
      throw new Error("Transfer ownership before leaving");
    }
    const membership = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q
          .eq("circleId", args.circleId)
          .eq("clerkUserId", args.memberClerkId)
      )
      .unique();
    if (!membership) throw new Error("Member not found");
    if (membership.role === "owner") {
      throw new Error("Cannot remove the owner");
    }
    await ctx.db.delete(membership._id);
    return null;
  },
});

export const transferOwnership = mutation({
  args: {
    circleId: v.id("researchCircles"),
    newOwnerClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const myMembership = await requireOwner(ctx, args.circleId, me);
    if (args.newOwnerClerkId === me) {
      throw new Error("Already the owner");
    }
    const target = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q
          .eq("circleId", args.circleId)
          .eq("clerkUserId", args.newOwnerClerkId)
      )
      .unique();
    if (!target) throw new Error("Member not found");

    await ctx.db.patch(target._id, { role: "owner" });
    await ctx.db.patch(myMembership._id, { role: "member" });
    await ctx.db.patch(args.circleId, { ownerClerkId: args.newOwnerClerkId });

    const circle = await ctx.db.get(args.circleId);
    const actorName = await displayName(ctx, me, "Someone");
    await notify(ctx, {
      recipientClerkId: args.newOwnerClerkId,
      actorClerkId: me,
      category: "circle",
      title: "You’re now the owner",
      body: `${actorName} transferred ownership of “${circle?.name ?? "a circle"}” to you`,
      href: `/circles/${args.circleId}`,
    });
    return null;
  },
});

export const leave = mutation({
  args: { circleId: v.id("researchCircles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const membership = await requireMember(ctx, args.circleId, me);
    if (membership.role === "owner") {
      throw new Error("Owner cannot leave — transfer or delete the circle first");
    }
    await ctx.db.delete(membership._id);
    return null;
  },
});

export const remove = mutation({
  args: { circleId: v.id("researchCircles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const circle = await ctx.db.get(args.circleId);
    if (!circle || circle.ownerClerkId !== me) {
      throw new Error("Only the owner can delete this circle");
    }
    const members = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) => q.eq("circleId", args.circleId))
      .take(MAX_MEMBERS);
    for (const member of members) await ctx.db.delete(member._id);
    const posts = await ctx.db
      .query("researchCirclePosts")
      .withIndex("by_circle_created", (q) => q.eq("circleId", args.circleId))
      .take(200);
    for (const post of posts) await ctx.db.delete(post._id);
    const invites = await ctx.db
      .query("researchCircleInvites")
      .withIndex("by_circle_status", (q) =>
        q.eq("circleId", args.circleId).eq("status", "pending")
      )
      .take(40);
    for (const invite of invites) await ctx.db.delete(invite._id);
    await ctx.db.delete(circle._id);
    return null;
  },
});

const postAttachmentStored = v.object({
  storageId: v.id("_storage"),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
});

const postAttachmentListed = v.object({
  storageId: v.id("_storage"),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  url: v.union(v.string(), v.null()),
});

const postDoc = v.object({
  circleId: v.id("researchCircles"),
  authorClerkId: v.string(),
  authorName: v.string(),
  body: v.string(),
  createdAt: v.number(),
  editedAt: v.optional(v.number()),
  attachments: v.array(postAttachmentListed),
  _id: v.id("researchCirclePosts"),
  _creationTime: v.number(),
});

async function bindAttachments(
  ctx: MutationCtx,
  me: string,
  attachments: Array<{
    storageId: Id<"_storage">;
    fileName?: string;
    contentType?: string;
  }>
) {
  const limited = attachments.slice(0, 5);
  for (const file of limited) {
    const upload = await ctx.db
      .query("evidenceUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", file.storageId))
      .unique();
    if (!upload || upload.uploaderClerkId !== me) {
      throw new Error("Attachment is not yours");
    }
    if (!upload.bound) {
      await ctx.db.patch(upload._id, { bound: true });
    }
  }
  return limited.map((file) => ({
    storageId: file.storageId,
    ...(file.fileName ? { fileName: file.fileName } : {}),
    ...(file.contentType ? { contentType: file.contentType } : {}),
  }));
}

async function resolvePostAttachments(
  ctx: QueryCtx,
  attachments:
    | Array<{
        storageId: Id<"_storage">;
        fileName?: string;
        contentType?: string;
      }>
    | undefined
) {
  return await Promise.all(
    (attachments ?? []).map(async (file) => ({
      storageId: file.storageId,
      fileName: file.fileName,
      contentType: file.contentType,
      url: await ctx.storage.getUrl(file.storageId),
    }))
  );
}

export const listPosts = query({
  args: { circleId: v.id("researchCircles") },
  returns: v.array(postDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = clerkUserId(identity);
    const membership = await ctx.db
      .query("researchCircleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("clerkUserId", me)
      )
      .unique();
    if (!membership) return [];
    const rows = await ctx.db
      .query("researchCirclePosts")
      .withIndex("by_circle_created", (q) => q.eq("circleId", args.circleId))
      .order("desc")
      .take(80);
    return await Promise.all(
      rows.map(async (post) => ({
        ...post,
        attachments: await resolvePostAttachments(ctx, post.attachments),
      }))
    );
  },
});

export const addPost = mutation({
  args: {
    circleId: v.id("researchCircles"),
    body: v.string(),
    attachments: v.optional(v.array(postAttachmentStored)),
  },
  returns: v.id("researchCirclePosts"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    await requireMember(ctx, args.circleId, me);
    const body = args.body.trim();
    const attachments = await bindAttachments(
      ctx,
      me,
      args.attachments ?? []
    );
    if (!body && attachments.length === 0) {
      throw new Error("Write a post or attach a file");
    }
    if (body.length > 4000) throw new Error("Post is too long");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", me))
      .unique();
    const authorName =
      user?.name ||
      (typeof identity.name === "string" && identity.name) ||
      "Member";
    const postId = await ctx.db.insert("researchCirclePosts", {
      circleId: args.circleId,
      authorClerkId: me,
      authorName,
      body,
      createdAt: Date.now(),
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    const circle = await ctx.db.get(args.circleId);
    const recipients = await resolveMentionRecipients(ctx, body);
    await notifyMany(
      ctx,
      recipients.filter((id) => id !== me),
      {
        actorClerkId: me,
        category: "mention",
        title: "Mentioned in a research circle",
        body: `${authorName} mentioned you in “${circle?.name ?? "a circle"}”`,
        href: `/circles/${args.circleId}`,
      }
    );

    return postId;
  },
});

export const deletePost = mutation({
  args: { postId: v.id("researchCirclePosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    const membership = await requireMember(ctx, post.circleId, me);
    if (post.authorClerkId !== me && membership.role !== "owner") {
      throw new Error("You can only delete your own posts");
    }
    await ctx.db.delete(post._id);
    return null;
  },
});

export const updatePost = mutation({
  args: {
    postId: v.id("researchCirclePosts"),
    body: v.string(),
    attachments: v.optional(v.array(postAttachmentStored)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = clerkUserId(identity);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await requireMember(ctx, post.circleId, me);
    if (post.authorClerkId !== me) {
      throw new Error("You can only edit your own posts");
    }
    const body = args.body.trim();
    const attachments = await bindAttachments(
      ctx,
      me,
      args.attachments ?? []
    );
    if (!body && attachments.length === 0) {
      throw new Error("Write a post or attach a file");
    }
    if (body.length > 4000) throw new Error("Post is too long");
    await ctx.db.patch(post._id, {
      body,
      editedAt: Date.now(),
      attachments,
    });

    const circle = await ctx.db.get(post.circleId);
    const recipients = await resolveMentionRecipients(ctx, body);
    await notifyMany(
      ctx,
      recipients.filter((id) => id !== me),
      {
        actorClerkId: me,
        category: "mention",
        title: "Mentioned in a research circle",
        body: `${post.authorName} mentioned you in “${circle?.name ?? "a circle"}”`,
        href: `/circles/${post.circleId}`,
      }
    );

    return null;
  },
});
