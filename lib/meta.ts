import type {
  BarkType,
  CaseCategory,
  CaseStatus,
  ClaimStatus,
  EvidenceType,
  NotificationCategory,
  OrgRole,
  ReportCategory,
  ReportSeverity,
  SourcePlatform,
} from "./types";

export const barkTypeMeta: Record<
  BarkType,
  { label: string; description: string; badgeClass: string; borderClass: string }
> = {
  agree: {
    label: "Agree",
    description: "Support the argument with additional evidence.",
    badgeClass:
      "bg-agree/15 text-agree border-agree/30 dark:bg-agree/20",
    borderClass: "border-l-agree",
  },
  disagree: {
    label: "Disagree",
    description: "Challenge the argument with counter-evidence.",
    badgeClass:
      "bg-disagree/15 text-disagree border-disagree/30 dark:bg-disagree/20",
    borderClass: "border-l-disagree",
  },
  mixed: {
    label: "Mixed",
    description: "Analyze both the strengths and the weaknesses.",
    badgeClass:
      "bg-mixed/20 text-mixed-foreground border-mixed/40 dark:text-mixed",
    borderClass: "border-l-mixed",
  },
  unpack: {
    label: "Unpack",
    description: "A deep investigation of claims, context, and sources.",
    badgeClass:
      "bg-unpack/15 text-unpack border-unpack/30 dark:bg-unpack/20",
    borderClass: "border-l-unpack",
  },
};

export const platformMeta: Record<SourcePlatform, { label: string }> = {
  youtube: { label: "YouTube" },
  tiktok: { label: "TikTok" },
  instagram: { label: "Instagram" },
  facebook: { label: "Facebook" },
  x: { label: "X / Twitter" },
  podcast: { label: "Podcast" },
  article: { label: "Article" },
  book: { label: "Book" },
  interview: { label: "Interview" },
  speech: { label: "Speech" },
  livestream: { label: "Livestream" },
  statement: { label: "Public Statement" },
};

export const caseStatusMeta: Record<
  CaseStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: "Open",
    badgeClass: "bg-verified/15 text-verified border-verified/30",
  },
  "under-review": {
    label: "Under Review",
    badgeClass: "bg-mixed/20 text-mixed-foreground border-mixed/40 dark:text-mixed",
  },
  responded: {
    label: "Creator Responded",
    badgeClass: "bg-unpack/15 text-unpack border-unpack/30",
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-agree/15 text-agree border-agree/30",
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export const claimStatusMeta: Record<
  ClaimStatus,
  { label: string; badgeClass: string }
> = {
  supported: {
    label: "Supported",
    badgeClass: "bg-agree/15 text-agree border-agree/30",
  },
  disputed: {
    label: "Disputed",
    badgeClass: "bg-mixed/20 text-mixed-foreground border-mixed/40 dark:text-mixed",
  },
  unverified: {
    label: "Unverified",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  refuted: {
    label: "Refuted",
    badgeClass: "bg-disagree/15 text-disagree border-disagree/30",
  },
};

export const evidenceTypeMeta: Record<EvidenceType, { label: string }> = {
  screenshot: { label: "Screenshot" },
  document: { label: "Document" },
  video: { label: "Video" },
  link: { label: "Link" },
  timestamp: { label: "Timestamp" },
  research: { label: "Research" },
};

export const orgRoleMeta: Record<
  OrgRole,
  { label: string; description: string }
> = {
  owner: { label: "Owner", description: "Full access to everything, including billing and deletion." },
  admin: { label: "Admin", description: "Management access: members, settings, and all content." },
  editor: { label: "Editor", description: "Reviews and approves content before publication." },
  writer: { label: "Writer", description: "Creates drafts of reactions and case analyses." },
  researcher: { label: "Researcher", description: "Manages evidence collections and source verification." },
  viewer: { label: "Viewer", description: "Read-only access to the organization workspace." },
};

export const notificationCategoryMeta: Record<
  NotificationCategory,
  { label: string }
> = {
  reply: { label: "Replies" },
  mention: { label: "Mentions" },
  follower: { label: "Followers" },
  following: { label: "Following" },
  "creator-response": { label: "Creator Responses" },
  evidence: { label: "Evidence Updates" },
  verification: { label: "Verification" },
  message: { label: "Messages" },
  circle: { label: "Research Circles" },
};

export const reportSeverityMeta: Record<
  ReportSeverity,
  { label: string; badgeClass: string }
> = {
  severe: {
    label: "Severe",
    badgeClass: "bg-disagree/15 text-disagree border-disagree/30",
  },
  high: {
    label: "High",
    badgeClass:
      "bg-mixed/20 text-mixed-foreground border-mixed/40 dark:text-mixed",
  },
  moderate: {
    label: "Moderate",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export const reportCategoryMeta: Record<
  ReportCategory,
  { label: string; description: string; severity: ReportSeverity }
> = {
  "hate-speech": {
    label: "Racism or hate speech",
    description:
      "Slurs, racist stereotypes, or content demeaning a race, ethnicity, or national origin.",
    severity: "severe",
  },
  discrimination: {
    label: "Discrimination",
    description:
      "Advocating exclusion or unequal treatment based on religion, gender, orientation, disability, or age.",
    severity: "severe",
  },
  harassment: {
    label: "Harassment or personal attacks",
    description:
      "Insults, threats, pile-ons, or sexual harassment targeting a person instead of their argument.",
    severity: "high",
  },
  doxxing: {
    label: "Doxxing / privacy violation",
    description:
      "Sharing private information: addresses, phone numbers, private accounts or conversations.",
    severity: "severe",
  },
  "fabricated-evidence": {
    label: "Fabricated or manipulated evidence",
    description:
      "Doctored screenshots, deceptively edited clips, or fake documents presented as real.",
    severity: "severe",
  },
  misinformation: {
    label: "Misinformation",
    description:
      "Demonstrably false claims asserted as fact, or debunked claims repeated after correction.",
    severity: "high",
  },
  spam: {
    label: "Spam or manipulation",
    description:
      "Repetitive low-effort content, engagement farming, or coordinated inauthentic behavior.",
    severity: "moderate",
  },
  impersonation: {
    label: "Impersonation",
    description:
      "Pretending to be another person, creator, or organization, including unlabeled parody.",
    severity: "high",
  },
  other: {
    label: "Something else",
    description:
      "A guideline violation not covered by the categories above — describe it below.",
    severity: "moderate",
  },
};

export const caseCategoryMeta: Record<
  CaseCategory,
  { label: string; group: "Conduct" | "Integrity" | "Behavior"; policy: string }
> = {
  racism: {
    label: "Racism / hate speech",
    group: "Conduct",
    policy: "Community Guidelines §1 — Hate speech and racism",
  },
  discrimination: {
    label: "Discrimination",
    group: "Conduct",
    policy: "Community Guidelines §2 — Discrimination",
  },
  harassment: {
    label: "Harassment of others",
    group: "Conduct",
    policy: "Community Guidelines §3 — Harassment and personal attacks",
  },
  misinformation: {
    label: "Misinformation",
    group: "Integrity",
    policy: "Community Guidelines §6 — Misinformation presented as fact",
  },
  "fabricated-content": {
    label: "Fabricated content",
    group: "Integrity",
    policy: "Community Guidelines §5 — Fabricated or manipulated evidence",
  },
  "undisclosed-sponsorship": {
    label: "Undisclosed sponsorship",
    group: "Integrity",
    policy: "Evidence Standards — Disclosure requirements",
  },
  scam: {
    label: "Scam or fraud promotion",
    group: "Behavior",
    policy: "Community Guidelines — Harmful commercial conduct",
  },
  plagiarism: {
    label: "Plagiarism",
    group: "Behavior",
    policy: "Evidence Standards — Attribution requirements",
  },
};

export function evidenceRatingLabel(rating: number): string {
  if (rating >= 85) return "Strong";
  if (rating >= 65) return "Moderate";
  if (rating >= 40) return "Weak";
  return "Poor";
}

export function evidenceRatingClass(rating: number): string {
  if (rating >= 85) return "text-agree";
  if (rating >= 65) return "text-verified";
  if (rating >= 40) return "text-mixed-foreground dark:text-mixed";
  return "text-disagree";
}
