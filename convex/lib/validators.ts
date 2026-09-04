import { v } from "convex/values";

export const barkType = v.union(
  v.literal("agree"),
  v.literal("disagree"),
  v.literal("mixed"),
  v.literal("unpack")
);

export const barkStatus = v.union(v.literal("public"), v.literal("draft"));

export const caseCategory = v.union(
  v.literal("racism"),
  v.literal("discrimination"),
  v.literal("harassment"),
  v.literal("misinformation"),
  v.literal("fabricated-content"),
  v.literal("undisclosed-sponsorship"),
  v.literal("scam"),
  v.literal("plagiarism")
);

export const evidenceType = v.union(
  v.literal("screenshot"),
  v.literal("document"),
  v.literal("video"),
  v.literal("link"),
  v.literal("timestamp"),
  v.literal("research")
);

export const sourcePlatform = v.union(
  v.literal("youtube"),
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("facebook"),
  v.literal("x"),
  v.literal("podcast"),
  v.literal("article"),
  v.literal("book"),
  v.literal("interview"),
  v.literal("speech"),
  v.literal("livestream"),
  v.literal("statement")
);

export const evidenceItem = v.object({
  type: evidenceType,
  title: v.string(),
  url: v.string(),
  storageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  attestCount: v.optional(v.number()),
  challengeCount: v.optional(v.number()),
});

export const contentBlock = v.union(
  v.object({ kind: v.literal("heading"), text: v.string() }),
  v.object({ kind: v.literal("paragraph"), text: v.string() }),
  v.object({
    kind: v.literal("quote"),
    text: v.string(),
    attribution: v.optional(v.string()),
  }),
  v.object({ kind: v.literal("list"), items: v.array(v.string()) }),
  v.object({ kind: v.literal("evidence"), evidenceId: v.string() })
);

export const barkDialogueTurn = v.object({
  role: v.union(v.literal("creator"), v.literal("author")),
  content: v.string(),
  respondedAt: v.number(),
  verified: v.boolean(),
  evidence: v.optional(v.array(evidenceItem)),
});

export const evidenceUploadFields = {
  storageId: v.id("_storage"),
  uploaderClerkId: v.string(),
  createdAt: v.number(),
  bound: v.boolean(),
};

export const userFields = {
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  username: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  updatedAt: v.number(),
};

export const organizationFields = {
  clerkId: v.string(),
  name: v.string(),
  slug: v.string(),
  updatedAt: v.number(),
};

export const membershipFields = {
  clerkMembershipId: v.string(),
  clerkOrgId: v.string(),
  clerkUserId: v.string(),
  role: v.string(),
  updatedAt: v.number(),
};

export const subscriptionFields = {
  clerkId: v.string(),
  payerId: v.string(),
  status: v.string(),
  plan: v.optional(v.string()),
  updatedAt: v.number(),
};

export const webhookEventFields = {
  type: v.string(),
  clerkId: v.string(),
  at: v.number(),
};

export const caseCreatorResponse = v.object({
  content: v.string(),
  respondedAt: v.number(),
  verified: v.boolean(),
});

/** Same shape as case official creator responses — reused on barks. */
export const barkCreatorResponse = caseCreatorResponse;

export const barkDocFields = {
  code: v.string(),
  type: barkType,
  title: v.string(),
  body: v.string(),
  excerpt: v.string(),
  status: barkStatus,
  authorClerkId: v.string(),
  authorName: v.string(),
  authorImageUrl: v.optional(v.string()),
  orgClerkId: v.union(v.string(), v.null()),
  sourceUrl: v.string(),
  sourceTitle: v.string(),
  sourcePlatform,
  sourceCreatorName: v.string(),
  sourceCreatorId: v.optional(v.id("creators")),
  sourceThumbnailUrl: v.optional(v.string()),
  evidence: v.array(evidenceItem),
  evidenceRating: v.number(),
  publishedAt: v.number(),
  replyCount: v.number(),
  upvotes: v.number(),
  saves: v.number(),
  views: v.number(),
  country: v.optional(v.string()),
  creatorResponse: v.optional(barkCreatorResponse),
  creatorDialogue: v.optional(v.array(barkDialogueTurn)),
  topics: v.optional(v.array(caseCategory)),
  contentBlocks: v.optional(v.array(contentBlock)),
  version: v.optional(v.number()),
  amendedAt: v.optional(v.number()),
  promotedCaseCode: v.optional(v.string()),
  quotedBarkCode: v.optional(v.string()),
  claims: v.optional(
    v.array(
      v.object({
        id: v.string(),
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
};

export const barkTopicLinkFields = {
  barkId: v.id("barks"),
  topic: caseCategory,
  status: barkStatus,
  publishedAt: v.number(),
};

export const creatorReviewFields = {
  code: v.string(),
  creatorId: v.id("creators"),
  type: barkType,
  title: v.string(),
  body: v.string(),
  excerpt: v.string(),
  status: barkStatus,
  authorClerkId: v.string(),
  authorName: v.string(),
  authorImageUrl: v.optional(v.string()),
  orgClerkId: v.union(v.string(), v.null()),
  evidence: v.array(evidenceItem),
  evidenceRating: v.number(),
  publishedAt: v.number(),
  replyCount: v.number(),
  upvotes: v.number(),
  saves: v.number(),
  views: v.number(),
  country: v.optional(v.string()),
};

export const reportCategory = v.union(
  v.literal("hate-speech"),
  v.literal("discrimination"),
  v.literal("harassment"),
  v.literal("doxxing"),
  v.literal("fabricated-evidence"),
  v.literal("misinformation"),
  v.literal("spam"),
  v.literal("impersonation"),
  v.literal("other")
);

export const barkLikeFields = {
  barkId: v.id("barks"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const barkSaveFields = {
  barkId: v.id("barks"),
  clerkUserId: v.string(),
  createdAt: v.number(),
  collectionId: v.optional(v.id("saveCollections")),
  note: v.optional(v.string()),
};

export const saveCollectionFields = {
  clerkUserId: v.string(),
  name: v.string(),
  createdAt: v.number(),
};

export const evidenceRequestStatus = v.union(
  v.literal("open"),
  v.literal("resolved"),
  v.literal("dismissed")
);

export const evidenceRequestFields = {
  barkId: v.id("barks"),
  blockIndex: v.number(),
  blockHash: v.string(),
  claimSnippet: v.string(),
  note: v.optional(v.string()),
  requesterClerkId: v.string(),
  requesterName: v.string(),
  status: evidenceRequestStatus,
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
  resolvedByClerkId: v.optional(v.string()),
};

export const userMuteKind = v.union(v.literal("author"), v.literal("topic"));

export const userMuteFields = {
  clerkUserId: v.string(),
  kind: userMuteKind,
  targetClerkId: v.optional(v.string()),
  topic: v.optional(caseCategory),
  createdAt: v.number(),
};

export const contentVisitFields = {
  clerkUserId: v.string(),
  targetKind: v.union(v.literal("bark"), v.literal("case")),
  targetCode: v.string(),
  lastVisitedAt: v.number(),
};

export const barkCommunityNoteFields = {
  barkId: v.id("barks"),
  authorClerkId: v.string(),
  authorName: v.string(),
  text: v.string(),
  createdAt: v.number(),
  helpfulCount: v.number(),
  notHelpfulCount: v.number(),
};

export const barkCommunityNoteVoteFields = {
  noteId: v.id("barkCommunityNotes"),
  clerkUserId: v.string(),
  vote: v.union(v.literal("helpful"), v.literal("not")),
  createdAt: v.number(),
};

export const researchCircleAnchorKind = v.union(
  v.literal("case"),
  v.literal("topic")
);

export const researchCircleFields = {
  name: v.string(),
  description: v.optional(v.string()),
  anchorKind: researchCircleAnchorKind,
  caseCode: v.optional(v.string()),
  topic: v.optional(caseCategory),
  ownerClerkId: v.string(),
  createdAt: v.number(),
};

export const researchCircleMemberFields = {
  circleId: v.id("researchCircles"),
  clerkUserId: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
  joinedAt: v.number(),
};

export const researchCirclePostFields = {
  circleId: v.id("researchCircles"),
  authorClerkId: v.string(),
  authorName: v.string(),
  body: v.string(),
  createdAt: v.number(),
  editedAt: v.optional(v.number()),
  attachments: v.optional(
    v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.optional(v.string()),
        contentType: v.optional(v.string()),
      })
    )
  ),
};

export const researchCircleInviteStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled")
);

export const researchCircleInviteFields = {
  circleId: v.id("researchCircles"),
  inviterClerkId: v.string(),
  inviteeClerkId: v.string(),
  inviteeUsername: v.string(),
  status: researchCircleInviteStatus,
  createdAt: v.number(),
  respondedAt: v.optional(v.number()),
};

export const barkViewFields = {
  barkId: v.id("barks"),
  viewerKey: v.string(),
  dayKey: v.string(),
};

export const barkVersionFields = {
  barkId: v.id("barks"),
  version: v.number(),
  title: v.string(),
  body: v.string(),
  excerpt: v.string(),
  contentBlocks: v.optional(v.array(contentBlock)),
  changeNote: v.string(),
  authorClerkId: v.string(),
  createdAt: v.number(),
};

export const barkEvidenceVoteFields = {
  barkId: v.id("barks"),
  evidenceIndex: v.number(),
  clerkUserId: v.string(),
  vote: v.union(v.literal("attest"), v.literal("challenge")),
  createdAt: v.number(),
};

export const barkStickerId = v.union(
  v.literal("tea"),
  v.literal("bark"),
  v.literal("evidence"),
  v.literal("agree"),
  v.literal("disagree"),
  v.literal("mixed"),
  v.literal("unpack"),
  v.literal("verified"),
  v.literal("casefile"),
  v.literal("clap")
);

export const barkCommentFields = {
  barkId: v.id("barks"),
  parentId: v.optional(v.id("barkComments")),
  body: v.string(),
  authorClerkId: v.string(),
  authorName: v.string(),
  authorImageUrl: v.optional(v.string()),
  stickerId: v.optional(barkStickerId),
  voiceStorageId: v.optional(v.id("_storage")),
  voiceDurationMs: v.optional(v.number()),
  createdAt: v.number(),
};

export const barkReportFields = {
  barkId: v.id("barks"),
  targetKind: v.union(v.literal("bark"), v.literal("comment")),
  targetId: v.string(),
  category: reportCategory,
  details: v.string(),
  reporterClerkId: v.string(),
  createdAt: v.number(),
  status: v.optional(v.union(v.literal("open"), v.literal("dismissed"))),
};

export const caseFollowFields = {
  caseId: v.id("cases"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const caseSaveFields = {
  caseId: v.id("cases"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const sourceSaveFields = {
  clerkUserId: v.string(),
  sourceUrl: v.string(),
  sourceTitle: v.string(),
  sourcePlatform,
  sourceCreatorName: v.string(),
  sourceThumbnailUrl: v.optional(v.string()),
  createdAt: v.number(),
};

export const creatorFollowFields = {
  creatorId: v.id("creators"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const userFollowFields = {
  targetClerkId: v.string(),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const notificationCategory = v.union(
  v.literal("reply"),
  v.literal("mention"),
  v.literal("follower"),
  v.literal("following"),
  v.literal("creator-response"),
  v.literal("evidence"),
  v.literal("verification"),
  v.literal("message"),
  v.literal("circle")
);

export const notificationFields = {
  recipientClerkId: v.string(),
  actorClerkId: v.optional(v.string()),
  category: notificationCategory,
  title: v.string(),
  body: v.string(),
  href: v.string(),
  read: v.boolean(),
  createdAt: v.number(),
};

export const notificationPrefsFields = {
  clerkUserId: v.string(),
  reply: v.boolean(),
  mention: v.boolean(),
  follower: v.boolean(),
  followingActivity: v.optional(v.boolean()),
  creatorResponse: v.boolean(),
  evidence: v.boolean(),
  verification: v.boolean(),
  soundEnabled: v.boolean(),
  digestWeekly: v.boolean(),
  digestCaseEmail: v.boolean(),
  message: v.optional(v.boolean()),
  circle: v.optional(v.boolean()),
  emailEnabled: v.optional(v.boolean()),
  unreadCount: v.number(),
};

export const caseReportFields = {
  caseId: v.id("cases"),
  category: reportCategory,
  details: v.string(),
  reporterClerkId: v.string(),
  createdAt: v.number(),
  status: v.optional(v.union(v.literal("open"), v.literal("dismissed"))),
};

export const caseStatus = v.union(
  v.literal("open"),
  v.literal("under-review"),
  v.literal("responded"),
  v.literal("resolved"),
  v.literal("archived")
);

export const claimStatus = v.union(
  v.literal("supported"),
  v.literal("disputed"),
  v.literal("unverified"),
  v.literal("refuted")
);

export const caseClaimItem = v.object({
  id: v.string(),
  text: v.string(),
  status: claimStatus,
  evidenceIds: v.array(v.string()),
});

export const caseEvidenceItem = v.object({
  id: v.string(),
  type: evidenceType,
  title: v.string(),
  url: v.string(),
});

export const caseTimelineItem = v.object({
  id: v.string(),
  date: v.number(),
  title: v.string(),
  description: v.string(),
  type: v.union(
    v.literal("created"),
    v.literal("evidence"),
    v.literal("response"),
    v.literal("status"),
    v.literal("analysis")
  ),
});

export const caseCommunityNote = v.object({
  authorClerkId: v.string(),
  authorName: v.string(),
  text: v.string(),
  postedAt: v.number(),
});

export const caseDocFields = {
  code: v.string(),
  title: v.string(),
  summary: v.string(),
  status: caseStatus,
  category: caseCategory,
  creatorId: v.string(),
  creatorName: v.string(),
  creatorHandle: v.string(),
  creatorVerified: v.boolean(),
  openedByClerkId: v.string(),
  openedByName: v.string(),
  orgClerkId: v.optional(v.string()),
  openedAt: v.number(),
  updatedAt: v.number(),
  followers: v.number(),
  claims: v.array(caseClaimItem),
  evidence: v.array(caseEvidenceItem),
  timeline: v.array(caseTimelineItem),
  strengths: v.array(v.string()),
  weaknesses: v.array(v.string()),
  contradictions: v.array(v.string()),
  missingEvidence: v.array(v.string()),
  communityAnalysis: v.optional(v.array(caseCommunityNote)),
  creatorResponse: v.optional(caseCreatorResponse),
};

export const caseClaimInput = v.object({
  text: v.string(),
  evidence: v.array(
    v.object({
      type: evidenceType,
      title: v.string(),
      url: v.string(),
    })
  ),
});

export const creatorStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("unclaimed")
);

export const creatorVerificationMethod = v.union(
  v.literal("connect"),
  v.literal("code")
);

export const creatorLink = v.object({
  label: v.string(),
  url: v.string(),
});

export const creatorDocFields = {
  applicationCode: v.string(),
  handle: v.string(),
  name: v.string(),
  bio: v.string(),
  country: v.string(),
  category: v.string(),
  platforms: v.array(sourcePlatform),
  officialLinks: v.array(creatorLink),
  verificationMethod: creatorVerificationMethod,
  applicantClerkId: v.string(),
  applicantName: v.string(),
  status: creatorStatus,
  verified: v.boolean(),
  followers: v.number(),
  totalSources: v.number(),
  totalBarksReceived: v.number(),
  responseRate: v.number(),
  externalPlatform: v.optional(sourcePlatform),
  externalHandle: v.optional(v.string()),
  profileImageUrl: v.optional(v.string()),
  officialResponseCount: v.optional(v.number()),
  linkedByClerkId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const creatorVerificationStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("approved"),
  v.literal("rejected")
);

export const emergencyContactFields = v.object({
  name: v.string(),
  phone: v.string(),
  relationship: v.string(),
});

export const creatorVerificationFields = {
  creatorId: v.id("creators"),
  applicantClerkId: v.string(),
  legalName: v.string(),
  email: v.string(),
  phone: v.string(),
  verificationId: v.string(),
  proofPostUrl: v.optional(v.string()),
  emergencyContacts: v.array(emergencyContactFields),
  status: creatorVerificationStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const storyGenre = v.union(
  v.literal("true-crime"),
  v.literal("unsolved-cases"),
  v.literal("missing-persons"),
  v.literal("cold-cases"),
  v.literal("court-cases"),
  v.literal("police-investigations"),
  v.literal("scary-stories"),
  v.literal("unexplained"),
  v.literal("ufo-uap"),
  v.literal("mysteries"),
  v.literal("historical-mysteries"),
  v.literal("history"),
  v.literal("ancient-mysteries"),
  v.literal("legends-folklore"),
  v.literal("strange-cases"),
  v.literal("witness-stories"),
  v.literal("untold-stories"),
  v.literal("forgotten-stories"),
  v.literal("disasters-accidents"),
  v.literal("aviation"),
  v.literal("maritime"),
  v.literal("survival"),
  v.literal("human-stories"),
  v.literal("survivor-stories"),
  v.literal("tragedies"),
  v.literal("scams-frauds"),
  v.literal("corporate-stories"),
  v.literal("science-mysteries"),
  v.literal("ocean-mysteries"),
  v.literal("lost-places-discoveries"),
  v.literal("remarkable-people"),
  v.literal("inspiring-stories"),
  v.literal("investigations"),
  v.literal("justice-convictions"),
  v.literal("teabarks-originals"),
  v.literal("fantasy"),
  v.literal("romance"),
  v.literal("scifi"),
  v.literal("mystery"),
  v.literal("horror"),
  v.literal("teen-fiction"),
  v.literal("historical"),
  v.literal("poetry")
);

export const writerStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected")
);

export const writerLanguage = v.union(
  v.literal("en"),
  v.literal("ar"),
  v.literal("es"),
  v.literal("fr"),
  v.literal("hi")
);

export const writerCadence = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("complete")
);

export const writerDocFields = {
  applicationCode: v.string(),
  handle: v.string(),
  penName: v.string(),
  language: writerLanguage,
  genres: v.array(storyGenre),
  sampleTitle: v.string(),
  sample: v.string(),
  cadence: writerCadence,
  originalityAccepted: v.boolean(),
  policyAccepted: v.boolean(),
  applicantClerkId: v.string(),
  applicantName: v.string(),
  status: writerStatus,
  followers: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const storyStatus = v.union(
  v.literal("ongoing"),
  v.literal("completed"),
  v.literal("on-hiatus")
);

export const storyVisibility = v.union(
  v.literal("draft"),
  v.literal("public")
);

export const storyChapterStatus = v.union(
  v.literal("draft"),
  v.literal("published")
);

export const storyDocFields = {
  slug: v.string(),
  title: v.string(),
  blurb: v.string(),
  genre: storyGenre,
  tags: v.array(v.string()),
  status: storyStatus,
  visibility: storyVisibility,
  mature: v.boolean(),
  writerId: v.id("writers"),
  authorClerkId: v.string(),
  coverImage: v.optional(v.string()),
  coverStorageId: v.optional(v.id("_storage")),
  coverMode: v.optional(v.union(v.literal("url"), v.literal("storage"))),
  reads: v.number(),
  votes: v.number(),
  commentCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const storyChapterDocFields = {
  storyId: v.id("stories"),
  number: v.number(),
  title: v.string(),
  body: v.string(),
  wordCount: v.number(),
  status: storyChapterStatus,
  publishedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const storyLikeFields = {
  storyId: v.id("stories"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const storyWriterFollowFields = {
  writerId: v.id("writers"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const storyCommentFields = {
  storyId: v.id("stories"),
  chapterNumber: v.optional(v.number()),
  parentId: v.optional(v.id("storyComments")),
  body: v.string(),
  authorClerkId: v.string(),
  authorName: v.string(),
  createdAt: v.number(),
};

export const storyReportFields = {
  storyId: v.id("stories"),
  category: reportCategory,
  details: v.string(),
  reporterClerkId: v.string(),
  createdAt: v.number(),
  status: v.optional(v.union(v.literal("open"), v.literal("dismissed"))),
};

export const storyReadFields = {
  storyId: v.id("stories"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const contestStatus = v.union(v.literal("active"), v.literal("closed"));

export const contestDocFields = {
  slug: v.string(),
  name: v.string(),
  theme: v.string(),
  prize: v.string(),
  description: v.string(),
  status: contestStatus,
  deadlineAt: v.number(),
  entryCount: v.number(),
  winnerSlug: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const contestEntryFields = {
  contestId: v.id("contests"),
  storyId: v.id("stories"),
  writerId: v.id("writers"),
  clerkUserId: v.string(),
  createdAt: v.number(),
};

export const contestJudgmentFields = {
  contestId: v.id("contests"),
  entryId: v.id("contestEntries"),
  clerkUserId: v.string(),
  score: v.number(),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
};

export const messageSubjectKind = v.union(
  v.literal("bark"),
  v.literal("case"),
  v.literal("creator"),
  v.literal("direct")
);

export const messageThreadFields = {
  pairKey: v.string(),
  subjectKind: messageSubjectKind,
  barkId: v.optional(v.id("barks")),
  caseId: v.optional(v.id("cases")),
  creatorId: v.optional(v.id("creators")),
  clerkA: v.string(),
  clerkB: v.string(),
  lastMessageAt: v.number(),
  lastPreview: v.string(),
};

export const messageMembershipFields = {
  threadId: v.id("messageThreads"),
  clerkUserId: v.string(),
  otherClerkId: v.string(),
  lastMessageAt: v.number(),
  lastPreview: v.string(),
  unreadCount: v.number(),
  lastReadAt: v.number(),
};

export const messageFields = {
  threadId: v.id("messageThreads"),
  senderClerkId: v.string(),
  body: v.string(),
  createdAt: v.number(),
  attachments: v.optional(
    v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.optional(v.string()),
        contentType: v.optional(v.string()),
      })
    )
  ),
};

export const moderationEventKind = v.union(
  v.literal("report"),
  v.literal("report_dismiss"),
  v.literal("creator_approve"),
  v.literal("creator_reject"),
  v.literal("writer_approve"),
  v.literal("writer_reject"),
  v.literal("case_publish"),
  v.literal("case_resolve")
);

export const moderationEventFields = {
  kind: moderationEventKind,
  actorClerkId: v.string(),
  actorName: v.string(),
  targetLabel: v.string(),
  note: v.string(),
  createdAt: v.number(),
};

export const contentLanguages = v.union(
  v.literal("en-ar"),
  v.literal("en"),
  v.literal("all")
);

export const userSettingsFields = {
  clerkUserId: v.string(),
  bio: v.optional(v.string()),
  website: v.optional(v.string()),
  country: v.optional(v.string()),
  publicProfile: v.optional(v.boolean()),
  showCountry: v.optional(v.boolean()),
  searchable: v.optional(v.boolean()),
  dmAnyone: v.optional(v.boolean()),
  activityStatus: v.optional(v.boolean()),
  prioritizeLocalFeed: v.optional(v.boolean()),
  regionalTrends: v.optional(v.boolean()),
  contentLanguages: v.optional(contentLanguages),
  autoTranslate: v.optional(v.boolean()),
  updatedAt: v.number(),
};

export const learningResourceType = v.union(
  v.literal("video"),
  v.literal("article"),
  v.literal("download")
);

export const learningCategory = v.union(
  v.literal("getting-started"),
  v.literal("evidence"),
  v.literal("reactions"),
  v.literal("cases"),
  v.literal("creators"),
  v.literal("platform")
);

export const learningResourceStatus = v.union(
  v.literal("draft"),
  v.literal("published")
);

export const learningResourceFields = {
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  type: learningResourceType,
  category: learningCategory,
  status: learningResourceStatus,
  sortOrder: v.number(),
  durationMinutes: v.optional(v.number()),
  thumbnailUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  videoPlatform: v.optional(sourcePlatform),
  contentBlocks: v.optional(v.array(contentBlock)),
  fileStorageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  fileContentType: v.optional(v.string()),
  externalDownloadUrl: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  updatedAt: v.number(),
  authorClerkId: v.string(),
};
