"use client";

import * as React from "react";
import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BadgeCheck,
  ExternalLink,
  FileQuestion,
  FileStack,
  GitBranch,
  History,
  MessageSquareWarning,
  Scale,
  ShieldCheck,
  ShieldX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CaseCode } from "@/components/case-code";
import { CiteEmbed } from "@/components/cite-embed";
import { EvidenceCard } from "@/components/evidence-card";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformIcon } from "@/components/platform-icon";
import { CaseFollowButton } from "@/components/cases/case-follow-button";
import { CaseVisitDigestBanner } from "@/components/cases/case-visit-digest-banner";
import { StartMessageButton } from "@/components/messages/start-message-button";
import { SaveCaseButton } from "@/components/cases/save-case-button";
import { ReportButton } from "@/components/report-dialog";
import { ReadingTextSizeControl } from "@/components/reading-text-size-control";
import { useReadingTextSize } from "@/components/reading-text-size-provider";
import { ShareMenu } from "@/components/share-menu";
import { SourceThumb } from "@/components/source-thumb";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiCase } from "@/lib/cases/query";
import { getCreator, getPerson, getSource } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";
import { caseStatusMeta, claimStatusMeta, platformMeta } from "@/lib/meta";
import { readingTextSizeClass } from "@/lib/reading-text-size";
import type { AccountabilityCase, Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

function AnalysisList({
  items,
  icon: Icon,
  tone,
  emptyText,
}: {
  items: string[];
  icon: typeof ShieldCheck;
  tone: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

function reconstructedCreator(
  c: AccountabilityCase,
  claimed: boolean
): Creator | undefined {
  if (!c.creatorName) return undefined;
  return {
    id: c.creatorId,
    handle: c.creatorHandle ?? "creator",
    name: c.creatorName,
    bio: "",
    verified: Boolean(c.creatorVerified),
    hasTeaBarksProfile: claimed,
    platforms: [],
    officialLinks: [],
    followers: 0,
    country: "",
    topics: [],
    totalSources: 0,
    totalBarksReceived: 0,
    responseRate: 0,
    joinedAt: c.openedAt,
  };
}

export function CaseFile({
  initialCase,
  claimedProfile,
}: {
  initialCase: AccountabilityCase;
  claimedProfile: boolean;
}) {
  const { isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(api.cases.getByCode, { code: initialCase.code });
  const mine = useQuery(api.creators.getMine, isAuthenticated ? {} : "skip");
  const addNote = useMutation(api.cases.addCommunityNote);
  const respond = useMutation(api.cases.respond);
  const [note, setNote] = React.useState("");
  const [response, setResponse] = React.useState("");
  const [postingNote, setPostingNote] = React.useState(false);
  const [postingResponse, setPostingResponse] = React.useState(false);
  const { textSize } = useReadingTextSize();
  const readingClass = readingTextSizeClass[textSize];

  const c = live ? toUiCase(live) : initialCase;
  const source = getSource(c.sourceId);
  const creator =
    getCreator(c.creatorId) ?? reconstructedCreator(c, claimedProfile);
  const openedBy = getPerson(c.openedById);
  const openedByName =
    openedBy.name !== "Unknown" ? openedBy.name : (c.openedByName ?? openedBy.name);
  const status = caseStatusMeta[c.status];
  const canRespond =
    Boolean(mine) &&
    mine?._id === c.creatorId &&
    !c.creatorResponse &&
    (c.status === "open" || c.status === "under-review");

  const submitNote = async () => {
    if (!note.trim()) {
      toast.error("Write a community note first.");
      return;
    }
    setPostingNote(true);
    try {
      await addNote({ caseId: c.id as Id<"cases">, text: note });
      setNote("");
      toast.success("Note added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post note");
    } finally {
      setPostingNote(false);
    }
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      toast.error("Write an official response first.");
      return;
    }
    setPostingResponse(true);
    try {
      await respond({ caseId: c.id as Id<"cases">, content: response });
      setResponse("");
      toast.success("Official response posted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post response"
      );
    } finally {
      setPostingResponse(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/cases">Accountability Cases</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {c.code}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4">
        <CaseVisitDigestBanner code={c.code} />
      </div>

      <header className="rounded-lg border bg-card">
        <div className="border-b bg-muted/40 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Scale className="size-4 text-primary" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Accountability Case File
            </span>
            <CaseCode code={c.code} size="md" />
            <Badge variant="outline" className={`${status.badgeClass} ml-auto`}>
              {status.label}
            </Badge>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <h1 className="text-balance text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {c.title}
          </h1>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Creator</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                {creator && (
                  <>
                    <PersonAvatar
                      id={creator.id}
                      name={creator.name}
                      className="size-5"
                    />
                    {creator.hasTeaBarksProfile ? (
                      <Link
                        href={`/creators/${creator.handle}`}
                        className="hover:underline"
                      >
                        {creator.name}
                      </Link>
                    ) : (
                      <span>{creator.name}</span>
                    )}
                    {creator.verified && <VerifiedBadge className="size-3.5" />}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Opened by</dt>
              <dd className="mt-0.5 font-medium">
                {openedByName}{" "}
                <span className="font-normal text-muted-foreground">
                  on {formatDate(c.openedAt)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last updated</dt>
              <dd className="mt-0.5 font-medium">{formatDate(c.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Followers</dt>
              <dd className="mt-0.5 font-medium">
                {formatNumber(c.followers)}
              </dd>
            </div>
          </dl>
          {source && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
              <SourceThumb
                source={source}
                className="hidden aspect-video w-28 shrink-0 sm:flex"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Source under review
                </p>
                <p className="line-clamp-1 text-sm font-medium">
                  {source.title}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PlatformIcon platform={source.platform} className="size-3" />
                  {platformMeta[source.platform].label} ·{" "}
                  {formatDate(source.publishedAt)}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Original <ExternalLink className="size-3" aria-hidden />
                  </a>
                </p>
              </div>
            </div>
          )}
          <p className={cn(readingClass, "text-foreground/85")}>
            {c.summary}
          </p>
          <div className="flex gap-2">
            <CaseFollowButton
              code={c.code}
              initialFollowers={c.followers}
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/circles?case=${encodeURIComponent(c.code)}`}>
                Start research circle
              </Link>
            </Button>
            {c.live ? (
              <StartMessageButton
                kind="case"
                caseCode={c.code}
                size="sm"
              />
            ) : null}
            <SaveCaseButton code={c.code} />
            <ReadingTextSizeControl />
            <ShareMenu
              kind="case"
              code={c.code}
              title={c.title}
              path={`/cases/${c.code}`}
            />
            <ReportButton
              target={`case ${c.code}`}
              caseCode={c.code}
              iconOnly
            />
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-8">
          {c.creatorResponse && creator && (
            <section
              aria-labelledby="creator-response"
              className="rounded-lg border-2 border-verified/40 bg-verified/[0.04] p-5"
            >
              <h2
                id="creator-response"
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-verified"
              >
                <BadgeCheck className="size-4" aria-hidden />
                Official Creator Response
              </h2>
              <div className="mt-3 flex items-center gap-2">
                <PersonAvatar
                  id={creator.id}
                  name={creator.name}
                  className="size-8"
                />
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {creator.name}
                    {c.creatorResponse.verified && (
                      <VerifiedBadge className="size-3.5" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Responded {formatDate(c.creatorResponse.respondedAt)}
                    {!c.creatorResponse.verified &&
                      " · via unclaimed profile, identity match pending"}
                  </p>
                </div>
              </div>
              <blockquote
                className={cn(
                  readingClass,
                  "mt-3 border-l-2 border-verified/50 pl-4 font-serif text-foreground/90"
                )}
              >
                {c.creatorResponse.content}
              </blockquote>
            </section>
          )}

          {canRespond && (
            <Card className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="size-4 text-verified" aria-hidden />
                Post official response
              </h2>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Respond on the record to the claims in this case."
                className="min-h-28"
              />
              <Button
                size="sm"
                disabled={postingResponse}
                onClick={submitResponse}
              >
                {postingResponse ? "Posting…" : "Publish response"}
              </Button>
            </Card>
          )}

          <section aria-labelledby="analysis">
            <h2 id="analysis" className="sr-only">
              Case analysis
            </h2>
            <Tabs defaultValue="claims">
              <TabsList className="h-auto w-full flex-wrap justify-start">
                <TabsTrigger value="claims">Claims</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="strengths">Strengths</TabsTrigger>
                <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
                <TabsTrigger value="contradictions">Contradictions</TabsTrigger>
                <TabsTrigger value="missing">Missing Evidence</TabsTrigger>
                <TabsTrigger value="community">Community</TabsTrigger>
              </TabsList>

              <TabsContent value="claims" className="mt-4 space-y-3">
                {c.claims.map((claim, i) => (
                  <Card key={claim.id} className="gap-0 p-0">
                    <div className="flex items-start gap-3 p-4">
                      <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                        C{i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className={cn(readingClass, "font-medium")}>
                          {claim.text}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {claim.evidenceIds.length} linked evidence item
                          {claim.evidenceIds.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={claimStatusMeta[claim.status].badgeClass}
                      >
                        {claimStatusMeta[claim.status].label}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="evidence" className="mt-4 space-y-2">
                {c.evidence.map((ev) => (
                  <EvidenceCard key={ev.id} evidence={ev} />
                ))}
              </TabsContent>

              <TabsContent value="strengths" className="mt-4">
                <AnalysisList
                  items={c.strengths}
                  icon={ShieldCheck}
                  tone="text-agree"
                  emptyText="No strengths recorded yet."
                />
              </TabsContent>

              <TabsContent value="weaknesses" className="mt-4">
                <AnalysisList
                  items={c.weaknesses}
                  icon={ShieldX}
                  tone="text-mixed-foreground dark:text-mixed"
                  emptyText="No weaknesses recorded — community review is ongoing."
                />
              </TabsContent>

              <TabsContent value="contradictions" className="mt-4">
                <AnalysisList
                  items={c.contradictions}
                  icon={AlertTriangle}
                  tone="text-disagree"
                  emptyText="No contradictions documented."
                />
              </TabsContent>

              <TabsContent value="missing" className="mt-4">
                <AnalysisList
                  items={c.missingEvidence}
                  icon={FileQuestion}
                  tone="text-muted-foreground"
                  emptyText="Nothing outstanding — the evidence base is considered complete."
                />
              </TabsContent>

              <TabsContent value="community" className="mt-4 space-y-3">
                {!isSignedIn ? (
                  <Card className="gap-0 p-0">
                    <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Sign in to add community analysis.
                      </p>
                      <SignInButton>
                        <Button size="sm">Sign in</Button>
                      </SignInButton>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a community note about the evidence or claims."
                      className="min-h-20"
                    />
                    <Button
                      size="sm"
                      disabled={postingNote}
                      onClick={submitNote}
                    >
                      {postingNote ? "Posting…" : "Post note"}
                    </Button>
                  </div>
                )}
                {c.communityAnalysis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No community analysis yet.
                  </p>
                ) : (
                  c.communityAnalysis.map((communityNote, i) => {
                    const person = getPerson(communityNote.authorId);
                    const name =
                      communityNote.authorName ||
                      (person.name !== "Unknown" ? person.name : "Member");
                    return (
                      <Card key={`${communityNote.authorId}-${i}`} className="gap-0 p-0">
                        <div className="space-y-2 p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <PersonAvatar
                              id={communityNote.authorId}
                              name={name}
                              className="size-6"
                            />
                            <span className="font-medium">{name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(communityNote.postedAt)}
                            </span>
                          </div>
                          <p className={cn(readingClass, "text-foreground/90")}>
                            {communityNote.text}
                          </p>
                        </div>
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          <section aria-labelledby="timeline">
            <h2
              id="timeline"
              className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <History className="size-5" aria-hidden />
              Evidence Timeline
            </h2>
            <ol className="relative space-y-6 border-l-2 border-border pl-6">
              {c.timeline.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={`absolute -left-[31px] top-1 size-2.5 rounded-full ${
                      event.type === "response"
                        ? "bg-verified"
                        : event.type === "evidence"
                          ? "bg-primary"
                          : event.type === "status"
                            ? "bg-mixed"
                            : "bg-muted-foreground"
                    }`}
                    aria-hidden
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.date)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <CiteEmbed
            kind="case"
            code={c.code}
            title={c.title}
            path={`/cases/${c.code}`}
          />
          <Card className="gap-0 p-0">
            <div className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">Case File</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Evidence items</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <FileStack className="size-3.5" aria-hidden />
                    {c.evidence.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Claims tracked</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <MessageSquareWarning className="size-3.5" aria-hidden />
                    {c.claims.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Followers</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <Users className="size-3.5" aria-hidden />
                    {formatNumber(c.followers)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Versions</dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <GitBranch className="size-3.5" aria-hidden />
                    {c.versions.length}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
