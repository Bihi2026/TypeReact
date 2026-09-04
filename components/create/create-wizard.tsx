"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Camera,
  Check,
  Clock,
  FileText,
  Film,
  FlaskConical,
  Globe,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  Link as LinkIcon,
  List,
  Loader2,
  ExternalLink,
  Paperclip,
  Quote,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useMutation as useConvexMutation,
  useQuery as useConvexQuery,
} from "convex/react";
import { toast } from "sonner";
import { BarkContent } from "@/components/bark/bark-content";
import { TopicPicker } from "@/components/bark/bark-topics";
import { QuotedBarkCard } from "@/components/bark/quoted-bark-card";
import {
  MentionField,
  type MentionFieldHandle,
} from "@/components/comments/mention-field";
import { publishBark, updateBarkDraft } from "@/app/actions/barks";
import { getCreatorByExternalIdentityAction } from "@/app/actions/creators";
import { analyzeSourceUrl } from "@/app/actions/sources";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  parseBodyToBlocks,
  resolveBlockEvidenceIds,
} from "@/lib/barks/content-blocks";
import { barkKeys, toUiBark } from "@/lib/barks/query";
import { BarkCode } from "@/components/bark-code";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { SourceThumb } from "@/components/source-thumb";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { detectSource } from "@/lib/detect-source";
import { getCreator, sources } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";
import { barkTypeMeta, platformMeta } from "@/lib/meta";
import {
  readUserJson,
  removeUserKey,
  STORAGE_KEYS,
  writeUserJson,
} from "@/lib/storage";
import type { BarkType, CaseCategory, Creator, EvidenceType, Source, SourcePlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  "Source",
  "Detection",
  "Reaction Type",
  "Editor",
  "Publish",
] as const;

interface DraftEvidence {
  id: string;
  type: EvidenceType;
  title: string;
  url: string;
  storageId?: string;
  fileName?: string;
  contentType?: string;
  previewUrl?: string;
}

const FILE_EVIDENCE = new Set<EvidenceType>([
  "screenshot",
  "document",
  "video",
]);

const evidenceIcons: Record<EvidenceType, typeof FileText> = {
  screenshot: Camera,
  document: FileText,
  video: Film,
  link: Link2,
  timestamp: Clock,
  research: FlaskConical,
};

function acceptFor(type: EvidenceType): string | undefined {
  if (type === "screenshot") return "image/*";
  if (type === "document") return ".pdf,.doc,.docx,application/pdf";
  if (type === "video") return "video/mp4,video/webm,video/quicktime";
  return undefined;
}

function maxBytesFor(type: EvidenceType): number {
  return type === "video" ? 32 * 1024 * 1024 : 10 * 1024 * 1024;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                i < step
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === step
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-[11px] font-medium sm:block",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      <Progress
        value={((step + 1) / STEPS.length) * 100}
        aria-label={`Step ${step + 1} of ${STEPS.length}`}
      />
    </div>
  );
}

type PersistedDraft = {
  step: number;
  url: string;
  sourceId: string | null;
  source?: Source | null;
  detectedCreator?: Creator | null;
  barkType: BarkType | null;
  title: string;
  body: string;
  topics?: CaseCategory[];
  visibility: string;
  evidence: DraftEvidence[];
};

function restoreSource(draft: PersistedDraft): Source | null {
  if (draft.source) return draft.source;
  if (draft.sourceId) {
    const catalog = sources.find((s) => s.id === draft.sourceId);
    if (catalog) return catalog;
  }
  if (draft.url.trim()) {
    return detectSource(draft.url, sources)?.source ?? null;
  }
  return null;
}

function resumeStep(
  requested: number,
  source: Source | null,
  barkType: BarkType | null
): number {
  const step = Number.isInteger(requested)
    ? Math.min(4, Math.max(0, requested))
    : 0;
  if (step >= 1 && !source) return 0;
  if (step === 4 && !barkType) return source ? 2 : 0;
  return step;
}

function applyPersistedDraft(
  draft: PersistedDraft,
  set: {
    setStep: (v: number) => void;
    setUrl: (v: string) => void;
    setBarkType: (v: BarkType | null) => void;
    setTitle: (v: string) => void;
    setBody: (v: string) => void;
    setTopics: (v: CaseCategory[]) => void;
    setVisibility: (v: string) => void;
    setEvidence: (v: DraftEvidence[]) => void;
    setSource: (v: Source | null) => void;
    setDetectedCreator: (v: Creator | null) => void;
  }
) {
  const source = restoreSource(draft);
  const creator =
    draft.detectedCreator ??
    (source?.creatorId ? (getCreator(source.creatorId) ?? null) : null);
  set.setUrl(draft.url);
  set.setBarkType(draft.barkType);
  set.setTitle(draft.title);
  set.setBody(draft.body);
  set.setTopics(Array.isArray(draft.topics) ? draft.topics : []);
  set.setVisibility(draft.visibility);
  set.setEvidence(Array.isArray(draft.evidence) ? draft.evidence : []);
  set.setSource(source);
  set.setDetectedCreator(creator);
  set.setStep(resumeStep(draft.step, source, draft.barkType));
}

export function CreateWizard({ onBack }: { onBack?: () => void } = {}) {
  const { user } = useUser();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const barkTypes = React.useMemo(() => Object.keys(barkTypeMeta) as BarkType[], []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editCode = searchParams.get("code")?.trim().toUpperCase() ?? "";
  const quoteParam = searchParams.get("quote")?.trim().toUpperCase() ?? "";
  const existingDraftDoc = useConvexQuery(
    api.barks.getByCode,
    editCode ? { code: editCode } : "skip"
  );
  const [editingCode, setEditingCode] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const [url, setUrl] = React.useState("");
  const [source, setSource] = React.useState<Source | null>(null);
  const [detectedCreator, setDetectedCreator] = React.useState<Creator | null>(
    null
  );
  const [creatorConfirmed, setCreatorConfirmed] = React.useState<boolean | null>(
    null
  );
  const [showManualCreator, setShowManualCreator] = React.useState(false);
  const [manualHandle, setManualHandle] = React.useState("");
  const [manualPlatform, setManualPlatform] =
    React.useState<SourcePlatform>("youtube");
  const [manualLookupLoading, setManualLookupLoading] = React.useState(false);
  const [barkType, setBarkType] = React.useState<BarkType | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [quotedBarkCode, setQuotedBarkCode] = React.useState(quoteParam);
  const [topics, setTopics] = React.useState<CaseCategory[]>([]);
  const [visibility, setVisibility] = React.useState("public");
  const [evidence, setEvidence] = React.useState<DraftEvidence[]>([]);
  const [evTitle, setEvTitle] = React.useState("");
  const [evUrl, setEvUrl] = React.useState("");
  const [evType, setEvType] = React.useState<EvidenceType>("link");
  const [evFile, setEvFile] = React.useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [attaching, setAttaching] = React.useState(false);
  const generateUploadUrl = useConvexMutation(api.evidenceFiles.generateUploadUrl);
  const registerUpload = useConvexMutation(api.evidenceFiles.registerUpload);
  const deleteUpload = useConvexMutation(api.evidenceFiles.deleteUpload);
  const publishMutation = useMutation({
    mutationFn: async (variables: Parameters<typeof publishBark>[0] & { code?: string }) => {
      if (variables.code) {
        return updateBarkDraft(variables.code, variables);
      }
      return publishBark(variables);
    },
    onSuccess: async (result, variables) => {
      removeUserKey(userId, STORAGE_KEYS.barkDraft);
      await queryClient.invalidateQueries({ queryKey: barkKeys.public });
      toast.success(
        variables.status === "draft"
          ? `Draft ${result.code} saved`
          : `Reaction ${result.code} published`,
        {
          description:
            variables.status === "draft"
              ? "You can resume this reaction anytime from your profile."
              : "Your evidence-based response is now live.",
        }
      );
      if (variables.status === "draft") {
        router.replace(`/create?code=${result.code}`);
        setEditingCode(result.code);
        return;
      }
      router.replace(`/barks/${result.code}`);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    },
  });
  const publishing = publishMutation.isPending;
  const [draftBanner, setDraftBanner] = React.useState(false);
  const [pendingDraft, setPendingDraft] = React.useState<PersistedDraft | null>(
    null
  );
  const [draftReady, setDraftReady] = React.useState(false);
  const bodyRef = React.useRef<MentionFieldHandle>(null);
  const hydratedEditRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!existingDraftDoc || existingDraftDoc.status !== "draft") return;
    if (existingDraftDoc.authorClerkId !== userId) return;
    if (hydratedEditRef.current === existingDraftDoc.code) return;
    hydratedEditRef.current = existingDraftDoc.code;
    const ui = toUiBark(existingDraftDoc);
    setEditingCode(ui.code);
    setStep(4);
    setUrl(ui.sourceUrl ?? "");
    setSource(
      ui.sourceTitle && ui.sourcePlatform
        ? {
            id: ui.sourceId,
            platform: ui.sourcePlatform,
            url: ui.sourceUrl ?? "",
            title: ui.sourceTitle,
            thumbnailUrl: ui.sourceThumbnailUrl ?? "",
            creatorId: ui.sourceCreatorId ?? "",
            publishedAt: ui.publishedAt,
            category: "",
            language: "en",
            barkCount: 1,
            replyChainCount: 0,
            caseCount: 0,
            engagement: 0,
            evidenceRating: ui.evidenceRating,
          }
        : null
    );
    if (ui.sourceCreatorName) {
      setDetectedCreator({
        id: ui.sourceCreatorId ?? `draft-creator:${ui.code}`,
        handle: "source",
        name: ui.sourceCreatorName,
        bio: "",
        verified: false,
        hasTeaBarksProfile: Boolean(ui.sourceCreatorId),
        platforms: ui.sourcePlatform ? [ui.sourcePlatform] : [],
        officialLinks: [],
        followers: 0,
        country: "",
        topics: [],
        totalSources: 1,
        totalBarksReceived: 0,
        responseRate: 0,
        joinedAt: ui.publishedAt,
      });
      setCreatorConfirmed(true);
    }
    setBarkType(ui.type);
    setTitle(ui.title);
    setBody(existingDraftDoc.body);
    setQuotedBarkCode(ui.quotedBarkCode ?? "");
    setTopics((ui.topics ?? []) as CaseCategory[]);
    setVisibility("draft");
    setEvidence(
      ui.evidence.map((item, i) => ({
        id: item.id || `ev-${i}`,
        type: item.type,
        title: item.title,
        url: item.url ?? item.timestamp ?? "",
        storageId: existingDraftDoc.evidence[i]?.storageId,
        fileName: item.fileName,
        contentType: item.contentType,
      }))
    );
    setPendingDraft(null);
    setDraftBanner(false);
    setDraftReady(true);
    toast.message(`Editing draft ${ui.code}`);
  }, [existingDraftDoc, userId]);

  React.useEffect(() => {
    if (!userId) {
      setDraftReady(true);
      return;
    }
    if (editCode) {
      // Server draft hydration owns readiness when editing by code.
      return;
    }
    const draft = readUserJson<PersistedDraft | null>(
      userId,
      STORAGE_KEYS.barkDraft,
      null
    );
    if (draft) {
      setPendingDraft(draft);
    }
    setDraftReady(true);
  }, [userId, editCode]);

  React.useEffect(() => {
    if (!draftReady || !userId || pendingDraft) return;
    const payload: PersistedDraft = {
      step,
      url,
      sourceId: source?.id ?? null,
      source,
      detectedCreator,
      barkType,
      title,
      body,
      topics,
      visibility,
      evidence: evidence.map(({ previewUrl: _preview, ...item }) => item),
    };
    const hasContent =
      url.trim() || title.trim() || body.trim() || evidence.length > 0 || step > 0 || topics.length > 0;
    if (hasContent) writeUserJson(userId, STORAGE_KEYS.barkDraft, payload);
  }, [draftReady, userId, pendingDraft, step, url, source, detectedCreator, barkType, title, body, topics, visibility, evidence]);

  const draftSetters = {
    setStep,
    setUrl,
    setBarkType,
    setTitle,
    setBody,
    setTopics,
    setVisibility,
    setEvidence,
    setSource,
    setDetectedCreator,
  };

  const resumeDraft = () => {
    if (!pendingDraft) return;
    applyPersistedDraft(pendingDraft, draftSetters);
    setPendingDraft(null);
    setDraftBanner(false);
    toast.success("Picked up where you left off");
  };

  const clearDraft = async () => {
    const items = pendingDraft?.evidence ?? evidence;
    const ids = items
      .map((item) => item.storageId)
      .filter((id): id is string => Boolean(id));
    await Promise.all(
      ids.map((storageId) =>
        deleteUpload({ storageId: storageId as Id<"_storage"> }).catch(() => null)
      )
    );
    for (const item of items) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    removeUserKey(userId, STORAGE_KEYS.barkDraft);
    setPendingDraft(null);
    setStep(0);
    setUrl("");
    setSource(null);
    setDetectedCreator(null);
    setBarkType(null);
    setTitle("");
    setBody("");
    setTopics([]);
    setVisibility("public");
    setEvidence([]);
    setEvFile(null);
    setDraftBanner(false);
    toast.success("Draft discarded");
  };

  const insertMarkdown = (prefix: string, suffix = prefix, placeholder = "text") => {
    if (!bodyRef.current) {
      setBody((prev) => `${prev}${prefix}${placeholder}${suffix}`);
      return;
    }
    bodyRef.current.wrapSelection(prefix, suffix, placeholder);
  };

  const barkCode = React.useMemo(
    () =>
      `TR-2026-${String(400 + Math.abs(url.length * 37 + title.length * 13) % 500).padStart(4, "0")}`,
    [url, title]
  );

  const analyzeMutation = useMutation({
    mutationFn: analyzeSourceUrl,
    onSuccess: (detected) => {
      if (!detected) {
        toast.error("Enter a valid public URL");
        return;
      }
      setSource(detected.source);
      setDetectedCreator(detected.creator);
      setCreatorConfirmed(null);
      setShowManualCreator(false);
      setStep(1);
      if (detected.detailsLimited) {
        toast.message(
          "Source identified, but the platform hid the title or image."
        );
      }
    },
    onError: () => {
      toast.error("Could not fetch source details. Try again.");
    },
  });
  const analyzing = analyzeMutation.isPending;

  const analyze = () => {
    if (!url.trim()) {
      toast.error("Paste a public URL to analyze.");
      return;
    }
    analyzeMutation.mutate(url);
  };

  const addEvidence = async () => {
    if (!evTitle.trim()) {
      toast.error("Give the evidence item a title.");
      return;
    }
    const needsFile = FILE_EVIDENCE.has(evType);
    if (needsFile && !evFile) {
      toast.error("Choose a file to attach.");
      return;
    }
    if (evFile && evFile.size > maxBytesFor(evType)) {
      toast.error(
        evType === "video"
          ? "Video must be 32 MB or smaller."
          : "File must be 10 MB or smaller."
      );
      return;
    }

    setAttaching(true);
    try {
      let storageId: string | undefined;
      let fileName: string | undefined;
      let contentType: string | undefined;
      let previewUrl: string | undefined;
      if (needsFile && evFile) {
        const postUrl = await generateUploadUrl();
        const uploaded = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": evFile.type || "application/octet-stream" },
          body: evFile,
        });
        if (!uploaded.ok) {
          throw new Error("Upload failed");
        }
        const body = (await uploaded.json()) as { storageId?: string };
        if (!body.storageId) throw new Error("Upload failed");
        storageId = body.storageId;
        await registerUpload({ storageId: storageId as Id<"_storage"> });
        fileName = evFile.name;
        contentType = evFile.type || undefined;
        if (evType === "screenshot" || evType === "video") {
          previewUrl = URL.createObjectURL(evFile);
        }
      }
      setEvidence((prev) => [
        ...prev,
        {
          id: `ev-${Date.now()}`,
          type: evType,
          title: evTitle,
          url: evUrl,
          storageId,
          fileName,
          contentType,
          previewUrl,
        },
      ]);
      setEvTitle("");
      setEvUrl("");
      setEvFile(null);
      setFileInputKey((n) => n + 1);
      toast.success("Evidence attached to your draft.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not attach evidence"
      );
    } finally {
      setAttaching(false);
    }
  };

  const removeEvidence = async (id: string) => {
    const item = evidence.find((ev) => ev.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item?.storageId) {
      try {
        await deleteUpload({ storageId: item.storageId as Id<"_storage"> });
      } catch {
        toast.error("Could not delete the attached file.");
        return;
      }
    }
    setEvidence((prev) => prev.filter((ev) => ev.id !== id));
  };

  const creator =
    detectedCreator ?? (source ? getCreator(source.creatorId) ?? null : null);
  const isPersistedCreator = Boolean(
    creator && !creator.id.startsWith("remote:")
  );
  const isUnclaimedProfile =
    isPersistedCreator && !creator?.hasTeaBarksProfile;

  const creatorProfileUrl = creator?.officialLinks[0]?.url;

  const lookupManualCreator = async () => {
    const handle = manualHandle.trim().toLowerCase();
    if (!handle) {
      toast.error("Enter a handle to search.");
      return;
    }
    setManualLookupLoading(true);
    try {
      const found = await getCreatorByExternalIdentityAction({
        platform: manualPlatform,
        externalHandle: handle,
      });
      if (found) {
        setDetectedCreator(found);
        setCreatorConfirmed(true);
        setShowManualCreator(false);
        toast.success(`Matched ${found.name}`);
      } else {
        setDetectedCreator({
          id: `remote:${manualPlatform}:${handle}`,
          handle,
          name: handle,
          bio: "",
          verified: false,
          hasTeaBarksProfile: false,
          status: "unclaimed",
          externalHandle: handle,
          externalPlatform: manualPlatform,
          platforms: [manualPlatform],
          officialLinks: [],
          followers: 0,
          country: "",
          topics: [],
          totalSources: 0,
          totalBarksReceived: 0,
          responseRate: 0,
          joinedAt: new Date().toISOString(),
        });
        toast.message("No existing profile — one will be created when you publish.");
      }
    } catch {
      toast.error("Could not look up that creator.");
    } finally {
      setManualLookupLoading(false);
    }
  };

  const publish = () => {
    if (!barkType) {
      toast.error("Choose a reaction type first.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and analysis before publishing.");
      return;
    }
    publishMutation.mutate({
      ...(editingCode ? { code: editingCode } : {}),
      type: barkType,
      title,
      body,
      status: visibility === "draft" ? "draft" : "public",
      sourceUrl: source?.url ?? url,
      sourceTitle: source?.title ?? title,
      sourcePlatform: source?.platform ?? "article",
      sourceCreatorName: creator?.name ?? "Unknown creator",
      ...(isPersistedCreator && creator
        ? { sourceCreatorId: creator.id }
        : {}),
      sourceThumbnailUrl: source?.thumbnailUrl,
      topics,
      ...(quotedBarkCode ? { quotedBarkCode } : {}),
      evidence: evidence.map((item) => ({
        type: item.type,
        title: item.title,
        url: item.url,
        storageId: item.storageId,
        fileName: item.fileName,
        contentType: item.contentType,
      })),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {editingCode ? "Edit draft reaction" : "Create a Reaction"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {editingCode
            ? `Updating ${editingCode}. Publish when ready, or save as draft again.`
            : "Every reaction begins with a public source and is built on evidence."}
        </p>
      </div>

      <Stepper step={step} />

      {(pendingDraft || draftBanner) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p>
            {pendingDraft
              ? "You have a saved draft"
              : "Resumed your previous draft"}
            {(pendingDraft?.title || title) ? (
              <>
                :{" "}
                <span className="font-medium">
                  {pendingDraft?.title || title}
                </span>
              </>
            ) : null}
            .
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingDraft && (
              <Button size="sm" onClick={resumeDraft}>
                Resume
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void clearDraft()}>
              Discard draft
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Source input */}
      {step === 0 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Start With A Source</CardTitle>
            <CardDescription>
              Paste a YouTube, TikTok, Podcast, Article, Book or Public URL
            </CardDescription>
          </CardHeader>
          <CardContent className="mx-auto w-full max-w-xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-url">Source URL</Label>
              <div className="relative">
                <Globe
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="source-url"
                  placeholder="https://youtube.com/watch?v=…"
                  className="pl-9"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyze()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supported: YouTube, TikTok, Instagram, Facebook, X, podcasts,
                articles, books, interviews, speeches, livestreams, and public
                statements.
              </p>
            </div>
            <Button onClick={analyze} disabled={analyzing} className="w-full">
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing source…
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Analyze Source
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Source detection */}
      {step === 1 && source && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Source Detected
              </CardTitle>
              <CardDescription>
                We identified this source from your URL. Confirm it before
                continuing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <SourceThumb
                  source={source}
                  className="aspect-video w-full shrink-0 sm:w-56"
                />
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      <PlatformIcon
                        platform={source.platform}
                        className="size-3"
                      />
                      {platformMeta[source.platform].label}
                    </Badge>
                    <Badge variant="outline">{source.category}</Badge>
                    <Badge variant="outline">{source.language}</Badge>
                  </div>
                  <h3 className="font-semibold leading-snug">{source.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Published {formatDate(source.publishedAt)}
                    {source.length ? ` · ${source.length}` : ""}
                  </p>
                  {creator && (
                    <div className="flex items-center gap-2 text-sm">
                      <PersonAvatar
                        id={creator.id}
                        name={creator.name}
                        className="size-6"
                      />
                      <div className="min-w-0">
                        <span className="font-medium">{creator.name}</span>
                        {(creator.externalHandle || creator.handle) && (
                          <p className="text-xs text-muted-foreground">
                            @
                            {creator.externalHandle ?? creator.handle}
                            {creator.externalPlatform
                              ? ` · ${platformMeta[creator.externalPlatform].label}`
                              : source.platform
                                ? ` · ${platformMeta[source.platform].label}`
                                : ""}
                          </p>
                        )}
                        {creatorProfileUrl && (
                          <a
                            href={creatorProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View profile <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      {creator.verified && <VerifiedBadge />}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  Is this the correct creator?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={creatorConfirmed === true ? "default" : "outline"}
                    onClick={() => {
                      setCreatorConfirmed(true);
                      setShowManualCreator(false);
                    }}
                  >
                    <UserCheck className="size-4" />
                    Yes, this is correct
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={creatorConfirmed === false ? "default" : "outline"}
                    onClick={() => {
                      setCreatorConfirmed(false);
                      setShowManualCreator(true);
                      setDetectedCreator(null);
                    }}
                  >
                    No, search again
                  </Button>
                </div>
                {showManualCreator && (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Paste another source URL above, or enter a handle manually.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        placeholder="creator_handle"
                        value={manualHandle}
                        onChange={(e) => setManualHandle(e.target.value)}
                      />
                      <Select
                        value={manualPlatform}
                        onValueChange={(value) =>
                          setManualPlatform(value as SourcePlatform)
                        }
                      >
                        <SelectTrigger aria-label="Platform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              "youtube",
                              "tiktok",
                              "instagram",
                              "facebook",
                              "x",
                              "podcast",
                            ] as SourcePlatform[]
                          ).map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {platformMeta[platform].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={manualLookupLoading}
                        onClick={lookupManualCreator}
                      >
                        {manualLookupLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Look up"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    creator?.hasTeaBarksProfile
                      ? "border-agree/40 bg-agree/5"
                      : isUnclaimedProfile
                        ? "border-primary/40 bg-primary/5"
                        : "border-mixed/40 bg-mixed/5"
                  )}
                >
                  {creator?.hasTeaBarksProfile ? (
                    <UserCheck className="mt-0.5 size-4 text-agree" aria-hidden />
                  ) : (
                    <UserPlus
                      className="mt-0.5 size-4 text-mixed-foreground dark:text-mixed"
                      aria-hidden
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {creator?.hasTeaBarksProfile
                        ? "Existing TypeReact profile"
                        : isUnclaimedProfile
                          ? "Unclaimed profile"
                          : "New creator detected"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {creator?.hasTeaBarksProfile
                        ? `${creator.name} is on TypeReact and responds to ${creator.responseRate}% of discussions.`
                        : isUnclaimedProfile
                          ? `${creator?.name} has ${formatNumber(creator?.totalBarksReceived ?? 0)} reactions on TypeReact. They can claim this profile to respond.`
                          : "An unclaimed profile will be created when you publish."}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Existing discussion</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatNumber(source.barkCount)} Reactions</span>
                    <span>{formatNumber(source.replyChainCount)} Reply Chains</span>
                    <span>
                      {source.caseCount} Accountability{" "}
                      {source.caseCount === 1 ? "Case" : "Cases"}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="size-4" /> Different source
            </Button>
            <Button onClick={() => setStep(2)}>
              Confirm source <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Reaction type */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold">
              How are you responding to this source?
            </h2>
            <p className="text-sm text-muted-foreground">
              Your reaction type frames the discussion and sets reader expectations.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Reaction type"
            className="grid gap-3 sm:grid-cols-2"
          >
            {barkTypes.map((t) => {
              const meta = barkTypeMeta[t];
              const selected = barkType === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setBarkType(t)}
                  className={cn(
                    "rounded-lg border-2 p-5 text-left transition-all focus-visible:outline-2 focus-visible:outline-ring",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={meta.badgeClass}>
                      {meta.label}
                    </Badge>
                    {selected && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button disabled={!barkType} onClick={() => setStep(3)}>
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Editor */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="gap-0 p-0">
              <div className="space-y-3 p-4">
                <div className="space-y-2">
                  <Label htmlFor="bark-title">Reaction title</Label>
                  <Input
                    id="bark-title"
                    placeholder="A precise, checkable headline for your analysis…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Topics</Label>
                  <TopicPicker value={topics} onChange={setTopics} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quoted-bark">Quote another Reaction (optional)</Label>
                  <Input
                    id="quoted-bark"
                    placeholder="TR-2026-0341"
                    value={quotedBarkCode}
                    onChange={(e) =>
                      setQuotedBarkCode(e.target.value.trim().toUpperCase())
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Chains research like a quote-post — readers see the linked Reaction card.
                  </p>
                  {quotedBarkCode ? (
                    <QuotedBarkCard code={quotedBarkCode} />
                  ) : null}
                </div>
                <div
                  className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1"
                  role="toolbar"
                  aria-label="Formatting"
                >
                  {(
                    [
                      {
                        icon: Bold,
                        label: "Bold",
                        run: () => insertMarkdown("**", "**"),
                      },
                      {
                        icon: Italic,
                        label: "Italic",
                        run: () => insertMarkdown("*", "*"),
                      },
                      {
                        icon: Heading2,
                        label: "Heading",
                        run: () => insertMarkdown("\n## ", "", "Heading"),
                      },
                      {
                        icon: Quote,
                        label: "Quote",
                        run: () => insertMarkdown("\n> ", "", "Quoted claim"),
                      },
                      {
                        icon: List,
                        label: "List",
                        run: () => insertMarkdown("\n- ", "", "Evidence point"),
                      },
                      {
                        icon: LinkIcon,
                        label: "Link",
                        run: () => insertMarkdown("[", "](https://)", "link text"),
                      },
                      {
                        icon: Paperclip,
                        label: "Embed evidence",
                        run: () => {
                          if (evidence.length === 0) {
                            toast.message("Attach evidence first, then embed it");
                            return;
                          }
                          const index = evidence.length - 1;
                          insertMarkdown(`\n[[ev:${index}]]\n`, "", "");
                        },
                      },
                    ] as const
                  ).map(({ icon: Icon, label, run }) => (
                    <Button
                      key={label}
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={label}
                      onClick={run}
                    >
                      <Icon className="size-4" />
                    </Button>
                  ))}
                  <span className="ml-auto pr-2 text-[11px] text-muted-foreground">
                    {body.trim()
                      ? `${body.trim().split(/\s+/).length} words · ## > - [[ev:N]]`
                      : "## headings · > quotes · - lists · [[ev:N]] embeds"}
                  </span>
                </div>
                <Tabs defaultValue="write">
                  <TabsList>
                    <TabsTrigger value="write">Write</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="write">
                    <MentionField
                      ref={bodyRef}
                      id="bark-body"
                      value={body}
                      onChange={setBody}
                      placeholder={
                        "Build your argument… type @ to mention someone\n\n## What the source claims\n\n> Quote the exact claim with a timestamp\n\nPresent your evidence, one claim at a time."
                      }
                      className="min-h-80 resize-y font-serif text-[15px] leading-relaxed"
                    />
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="min-h-80 rounded-md border p-4">
                      {body.trim() ? (
                        <BarkContent
                          content={resolveBlockEvidenceIds(
                            parseBodyToBlocks(body, evidence.length),
                            "DRAFT"
                          )}
                          evidence={evidence.map((ev, i) => ({
                            id: `DRAFT-ev-${i}`,
                            type: ev.type,
                            title: ev.title,
                            description: ev.title,
                            url: ev.previewUrl || ev.url || undefined,
                            fileName: ev.fileName,
                            contentType: ev.contentType,
                            addedById: userId ?? "draft",
                            addedByName: "You",
                            addedAt: new Date().toISOString(),
                            verified: false,
                          }))}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nothing to preview yet.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>

            {/* Evidence panel */}
            <Card className="h-fit gap-0 p-0">
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Paperclip className="size-4" aria-hidden />
                    Evidence Panel
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Attach screenshots, documents, videos, links, timestamps,
                    and research references.
                  </p>
                </div>
                <div className="space-y-2">
                  <Select
                    value={evType}
                    onValueChange={(v) => {
                      setEvType(v as EvidenceType);
                      setEvFile(null);
                      setFileInputKey((n) => n + 1);
                    }}
                  >
                    <SelectTrigger aria-label="Evidence type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="screenshot">Screenshot</SelectItem>
                      <SelectItem value="document">Document / PDF</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                      <SelectItem value="research">Research reference</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Evidence title"
                    placeholder="Evidence title"
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                  />
                  {FILE_EVIDENCE.has(evType) ? (
                    <Input
                      key={`evidence-file-${evType}-${fileInputKey}`}
                      type="file"
                      aria-label="Evidence file"
                      accept={acceptFor(evType)}
                      onChange={(e) => setEvFile(e.target.files?.[0] ?? null)}
                    />
                  ) : (
                    <Input
                      key="evidence-url"
                      aria-label="Evidence URL"
                      placeholder={
                        evType === "timestamp"
                          ? "Timestamp (e.g. 14:32)"
                          : "URL (optional)"
                      }
                      value={evUrl}
                      onChange={(e) => setEvUrl(e.target.value)}
                    />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={addEvidence}
                    disabled={attaching}
                  >
                    {attaching ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      "Attach evidence"
                    )}
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Attached ({evidence.length})
                  </p>
                  {evidence.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      No evidence attached yet. Reactions with strong evidence rank
                      higher.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {evidence.map((ev) => {
                        const Icon = evidenceIcons[ev.type];
                        return (
                          <li
                            key={ev.id}
                            className="flex items-center gap-2 rounded-md border p-2 text-xs"
                          >
                            <Icon
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {ev.title}
                              {ev.fileName ? (
                                <span className="block truncate font-normal text-muted-foreground">
                                  {ev.fileName}
                                </span>
                              ) : null}
                            </span>
                            {ev.previewUrl && ev.type === "screenshot" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ev.previewUrl}
                                alt=""
                                className="size-8 rounded object-cover"
                              />
                            ) : null}
                            <button
                              type="button"
                              aria-label={`Remove ${ev.title}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => void removeEvidence(ev.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button
              disabled={!title.trim() || !body.trim()}
              onClick={() => setStep(4)}
            >
              Review & publish <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Publish preview */}
      {step === 4 && source && barkType && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish Preview</CardTitle>
              <CardDescription>
                Review everything before your reaction goes live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Source
                  </p>
                  <p className="mt-1 line-clamp-2 font-medium">{source.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {creator?.name} · {platformMeta[source.platform].label}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reaction
                  </p>
                  <p className="mt-1 line-clamp-2 font-medium">{title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={barkTypeMeta[barkType].badgeClass}
                    >
                      {barkTypeMeta[barkType].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {body.trim().split(/\s+/).length} words
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Evidence
                  </p>
                  <p className="mt-1 font-medium">
                    {evidence.length} item{evidence.length === 1 ? "" : "s"}{" "}
                    attached
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {evidence.length === 0
                      ? "Consider attaching evidence before publishing."
                      : evidence.map((e) => e.title).join(", ")}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visibility & Reaction ID
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Select value={visibility} onValueChange={setVisibility}>
                      <SelectTrigger
                        aria-label="Visibility"
                        className="h-8 w-32"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="followers">Followers</SelectItem>
                        <SelectItem value="draft">Save as draft</SelectItem>
                      </SelectContent>
                    </Select>
                    <BarkCode code={barkCode} size="md" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your permanent, citable Reaction ID is generated at publish.
                    Copy it so others can search for this reaction by Reaction ID.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="size-4" /> Back to editor
            </Button>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <Check className="size-4" /> Publish Reaction
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
