export type SourcePlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "x"
  | "podcast"
  | "article"
  | "book"
  | "interview"
  | "speech"
  | "livestream"
  | "statement";

export type BarkType = "agree" | "disagree" | "mixed" | "unpack";

export type EvidenceType =
  | "screenshot"
  | "document"
  | "video"
  | "link"
  | "timestamp"
  | "research";

export type CaseStatus =
  | "open"
  | "under-review"
  | "responded"
  | "resolved"
  | "archived";

export type ClaimStatus = "supported" | "disputed" | "unverified" | "refuted";

export type OrgRole =
  | "owner"
  | "admin"
  | "editor"
  | "writer"
  | "researcher"
  | "viewer";

export type NotificationCategory =
  | "reply"
  | "mention"
  | "follower"
  | "following"
  | "creator-response"
  | "evidence"
  | "verification"
  | "message"
  | "circle";

export type ReportCategory =
  | "hate-speech"
  | "discrimination"
  | "harassment"
  | "doxxing"
  | "fabricated-evidence"
  | "misinformation"
  | "spam"
  | "impersonation"
  | "other";

export type ReportSeverity = "severe" | "high" | "moderate";

export type CaseCategory =
  | "racism"
  | "discrimination"
  | "harassment"
  | "misinformation"
  | "fabricated-content"
  | "undisclosed-sponsorship"
  | "scam"
  | "plagiarism";

export type CreatorStatus = "unclaimed" | "pending" | "approved" | "rejected";

export interface CreatorOfficialResponse {
  content: string;
  respondedAt: string;
  verified: boolean;
}

export interface Creator {
  id: string;
  handle: string;
  name: string;
  bio: string;
  verified: boolean;
  hasTeaBarksProfile: boolean;
  status?: CreatorStatus;
  externalHandle?: string;
  externalPlatform?: SourcePlatform;
  profileImageUrl?: string;
  officialResponseCount?: number;
  platforms: SourcePlatform[];
  officialLinks: { label: string; url: string }[];
  followers: number;
  country: string;
  topics: string[];
  totalSources: number;
  totalBarksReceived: number;
  /** Percentage of cases/barks the creator has officially responded to */
  responseRate: number;
  joinedAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  bio: string;
  verified: boolean;
  country: string;
  followers: number;
  following: number;
  barkCount: number;
  /** 0-100 community evidence quality score */
  evidenceScore: number;
  joinedAt: string;
}

export interface Source {
  id: string;
  platform: SourcePlatform;
  url: string;
  title: string;
  creatorId: string;
  publishedAt: string;
  category: string;
  language: string;
  /** e.g. "42:18" for videos, "38 min read" for articles */
  length?: string;
  barkCount: number;
  replyChainCount: number;
  caseCount: number;
  engagement: number;
  /** 0-100 aggregate evidence rating across barks */
  evidenceRating: number;
  thumbnailUrl?: string;
  creatorName?: string;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  url?: string;
  fileName?: string;
  contentType?: string;
  /** For timestamp evidence, e.g. "14:32" */
  timestamp?: string;
  addedById: string;
  addedByName?: string;
  addedAt: string;
  verified: boolean;
  attestCount?: number;
  challengeCount?: number;
  myVote?: "attest" | "challenge" | null;
}

export type ContentBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string; attribution?: string }
  | { kind: "evidence"; evidenceId: string }
  | { kind: "list"; items: string[] };

export interface BarkDialogueTurn {
  role: "creator" | "author";
  content: string;
  respondedAt: string;
  verified: boolean;
  evidence?: Evidence[];
}

export interface BarkVersionSummary {
  version: number;
  changeNote: string;
  createdAt: string;
  title: string;
  excerpt: string;
}

export interface BarkClaim {
  id: string;
  text: string;
  status: ClaimStatus;
  evidenceIndexes: number[];
}

export interface Bark {
  id: string;
  code: string;
  type: BarkType;
  title: string;
  authorId: string;
  sourceId: string;
  publishedAt: string;
  updatedAt?: string;
  excerpt: string;
  content: ContentBlock[];
  evidence: Evidence[];
  /** 0-100 evidence strength rating */
  evidenceRating: number;
  replyCount: number;
  upvotes: number;
  saves: number;
  views: number;
  topics: string[];
  country: string;
  featured?: boolean;
  authorName?: string;
  sourceTitle?: string;
  sourcePlatform?: SourcePlatform;
  sourceUrl?: string;
  sourceCreatorName?: string;
  sourceCreatorId?: string;
  sourceThumbnailUrl?: string;
  creatorResponse?: CreatorOfficialResponse;
  creatorDialogue?: BarkDialogueTurn[];
  version?: number;
  amendedAt?: string;
  promotedCaseCode?: string;
  quotedBarkCode?: string;
  claims?: BarkClaim[];
  live?: boolean;
  status?: "public" | "draft";
}

export interface CreatorReview {
  id: string;
  code: string;
  type: BarkType;
  title: string;
  creatorId: string;
  creatorName?: string;
  creatorHandle?: string;
  authorId: string;
  authorName?: string;
  publishedAt: string;
  excerpt: string;
  content: ContentBlock[];
  evidence: Evidence[];
  evidenceRating: number;
  replyCount: number;
  upvotes: number;
  saves: number;
  views: number;
  country: string;
  live?: boolean;
}

export interface Reply {
  id: string;
  barkId: string;
  authorId: string;
  parentId?: string;
  content: string;
  postedAt: string;
  reactions: { insightful: number; agree: number; disagree: number };
  evidence?: Evidence[];
  isCreatorResponse?: boolean;
  mentions?: string[];
}

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  evidenceIds: string[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "created" | "evidence" | "response" | "status" | "analysis";
}

export interface CaseVersion {
  version: number;
  label: string;
  description: string;
  date: string;
}

export interface CommunityNote {
  authorId: string;
  authorName?: string;
  text: string;
  postedAt: string;
}

export interface AccountabilityCase {
  id: string;
  code: string;
  title: string;
  status: CaseStatus;
  sourceId: string;
  creatorId: string;
  openedById: string;
  openedAt: string;
  updatedAt: string;
  summary: string;
  claims: Claim[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  strengths: string[];
  weaknesses: string[];
  contradictions: string[];
  missingEvidence: string[];
  communityAnalysis: CommunityNote[];
  creatorResponse?: {
    content: string;
    respondedAt: string;
    verified: boolean;
  };
  versions: CaseVersion[];
  followers: number;
  category?: CaseCategory;
  creatorName?: string;
  creatorHandle?: string;
  creatorVerified?: boolean;
  openedByName?: string;
  live?: boolean;
}

export interface Topic {
  slug: string;
  name: string;
  description: string;
  barkCount: number;
  caseCount: number;
  trending: boolean;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  barkCount: number;
  activeDiscussions: number;
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  status: "active" | "invited" | "suspended";
  lastLogin: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  verified: boolean;
  members: OrgMember[];
  stats: {
    totalBarks: number;
    activeCases: number;
    teamMembers: number;
    researchActivity: number;
  };
  activity: { month: string; barks: number; cases: number; evidence: number }[];
}

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  time: string;
  read: boolean;
  href: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  read: boolean;
  attachment?: { name: string; type: "pdf" | "image" | "doc" };
}

export interface Conversation {
  id: string;
  participantId: string;
  messages: Message[];
  unread: number;
}

export type LearningResourceType = "video" | "article" | "download";

export type LearningCategory =
  | "getting-started"
  | "evidence"
  | "reactions"
  | "cases"
  | "creators"
  | "platform";

export type LearningResourceStatus = "draft" | "published";

export interface LearningResource {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: LearningResourceType;
  category: LearningCategory;
  status: LearningResourceStatus;
  sortOrder: number;
  durationMinutes?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoPlatform?: SourcePlatform;
  contentBlocks?: ContentBlock[];
  fileName?: string;
  fileContentType?: string;
  externalDownloadUrl?: string;
  publishedAt?: string;
  updatedAt: string;
  downloadUrl?: string;
}
