import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { UserIdentity } from "convex/server";
import { clerkUserId, requireIdentity } from "./lib/auth";
import {
  followersOfAuthorClerkIds,
  notify,
  notifyMany,
} from "./lib/notify";
import { barkStickerId, caseCategory, reportCategory } from "./lib/validators";

const MIN_BODY = 10;
const MAX_BODY = 2000;
const ASK_HREF = "/AskQuestions";

export function askQuestionHref(
  questionId: Id<"questions">,
  answerId?: Id<"questionAnswers">
) {
  return answerId
    ? `${ASK_HREF}#${questionId}:${answerId}`
    : `${ASK_HREF}#${questionId}`;
}
type CaseCategory = Infer<typeof caseCategory>;

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

const mediaArgs = {
  topic: v.optional(v.union(caseCategory, v.null())),
  sourceUrl: v.optional(v.union(v.string(), v.null())),
  imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  voiceStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  voiceDurationMs: v.optional(v.union(v.number(), v.null())),
};

const questionListItem = v.object({
  _id: v.id("questions"),
  authorClerkId: v.string(),
  authorName: v.string(),
  authorImageUrl: nullableString,
  body: v.string(),
  createdAt: v.number(),
  updatedAt: nullableNumber,
  likeCount: v.number(),
  answerCount: v.number(),
  likedByMe: v.boolean(),
  savedByMe: v.boolean(),
  followedByMe: v.boolean(),
  topic: v.union(caseCategory, v.null()),
  sourceUrl: nullableString,
  imageUrl: nullableString,
  voiceUrl: nullableString,
  imageStorageId: v.union(v.id("_storage"), v.null()),
  voiceStorageId: v.union(v.id("_storage"), v.null()),
  voiceDurationMs: nullableNumber,
  acceptedAnswerId: v.union(v.id("questionAnswers"), v.null()),
});

const answerListItem = v.object({
  _id: v.id("questionAnswers"),
  authorClerkId: v.string(),
  authorName: v.string(),
  authorImageUrl: nullableString,
  body: v.string(),
  createdAt: v.number(),
  updatedAt: nullableNumber,
  likeCount: v.number(),
  likedByMe: v.boolean(),
  topic: v.union(caseCategory, v.null()),
  sourceUrl: nullableString,
  imageUrl: nullableString,
  voiceUrl: nullableString,
  imageStorageId: v.union(v.id("_storage"), v.null()),
  voiceStorageId: v.union(v.id("_storage"), v.null()),
  voiceDurationMs: nullableNumber,
  stickerId: v.union(barkStickerId, v.null()),
});

const likeState = v.object({
  likeCount: v.number(),
  liked: v.boolean(),
});

const flagState = v.object({
  active: v.boolean(),
});

function assertSourceUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Source link must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Source link must start with http or https");
  }
  return url.toString();
}

function assertVoice(
  storageId: Id<"_storage"> | null | undefined,
  durationMs: number | null | undefined
) {
  if (!storageId) return;
  if (
    durationMs === undefined ||
    durationMs === null ||
    durationMs < 1 ||
    durationMs > 60_000
  ) {
    throw new Error("Voice notes must be 60 seconds or shorter");
  }
}

function assertPost(
  raw: string,
  extras: { image: boolean; voice: boolean; sticker: boolean }
) {
  const body = raw.trim();
  const hasMedia = extras.image || extras.voice || extras.sticker;
  if (body.length > MAX_BODY) {
    throw new Error(`Write between ${MIN_BODY} and ${MAX_BODY} characters`);
  }
  if (body.length > 0 && body.length < MIN_BODY) {
    throw new Error(`Write between ${MIN_BODY} and ${MAX_BODY} characters`);
  }
  if (!body && !hasMedia) {
    throw new Error(
      "Write a question, or add an image, voice note, or sticker"
    );
  }
  return body;
}

function mediaFields(args: {
  topic?: CaseCategory | null;
  sourceUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  voiceStorageId?: Id<"_storage"> | null;
  voiceDurationMs?: number | null;
}) {
  const source =
    args.sourceUrl && args.sourceUrl.trim()
      ? assertSourceUrl(args.sourceUrl)
      : undefined;
  assertVoice(args.voiceStorageId, args.voiceDurationMs);
  return {
    topic: args.topic ?? undefined,
    sourceUrl: source,
    imageStorageId: args.imageStorageId ?? undefined,
    voiceStorageId: args.voiceStorageId ?? undefined,
    voiceDurationMs: args.voiceStorageId ? args.voiceDurationMs ?? undefined : undefined,
  };
}

async function authorProfile(ctx: MutationCtx, identity: UserIdentity) {
  const clerkId = clerkUserId(identity);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  const authorName =
    user?.name ||
    (typeof identity.name === "string" && identity.name) ||
    "Member";
  const image = user?.imageUrl ?? identity.pictureUrl;
  return {
    authorClerkId: clerkId,
    authorName,
    ...(typeof image === "string" && image ? { authorImageUrl: image } : {}),
  };
}

async function mediaUrls(
  ctx: QueryCtx,
  row: {
    imageStorageId?: Id<"_storage">;
    voiceStorageId?: Id<"_storage">;
  }
) {
  const imageUrl = row.imageStorageId
    ? await ctx.storage.getUrl(row.imageStorageId)
    : null;
  const voiceUrl = row.voiceStorageId
    ? await ctx.storage.getUrl(row.voiceStorageId)
    : null;
  return { imageUrl, voiceUrl };
}

async function hasRow(
  ctx: QueryCtx,
  table: "questionLikes" | "questionSaves" | "questionFollows",
  questionId: Id<"questions">,
  clerkId: string
) {
  const row = await ctx.db
    .query(table)
    .withIndex("by_question_user", (q) =>
      q.eq("questionId", questionId).eq("clerkUserId", clerkId)
    )
    .unique();
  return Boolean(row);
}

async function wipeQuestion(ctx: MutationCtx, questionId: Id<"questions">) {
  const likes = await ctx.db
    .query("questionLikes")
    .withIndex("by_question_user", (q) => q.eq("questionId", questionId))
    .take(200);
  for (const row of likes) await ctx.db.delete(row._id);
  const saves = await ctx.db
    .query("questionSaves")
    .withIndex("by_question_user", (q) => q.eq("questionId", questionId))
    .take(200);
  for (const row of saves) await ctx.db.delete(row._id);
  const follows = await ctx.db
    .query("questionFollows")
    .withIndex("by_question_user", (q) => q.eq("questionId", questionId))
    .take(200);
  for (const row of follows) await ctx.db.delete(row._id);
  const reports = await ctx.db
    .query("questionReports")
    .withIndex("by_question", (q) => q.eq("questionId", questionId))
    .take(200);
  for (const row of reports) await ctx.db.delete(row._id);
  const answers = await ctx.db
    .query("questionAnswers")
    .withIndex("by_question_created", (q) => q.eq("questionId", questionId))
    .take(200);
  for (const answer of answers) {
    const answerLikes = await ctx.db
      .query("questionAnswerLikes")
      .withIndex("by_answer_user", (q) => q.eq("answerId", answer._id))
      .take(200);
    for (const like of answerLikes) await ctx.db.delete(like._id);
    await ctx.db.delete(answer._id);
  }
  await ctx.db.delete(questionId);
}

async function questionCard(
  ctx: QueryCtx,
  row: Doc<"questions">,
  clerkId: string | null
) {
  const urls = await mediaUrls(ctx, row);
  return {
    _id: row._id,
    authorClerkId: row.authorClerkId,
    authorName: row.authorName,
    authorImageUrl: row.authorImageUrl ?? null,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    likeCount: row.likeCount,
    answerCount: row.answerCount,
    likedByMe: clerkId
      ? await hasRow(ctx, "questionLikes", row._id, clerkId)
      : false,
    savedByMe: clerkId
      ? await hasRow(ctx, "questionSaves", row._id, clerkId)
      : false,
    followedByMe: clerkId
      ? await hasRow(ctx, "questionFollows", row._id, clerkId)
      : false,
    topic: row.topic ?? null,
    sourceUrl: row.sourceUrl ?? null,
    imageUrl: urls.imageUrl,
    voiceUrl: urls.voiceUrl,
    imageStorageId: row.imageStorageId ?? null,
    voiceStorageId: row.voiceStorageId ?? null,
    voiceDurationMs: row.voiceDurationMs ?? null,
    acceptedAnswerId: row.acceptedAnswerId ?? null,
  };
}

export const list = query({
  args: {},
  returns: v.array(questionListItem),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = identity ? clerkUserId(identity) : null;
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_created")
      .order("desc")
      .take(50);
    const items = [];
    for (const row of rows) {
      items.push(await questionCard(ctx, row, clerkId));
    }
    return items;
  },
});

export const get = query({
  args: { questionId: v.id("questions") },
  returns: v.union(questionListItem, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.questionId);
    if (!row) return null;
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = identity ? clerkUserId(identity) : null;
    return await questionCard(ctx, row, clerkId);
  },
});

export const create = mutation({
  args: { body: v.string(), ...mediaArgs },
  returns: v.id("questions"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const media = mediaFields(args);
    const body = assertPost(args.body, {
      image: Boolean(media.imageStorageId),
      voice: Boolean(media.voiceStorageId),
      sticker: false,
    });
    const author = await authorProfile(ctx, identity);
    const questionId = await ctx.db.insert("questions", {
      ...author,
      body,
      createdAt: Date.now(),
      likeCount: 0,
      answerCount: 0,
      ...media,
    });
    const followers = await followersOfAuthorClerkIds(
      ctx,
      author.authorClerkId
    );
    await notifyMany(ctx, followers, {
      actorClerkId: author.authorClerkId,
      category: "following",
      title: `${author.authorName} asked a question`,
      body: body || "New question",
      href: askQuestionHref(questionId),
    });
    return questionId;
  },
});

export const update = mutation({
  args: { questionId: v.id("questions"), body: v.string(), ...mediaArgs },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    if (question.authorClerkId !== clerkUserId(identity)) {
      throw new Error("You can only change your own question");
    }
    const media = mediaFields(args);
    const body = assertPost(args.body, {
      image: Boolean(media.imageStorageId),
      voice: Boolean(media.voiceStorageId),
      sticker: false,
    });
    await ctx.db.patch(question._id, {
      body,
      updatedAt: Date.now(),
      ...media,
    });
    return null;
  },
});

export const remove = mutation({
  args: { questionId: v.id("questions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    if (question.authorClerkId !== clerkUserId(identity)) {
      throw new Error("You can only change your own question");
    }
    await wipeQuestion(ctx, question._id);
    return null;
  },
});

export const toggleLike = mutation({
  args: { questionId: v.id("questions") },
  returns: likeState,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("questionLikes")
      .withIndex("by_question_user", (q) =>
        q.eq("questionId", question._id).eq("clerkUserId", clerkId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const likeCount = Math.max(0, question.likeCount - 1);
      await ctx.db.patch(question._id, { likeCount });
      return { likeCount, liked: false };
    }
    await ctx.db.insert("questionLikes", {
      questionId: question._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    const likeCount = question.likeCount + 1;
    await ctx.db.patch(question._id, { likeCount });
    return { likeCount, liked: true };
  },
});

async function toggleFlag(
  ctx: MutationCtx,
  table: "questionSaves" | "questionFollows",
  questionId: Id<"questions">,
  clerkId: string
) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_question_user", (q) =>
      q.eq("questionId", questionId).eq("clerkUserId", clerkId)
    )
    .unique();
  if (existing) {
    await ctx.db.delete(existing._id);
    return false;
  }
  await ctx.db.insert(table, {
    questionId,
    clerkUserId: clerkId,
    createdAt: Date.now(),
  });
  return true;
}

export const toggleSave = mutation({
  args: { questionId: v.id("questions") },
  returns: flagState,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    const active = await toggleFlag(
      ctx,
      "questionSaves",
      question._id,
      clerkUserId(identity)
    );
    return { active };
  },
});

export const toggleFollow = mutation({
  args: { questionId: v.id("questions") },
  returns: flagState,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    const active = await toggleFlag(
      ctx,
      "questionFollows",
      question._id,
      clerkUserId(identity)
    );
    return { active };
  },
});

export const acceptAnswer = mutation({
  args: { questionId: v.id("questions"), answerId: v.id("questionAnswers") },
  returns: v.union(v.id("questionAnswers"), v.null()),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    if (question.authorClerkId !== clerkUserId(identity)) {
      throw new Error("Only the person who asked can accept an answer");
    }
    if (question.acceptedAnswerId === args.answerId) {
      await ctx.db.patch(question._id, { acceptedAnswerId: undefined });
      return null;
    }
    const answer = await ctx.db.get(args.answerId);
    if (!answer || answer.questionId !== question._id) {
      throw new Error("Answer not found");
    }
    await ctx.db.patch(question._id, { acceptedAnswerId: answer._id });
    return answer._id;
  },
});

export const listAnswers = query({
  args: { questionId: v.id("questions") },
  returns: v.array(answerListItem),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = identity ? clerkUserId(identity) : null;
    const rows = await ctx.db
      .query("questionAnswers")
      .withIndex("by_question_created", (q) =>
        q.eq("questionId", args.questionId)
      )
      .order("asc")
      .take(100);
    const items = [];
    for (const row of rows) {
      const urls = await mediaUrls(ctx, row);
      let likedByMe = false;
      if (clerkId) {
        const like = await ctx.db
          .query("questionAnswerLikes")
          .withIndex("by_answer_user", (q) =>
            q.eq("answerId", row._id).eq("clerkUserId", clerkId)
          )
          .unique();
        likedByMe = Boolean(like);
      }
      items.push({
        _id: row._id,
        authorClerkId: row.authorClerkId,
        authorName: row.authorName,
        authorImageUrl: row.authorImageUrl ?? null,
        body: row.body,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? null,
        likeCount: row.likeCount ?? 0,
        likedByMe,
        topic: row.topic ?? null,
        sourceUrl: row.sourceUrl ?? null,
        imageUrl: urls.imageUrl,
        voiceUrl: urls.voiceUrl,
        imageStorageId: row.imageStorageId ?? null,
        voiceStorageId: row.voiceStorageId ?? null,
        voiceDurationMs: row.voiceDurationMs ?? null,
        stickerId: row.stickerId ?? null,
      });
    }
    return items;
  },
});

export const addAnswer = mutation({
  args: {
    questionId: v.id("questions"),
    body: v.string(),
    stickerId: v.optional(v.union(barkStickerId, v.null())),
    ...mediaArgs,
  },
  returns: v.id("questionAnswers"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    const media = mediaFields(args);
    const body = assertPost(args.body, {
      image: Boolean(media.imageStorageId),
      voice: Boolean(media.voiceStorageId),
      sticker: Boolean(args.stickerId),
    });
    const author = await authorProfile(ctx, identity);
    const answerId = await ctx.db.insert("questionAnswers", {
      questionId: question._id,
      ...author,
      body,
      createdAt: Date.now(),
      likeCount: 0,
      ...media,
      ...(args.stickerId ? { stickerId: args.stickerId } : {}),
    });
    await ctx.db.patch(question._id, {
      answerCount: question.answerCount + 1,
    });
    const actor = clerkUserId(identity);
    const follows = await ctx.db
      .query("questionFollows")
      .withIndex("by_question_user", (q) => q.eq("questionId", question._id))
      .take(100);
    const recipients = new Set<string>([
      question.authorClerkId,
      ...follows.map((row) => row.clerkUserId),
    ]);
    const preview = body || "New answer on a question you follow";
    for (const recipientClerkId of recipients) {
      await notify(ctx, {
        recipientClerkId,
        actorClerkId: actor,
        category: "reply",
        title: "New answer",
        body: preview,
        href: askQuestionHref(question._id, answerId),
      });
    }
    return answerId;
  },
});

export const updateAnswer = mutation({
  args: {
    answerId: v.id("questionAnswers"),
    body: v.string(),
    stickerId: v.optional(v.union(barkStickerId, v.null())),
    ...mediaArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const answer = await ctx.db.get(args.answerId);
    if (!answer) throw new Error("Answer not found");
    if (answer.authorClerkId !== clerkUserId(identity)) {
      throw new Error("You can only change your own answer");
    }
    const media = mediaFields(args);
    const body = assertPost(args.body, {
      image: Boolean(media.imageStorageId),
      voice: Boolean(media.voiceStorageId),
      sticker: Boolean(args.stickerId),
    });
    await ctx.db.patch(answer._id, {
      body,
      updatedAt: Date.now(),
      stickerId: args.stickerId ?? undefined,
      ...media,
    });
    return null;
  },
});

export const removeAnswer = mutation({
  args: { answerId: v.id("questionAnswers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const answer = await ctx.db.get(args.answerId);
    if (!answer) throw new Error("Answer not found");
    if (answer.authorClerkId !== clerkUserId(identity)) {
      throw new Error("You can only change your own answer");
    }
    const question = await ctx.db.get(answer.questionId);
    const likes = await ctx.db
      .query("questionAnswerLikes")
      .withIndex("by_answer_user", (q) => q.eq("answerId", answer._id))
      .take(200);
    for (const like of likes) await ctx.db.delete(like._id);
    if (question?.acceptedAnswerId === answer._id) {
      await ctx.db.patch(question._id, { acceptedAnswerId: undefined });
    }
    if (question) {
      await ctx.db.patch(question._id, {
        answerCount: Math.max(0, question.answerCount - 1),
      });
    }
    await ctx.db.delete(answer._id);
    return null;
  },
});

export const toggleAnswerLike = mutation({
  args: { answerId: v.id("questionAnswers") },
  returns: likeState,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const answer = await ctx.db.get(args.answerId);
    if (!answer) throw new Error("Answer not found");
    const clerkId = clerkUserId(identity);
    const existing = await ctx.db
      .query("questionAnswerLikes")
      .withIndex("by_answer_user", (q) =>
        q.eq("answerId", answer._id).eq("clerkUserId", clerkId)
      )
      .unique();
    const current = answer.likeCount ?? 0;
    if (existing) {
      await ctx.db.delete(existing._id);
      const likeCount = Math.max(0, current - 1);
      await ctx.db.patch(answer._id, { likeCount });
      return { likeCount, liked: false };
    }
    await ctx.db.insert("questionAnswerLikes", {
      answerId: answer._id,
      clerkUserId: clerkId,
      createdAt: Date.now(),
    });
    const likeCount = current + 1;
    await ctx.db.patch(answer._id, { likeCount });
    return { likeCount, liked: true };
  },
});

export const report = mutation({
  args: {
    questionId: v.id("questions"),
    answerId: v.optional(v.id("questionAnswers")),
    category: reportCategory,
    details: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const question = await ctx.db.get(args.questionId);
    if (!question) throw new Error("Question not found");
    if (args.answerId) {
      const answer = await ctx.db.get(args.answerId);
      if (!answer || answer.questionId !== question._id) {
        throw new Error("Answer not found");
      }
    }
    const details = args.details.trim();
    if (details.length < 10 || details.length > 2000) {
      throw new Error("Describe the report in 10 to 2000 characters");
    }
    await ctx.db.insert("questionReports", {
      questionId: question._id,
      ...(args.answerId ? { answerId: args.answerId } : {}),
      targetKind: args.answerId ? "answer" : "question",
      category: args.category,
      details,
      reporterClerkId: clerkUserId(identity),
      createdAt: Date.now(),
      status: "open",
    });
    return null;
  },
});
