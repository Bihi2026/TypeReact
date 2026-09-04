import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { BarkContent } from "@/components/bark/bark-content";
import { BarkTopics } from "@/components/bark/bark-topics";
import { BarkCreatorPanel } from "@/components/bark/bark-creator-panel";
import { BarkLiveViewCount } from "@/components/bark/bark-live-view-count";
import { BarkViewRecorder } from "@/components/bark/bark-view-recorder";
import {
  AmendReactionForm,
  BarkVersionHistory,
  PromoteToCaseButton,
  SourceDebateGraph,
} from "@/components/bark/advanced-reaction-tools";
import { OfficialCreatorResponse } from "@/components/bark/official-creator-response";
import { QuotedBarkCard } from "@/components/bark/quoted-bark-card";
import {
  EvidenceRequestsPanel,
} from "@/components/bark/evidence-requests";
import { CommunityNotesSection } from "@/components/bark/community-notes";
import { ClaimMapSection } from "@/components/bark/claim-map";
import { VisitDigestBanner } from "@/components/bark/visit-digest-banner";
import { BarkReadingToolbar } from "@/components/bark/bark-reading-toolbar";
import { LikeButton } from "@/components/bark/like-button";
import { LiveReplyThread } from "@/components/bark/live-reply-thread";
import { FollowBarkAuthorButton } from "@/components/barks/follow-author-button";
import { MuteAuthorButton } from "@/components/barks/mute-author-button";
import { StartMessageButton } from "@/components/messages/start-message-button";
import { BarkCode } from "@/components/bark-code";
import { ReportButton } from "@/components/report-dialog";
import { BarkTypeBadge } from "@/components/bark-type-badge";
import { CiteEmbed } from "@/components/cite-embed";
import { SaveBarkButton } from "@/components/save-bark-button";
import { ShareMenu } from "@/components/share-menu";
import { EvidenceCard } from "@/components/evidence-card";
import { EvidenceRating } from "@/components/evidence-rating";
import { PersonAvatar } from "@/components/person-avatar";
import { SourceWatchPanel } from "@/components/sources/source-watch-panel";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getBarkByCodeAction } from "@/app/actions/barks";
import { getCreatorByIdAction } from "@/app/actions/creators";
import { youtubeThumbnailUrl } from "@/lib/detect-source";
import { formatDate, formatNumber } from "@/lib/format";
import { platformMeta } from "@/lib/meta";
import type { Bark, EvidenceType, Source, User } from "@/lib/types";

export const dynamic = "force-dynamic";

function normalizeBarkCode(code: string) {
  return code.trim().toUpperCase();
}

async function resolveBark(code: string): Promise<Bark | undefined> {
  const normalized = normalizeBarkCode(code);
  try {
    const live = await getBarkByCodeAction(normalized);
    if (live) return live;
  } catch (err) {
    console.error("Failed to fetch live bark:", err);
  }
  return undefined;
}

export async function generateMetadata(
  props: PageProps<"/barks/[code]">
): Promise<Metadata> {
  const { code } = await props.params;
  const bark = await resolveBark(code);
  return { title: bark ? bark.title : "Reaction not found" };
}

const evidenceTabs: { value: EvidenceType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "document", label: "Documents" },
  { value: "screenshot", label: "Screenshots" },
  { value: "video", label: "Videos" },
  { value: "link", label: "Links" },
  { value: "timestamp", label: "Timestamps" },
];

export default async function BarkPage(props: PageProps<"/barks/[code]">) {
  const { code } = await props.params;
  const bark = await resolveBark(code);
  if (!bark) notFound();

  const author: User = {
    id: bark.authorId,
    username: bark.authorId,
    name: bark.authorName || "Member",
    bio: "",
    verified: false,
    country: bark.country || "",
    followers: 0,
    following: 0,
    barkCount: 0,
    evidenceScore: bark.evidenceRating,
    joinedAt: bark.publishedAt,
  };
  const source: Source | undefined =
    bark.sourceTitle && bark.sourcePlatform
      ? {
          id: bark.sourceId,
          platform: bark.sourcePlatform,
          url: bark.sourceUrl ?? "",
          title: bark.sourceTitle,
          thumbnailUrl:
            bark.sourceThumbnailUrl ??
            youtubeThumbnailUrl(bark.sourceUrl ?? ""),
          creatorId: bark.sourceCreatorId ?? "",
          publishedAt: bark.publishedAt,
          category: "",
          language: "en",
          barkCount: 1,
          replyChainCount: 0,
          caseCount: 0,
          engagement: 0,
          evidenceRating: bark.evidenceRating,
        }
      : undefined;
  const creatorFromId = bark.sourceCreatorId
    ? await getCreatorByIdAction(bark.sourceCreatorId)
    : null;
  const creator =
    creatorFromId ??
    (bark.sourceCreatorName
      ? {
          id: bark.sourceCreatorId ?? "source-creator",
          handle: "source",
          name: bark.sourceCreatorName,
          bio: "",
          verified: false,
          hasTeaBarksProfile: false,
          platforms: bark.sourcePlatform ? [bark.sourcePlatform] : [],
          officialLinks: [],
          followers: 0,
          country: "",
          topics: [],
          totalSources: 1,
          totalBarksReceived: 0,
          responseRate: 0,
          joinedAt: bark.publishedAt,
        }
      : undefined);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-8">
      {bark.live ? <BarkViewRecorder code={bark.code} /> : null}
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
              <Link href="/barks">Reactions</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {bark.code}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
        <article className="min-w-0 overflow-x-hidden">
          {/* Header */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <BarkTypeBadge type={bark.type} />
              <BarkCode code={bark.code} size="md" />
              <EvidenceRating rating={bark.evidenceRating} />
            </div>
            <h1 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {bark.title}
            </h1>
            <BarkTopics
              code={bark.code}
              initialTopics={bark.topics}
              authorClerkId={bark.authorId}
              live={bark.live}
            />
            {author && (
              <div className="flex min-w-0 flex-col gap-3">
                <Link
                  href={`/profile/${author.id}`}
                  className="flex min-w-0 items-center gap-2 hover:text-primary"
                >
                  <PersonAvatar
                    id={author.id}
                    name={author.name}
                    className="size-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {author.name}
                      {author.verified && <VerifiedBadge className="size-3.5" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Published {formatDate(bark.publishedAt)}
                      {bark.updatedAt
                        ? ` · Updated ${formatDate(bark.updatedAt)}`
                        : ""}{" "}
                      ·{" "}
                      {bark.live ? (
                        <BarkLiveViewCount
                          code={bark.code}
                          initialViews={bark.views}
                        />
                      ) : (
                        <>{formatNumber(bark.views)} views</>
                      )}
                    </p>
                  </div>
                </Link>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {bark.live ? (
                    <FollowBarkAuthorButton
                      authorClerkId={bark.authorId}
                      name={author.name}
                    />
                  ) : null}
                  {bark.live ? (
                    <MuteAuthorButton
                      authorClerkId={bark.authorId}
                      name={author.name}
                    />
                  ) : null}
                  {bark.live ? (
                    <StartMessageButton
                      kind="bark"
                      barkCode={bark.code}
                      hideIfClerkId={bark.authorId}
                      size="sm"
                    />
                  ) : null}
                  {bark.live ? (
                    <LikeButton
                      code={bark.code}
                      initialUpvotes={bark.upvotes}
                    />
                  ) : (
                    <Button variant="outline" size="sm">
                      {formatNumber(bark.upvotes)} likes
                    </Button>
                  )}
                  {bark.live ? (
                    <SaveBarkButton barkCode={bark.code} />
                  ) : null}
                  {bark.live ? <PromoteToCaseButton bark={bark} /> : null}
                  <ShareMenu
                    kind="bark"
                    code={bark.code}
                    title={bark.title}
                    path={`/barks/${bark.code}`}
                  />
                  {bark.live ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/create?quote=${bark.code}`}>Quote</Link>
                    </Button>
                  ) : null}
                  <ReportButton
                    target={`reaction ${bark.code}`}
                    barkCode={bark.live ? bark.code : undefined}
                    targetKind="bark"
                    targetId={bark.code}
                    iconOnly
                  />
                </div>
              </div>
            )}
          </header>

          {/* Source card — thumb by default; player only after Watch */}
          {source && creator && (
            <Card className="mt-6 min-w-0 gap-0 overflow-hidden p-0">
              <SourceWatchPanel
                source={source}
                creatorName={creator.name}
                creatorHandle={creator.handle}
                creatorHasProfile={creator.hasTeaBarksProfile}
                showSave={bark.live && Boolean(source.url)}
              />
            </Card>
          )}

          {/* Analysis content */}
          <div className="mt-8 min-w-0 break-words space-y-4">
            {bark.live ? <VisitDigestBanner code={bark.code} /> : null}
            {bark.quotedBarkCode ? (
              <QuotedBarkCard code={bark.quotedBarkCode} />
            ) : null}
            <OfficialCreatorResponse
              barkCode={bark.code}
              creator={creator}
              creatorResponse={bark.creatorResponse}
            />
            {bark.live ? <AmendReactionForm bark={bark} /> : null}
            {bark.live ? <ClaimMapSection bark={bark} /> : null}
            <BarkReadingToolbar />
            <BarkContent
              content={bark.content}
              evidence={bark.evidence}
              barkCode={bark.live ? bark.code : undefined}
            />
            {bark.live ? (
              <EvidenceRequestsPanel
                code={bark.code}
                authorClerkId={bark.authorId}
              />
            ) : null}
            {bark.live ? <CommunityNotesSection code={bark.code} /> : null}
          </div>

          <Separator className="my-10" />

          {/* Reply chain */}
          <section aria-labelledby="reply-chain">
            <h2
              id="reply-chain"
              className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <MessageSquare className="size-5" aria-hidden />
              Reply Chain
              <span className="text-sm font-normal text-muted-foreground">
                {formatNumber(bark.replyCount)} replies
              </span>
            </h2>
            {bark.live ? (
              <LiveReplyThread
                code={bark.code}
                replyCount={bark.replyCount}
              />
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Replies are unavailable for this reaction.
              </p>
            )}
          </section>
        </article>

        {/* Evidence panel + cite */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:h-fit">
          {creator ? <BarkCreatorPanel creator={creator} /> : null}
          {bark.live ? (
            <SourceDebateGraph
              sourceUrl={bark.sourceUrl}
              excludeCode={bark.code}
            />
          ) : null}
          {bark.live ? <BarkVersionHistory code={bark.code} /> : null}
          <CiteEmbed
            kind="bark"
            code={bark.code}
            title={bark.title}
            path={`/barks/${bark.code}`}
          />
          <Card className="gap-0 p-0">
            <div className="space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold">Evidence Panel</h2>
                <p className="text-xs text-muted-foreground">
                  {bark.evidence.length} items · rating{" "}
                  {bark.evidenceRating}/100
                </p>
              </div>
              <Tabs defaultValue="all">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                  {evidenceTabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {evidenceTabs.map((t) => {
                  const items =
                    t.value === "all"
                      ? bark.evidence
                      : bark.evidence.filter((e) => e.type === t.value);
                  return (
                    <TabsContent
                      key={t.value}
                      value={t.value}
                      className="mt-3 space-y-2"
                    >
                      {items.length === 0 ? (
                        <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                          No {t.label.toLowerCase()} attached.
                        </p>
                      ) : (
                        items.map((ev) => {
                          const evidenceIndex = bark.evidence.findIndex(
                            (item) => item.id === ev.id
                          );
                          return (
                            <EvidenceCard
                              key={ev.id}
                              evidence={ev}
                              barkCode={bark.live ? bark.code : undefined}
                              evidenceIndex={
                                evidenceIndex >= 0 ? evidenceIndex : undefined
                              }
                            />
                          );
                        })
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
