"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bookmark,
  FileText,
  Globe,
  MapPin,
  PenSquare,
  Scale,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BarkCard } from "@/components/bark-card";
import { FollowBarkAuthorButton } from "@/components/barks/follow-author-button";
import { CaseCard } from "@/components/case-card";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/person-avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useProfileEditor } from "@/components/profile/use-profile-editor";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatDate, formatNumber, gradientFor } from "@/lib/format";
import { barkTypeMeta } from "@/lib/meta";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiCase } from "@/lib/cases/query";
import { toUiBark } from "@/lib/barks/query";
import { CountrySelect } from "@/components/profile/country-select";
import { countries } from "@/lib/data";
import { profilePath, profileSlug } from "@/lib/profile";
import { readUserJson, STORAGE_KEYS } from "@/lib/storage";
import type {
  AccountabilityCase,
  Bark,
  BarkType,
  Creator,
  User,
} from "@/lib/types";
import type { WriterProfile } from "@/lib/writers/query";
import { cn } from "@/lib/utils";

type DraftSnapshot = {
  step: number;
  title: string;
  body: string;
  barkType: BarkType | null;
};

function evidenceLabel(score: number) {
  if (score >= 90)
    return { label: "Exemplary sourcing", className: "text-agree" };
  if (score >= 75)
    return { label: "Strong evidence habits", className: "text-agree" };
  if (score >= 55)
    return {
      label: "Building a record",
      className: "text-mixed-foreground dark:text-mixed",
    };
  return { label: "Needs stronger sources", className: "text-disagree" };
}

function TabCount({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 tabular-nums">
      {count}
    </Badge>
  );
}

export function ProfileView({
  user,
  country,
  barks,
  serverDrafts = [],
  cases,
  savedBarks,
  topTopics,
  initialCreator,
  initialCasesAboutMe,
  initialWriter,
  avatarUrl,
  website,
}: {
  user: User;
  country?: { code: string; name: string; flag: string };
  barks: Bark[];
  serverDrafts?: Bark[];
  cases: AccountabilityCase[];
  savedBarks: Bark[];
  topTopics: { slug: string; count: number }[];
  initialCreator: Creator | null;
  initialCasesAboutMe: AccountabilityCase[];
  initialWriter: WriterProfile | null;
  avatarUrl?: string;
  website?: string;
}) {
  const { user: clerkUser } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isOwner = Boolean(clerkUser?.id && clerkUser.id === user.id);
  const ownerAuth = isOwner && isAuthenticated;
  const userId = clerkUser?.id;
  const mine = useQuery(api.creators.getMine, ownerAuth ? {} : "skip");
  const settings = useQuery(
    api.userSettings.getMine,
    ownerAuth ? {} : "skip"
  );
  const creator = mine
    ? {
        id: mine._id,
        handle: mine.handle,
        name: mine.name,
        verified: mine.verified,
      }
    : initialCreator;
  const myWriterApp = useQuery(
    api.writers.getMyApplication,
    ownerAuth ? {} : "skip"
  );
  const resolvedWriter = isOwner
    ? myWriterApp?.status === "approved"
      ? { handle: myWriterApp.handle, penName: myWriterApp.penName }
      : myWriterApp === undefined
        ? initialWriter
        : null
    : initialWriter;
  const writerCtaLoading =
    isOwner &&
    (isLoading || (isAuthenticated && myWriterApp === undefined)) &&
    !resolvedWriter;
  const aboutDocs = useQuery(
    api.cases.listAboutCreator,
    isOwner && creator ? { creatorId: creator.id } : "skip"
  );
  const casesAboutMe = aboutDocs
    ? aboutDocs.map(toUiCase)
    : isOwner
      ? initialCasesAboutMe
      : [];
  const reactionDocs = useQuery(
    api.barks.listBySourceCreator,
    isOwner && creator ? { creatorId: creator.id as Id<"creators"> } : "skip"
  );
  const reactionsAboutMe = reactionDocs ? reactionDocs.map(toUiBark) : [];
  const openedDocs = useQuery(
    api.cases.listOpenedByMe,
    ownerAuth ? {} : "skip"
  );
  const ownerCases = openedDocs ? openedDocs.map(toUiCase) : cases;
  const [tab, setTab] = React.useState("barks");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftSnapshot | null>(null);
  const editor = useProfileEditor();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const evidence = evidenceLabel(user.evidenceScore);
  const bio = isOwner ? (settings?.bio ?? user.bio) : user.bio;
  const site = isOwner ? (settings?.website ?? website) : website;
  const countryShown = isOwner
    ? settings?.showCountry === false
      ? undefined
      : countries.find((c) => c.code === (settings?.country || user.country)) ??
        country
    : country;
  const savedDocs = useQuery(
    api.barks.listMineSaved,
    ownerAuth ? {} : "skip"
  );
  const savedItems = savedDocs ? savedDocs.map(toUiBark) : savedBarks;

  React.useEffect(() => {
    if (!isOwner || !userId) {
      setDraft(null);
      return;
    }
    const stored = readUserJson<DraftSnapshot | null>(
      userId,
      STORAGE_KEYS.barkDraft,
      null
    );
    if (stored && (stored.title?.trim() || stored.body?.trim() || stored.step > 0)) {
      setDraft(stored);
    }
  }, [isOwner, userId]);

  React.useEffect(() => {
    if (!isOwner) setEditing(false);
  }, [isOwner]);

  const startEditing = () => {
    editor.reset();
    setEditing(true);
  };

  const cancelEditing = () => {
    editor.reset();
    setEditing(false);
  };

  const saveEditing = async () => {
    const ok = await editor.save();
    if (ok) setEditing(false);
  };

  const sortedBarks = React.useMemo(
    () =>
      [...barks].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      ),
    [barks]
  );

  const typeBreakdown = React.useMemo(() => {
    const counts: Partial<Record<BarkType, number>> = {};
    for (const b of barks) counts[b.type] = (counts[b.type] ?? 0) + 1;
    return (Object.keys(barkTypeMeta) as BarkType[])
      .map((type) => ({ type, count: counts[type] ?? 0 }))
      .filter((x) => x.count > 0);
  }, [barks]);

  const avgEvidence =
    barks.length === 0
      ? 0
      : Math.round(
          barks.reduce((n, b) => n + b.evidenceRating, 0) / barks.length
        );

  const displayedUsername = isOwner
    ? editor.storedUsername || user.username
    : user.username;

  const displayName = isOwner
    ? (clerkUser?.fullName ?? clerkUser?.firstName ?? user.name)
    : user.name;

  const shareProfile = () => {
    const path = profilePath(
      profileSlug({
        username: displayedUsername,
        id: user.id,
      })
    );
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;
    void navigator.clipboard?.writeText(url).then(
      () => toast.success("Profile link copied"),
      () => toast.message("Share this profile", { description: url })
    );
  };

  const inboxCount = casesAboutMe.length + reactionsAboutMe.length;
  const draftsCount = serverDrafts.length + (draft ? 1 : 0);

  return (
    <div className="pb-10">
      <div className="relative overflow-hidden">
        <div
          className={cn(
            "h-36 w-full bg-gradient-to-br sm:h-44",
            gradientFor(user.id)
          )}
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22),transparent_50%),linear-gradient(to_top,rgba(0,0,0,0.25),transparent_55%)]" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <div className="relative -mt-12 space-y-6 sm:-mt-14">
          <div className="rounded-2xl border bg-card/95 p-4 shadow-sm backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <PersonAvatar
                  id={user.id}
                  name={displayName}
                  imageUrl={
                    avatarUrl ?? (isOwner ? clerkUser?.imageUrl : undefined)
                  }
                  className="size-24 border-4 border-background text-2xl shadow-md sm:size-28"
                />
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {displayName}
                    </h1>
                    {(user.verified || creator?.verified) && (
                      <VerifiedBadge className="size-5" />
                    )}
                    <Badge
                      variant="outline"
                      className="border-agree/30 bg-agree/10 text-agree"
                    >
                      Reactor
                    </Badge>
                    {creator ? (
                      <Badge
                        variant="outline"
                        className="border-verified/30 bg-verified/15 text-verified"
                      >
                        Creator
                      </Badge>
                    ) : null}
                    {resolvedWriter ? (
                      <Badge variant="outline">Writer</Badge>
                    ) : null}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>@{displayedUsername}</span>
                    <span aria-hidden>·</span>
                    <span>Joined {formatDate(user.joinedAt)}</span>
                    {countryShown ? (
                      <>
                        <span aria-hidden>·</span>
                        <Link
                          href={`/countries/${countryShown.code}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <MapPin className="size-3.5" aria-hidden />
                          {countryShown.flag} {countryShown.name}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {bio ? (
                    <p className="max-w-2xl text-sm leading-relaxed text-foreground/85">
                      {bio}
                    </p>
                  ) : null}
                  {site ? (
                    <a
                      href={site.startsWith("http") ? site : `https://${site}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Globe className="size-3.5" aria-hidden />
                      {site.replace(/^https?:\/\//, "")}
                    </a>
                  ) : null}
                  {topTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topTopics.map((t) => (
                        <Link key={t.slug} href={`/topics/${t.slug}`}>
                          <Badge variant="secondary" className="capitalize">
                            {t.slug}
                            <span className="ml-1 text-muted-foreground">
                              {t.count}
                            </span>
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {isOwner ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditing}
                    >
                      <Settings /> Edit profile
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy profile link"
                      onClick={shareProfile}
                    >
                      <Share2 />
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/create">
                        <PenSquare /> New reaction
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <FollowBarkAuthorButton
                      authorClerkId={user.id}
                      name={user.name}
                      size="sm"
                    />
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy profile link"
                      onClick={shareProfile}
                    >
                      <Share2 />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isOwner && draft ? (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    Draft in progress
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draft.title?.trim() || "Untitled reaction"} · step{" "}
                    {draft.step + 1} of 5
                    {draft.barkType
                      ? ` · ${barkTypeMeta[draft.barkType].label}`
                      : ""}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/create">Resume draft</Link>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-6">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Reactions",
                    value: formatNumber(user.barkCount),
                  },
                  {
                    label: "Avg evidence",
                    value: avgEvidence || "—",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border bg-muted/30 p-3"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <Tabs value={tab} onValueChange={setTab}>
                {isOwner ? (
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="barks" className="flex-none">
                      Reactions
                      <TabCount count={sortedBarks.length} />
                    </TabsTrigger>
                    <TabsTrigger value="cases" className="flex-none">
                      Cases
                      <TabCount count={ownerCases.length} />
                    </TabsTrigger>
                    {creator ? (
                      <TabsTrigger value="inbox" className="flex-none">
                        Inbox
                        <TabCount count={inboxCount} />
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger value="saved" className="flex-none">
                      Saved
                      <TabCount count={savedItems.length} />
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className="flex-none">
                      Drafts
                      <TabCount count={draftsCount} />
                    </TabsTrigger>
                  </TabsList>
                ) : null}

                <TabsContent value="barks" className={cn(isOwner ? "mt-4" : "mt-0", "space-y-3")}>
                  {sortedBarks.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title={isOwner ? "No reactions yet" : "No public reactions yet"}
                      description={
                        isOwner
                          ? "Your published evidence-based responses will show here."
                          : "This person hasn't published any public reactions yet."
                      }
                      action={
                        isOwner ? (
                          <Button asChild size="sm">
                            <Link href="/create">Create Reaction</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    sortedBarks.map((b) => <BarkCard key={b.id} bark={b} />)
                  )}
                </TabsContent>

                {isOwner ? (
                  <TabsContent value="cases" className="mt-4 space-y-3">
                    {ownerCases.length === 0 ? (
                      <EmptyState
                        icon={Scale}
                        title="No cases opened"
                        description="Accountability cases you open appear here with their status."
                        action={
                          <Button asChild size="sm" variant="outline">
                            <Link href="/cases/new">Open a case</Link>
                          </Button>
                        }
                      />
                    ) : (
                      ownerCases.map((c) => (
                        <CaseCard key={c.id} accountabilityCase={c} />
                      ))
                    )}
                  </TabsContent>
                ) : null}

                {isOwner && creator ? (
                  <TabsContent value="inbox" className="mt-4 space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Cases about you</h3>
                      {casesAboutMe.length === 0 ? (
                        <EmptyState
                          icon={Scale}
                          title="No cases about you"
                          description="When someone opens an accountability case naming your creator profile, it will show up here."
                        />
                      ) : (
                        casesAboutMe.map((inboxCase) => (
                          <div key={inboxCase.id} className="space-y-2">
                            <CaseCard accountabilityCase={inboxCase} />
                            {!inboxCase.creatorResponse ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/cases/${inboxCase.code}`}>
                                  Respond officially
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">
                        Reactions about you
                      </h3>
                      {reactionsAboutMe.length === 0 ? (
                        <EmptyState
                          icon={FileText}
                          title="No reactions about you"
                          description="Community reactions linked to your creator profile appear here."
                        />
                      ) : (
                        reactionsAboutMe.map((inboxBark) => (
                          <div key={inboxBark.id} className="space-y-2">
                            <BarkCard bark={inboxBark} />
                            {!inboxBark.creatorResponse ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/barks/${inboxBark.code}`}>
                                  Respond officially
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                ) : null}

                {isOwner ? (
                  <TabsContent value="saved" className="mt-4 space-y-3">
                    {savedItems.length === 0 ? (
                      <EmptyState
                        icon={Bookmark}
                        title="Nothing saved yet"
                        description="Save reactions while reading to build your research library."
                        action={
                          <Button asChild size="sm" variant="outline">
                            <Link href="/saved">Open saved</Link>
                          </Button>
                        }
                      />
                    ) : (
                      <>
                        {savedItems.map((b) => (
                          <BarkCard key={b.id} bark={b} />
                        ))}
                        <p className="text-center text-xs text-muted-foreground">
                          <Link href="/saved" className="text-primary hover:underline">
                            View full saved library
                          </Link>
                        </p>
                      </>
                    )}
                  </TabsContent>
                ) : null}

                {isOwner ? (
                  <TabsContent value="drafts" className="mt-4 space-y-3">
                    {serverDrafts.map((b) => (
                      <Card key={b.id} className="gap-0 p-0">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">Draft</Badge>
                              <Badge
                                variant="outline"
                                className={barkTypeMeta[b.type].badgeClass}
                              >
                                {barkTypeMeta[b.type].label}
                              </Badge>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {b.code}
                              </span>
                            </div>
                            <p className="font-medium">{b.title}</p>
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {b.excerpt || "Continue editing this reaction."}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/create?code=${b.code}`}>Edit</Link>
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/barks/${b.code}`}>Preview</Link>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {draft ? (
                      <Card className="gap-0 p-0">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">Local draft</Badge>
                              {draft.barkType ? (
                                <Badge
                                  variant="outline"
                                  className={barkTypeMeta[draft.barkType].badgeClass}
                                >
                                  {barkTypeMeta[draft.barkType].label}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="font-medium">
                              {draft.title?.trim() || "Untitled reaction"}
                            </p>
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {draft.body?.trim() ||
                                "Continue where you left off in the create wizard."}
                            </p>
                          </div>
                          <Button asChild size="sm" className="shrink-0">
                            <Link href="/create">Resume</Link>
                          </Button>
                        </div>
                      </Card>
                    ) : null}
                    {serverDrafts.length === 0 && !draft ? (
                      <EmptyState
                        icon={FileText}
                        title="No drafts"
                        description="Drafts you save from the reaction editor will appear here."
                        action={
                          <Button asChild size="sm">
                            <Link href="/create">Start a Reaction</Link>
                          </Button>
                        }
                      />
                    ) : null}
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
              <Card className="gap-0 p-0">
                <div className="space-y-4 p-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-agree" aria-hidden />
                    Evidence reputation
                  </h2>
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-3xl font-bold tabular-nums tracking-tight">
                        {user.evidenceScore}
                      </p>
                      <p
                        className={cn(
                          "pb-1 text-xs font-medium",
                          evidence.className
                        )}
                      >
                        {evidence.label}
                      </p>
                    </div>
                    <Progress
                      value={user.evidenceScore}
                      aria-label="Evidence score"
                    />
                    <p className="text-xs text-muted-foreground">
                      Community score based on citations, primary sources, and
                      how your reactions hold up under scrutiny.
                    </p>
                  </div>
                </div>
              </Card>

              {typeBreakdown.length > 0 ? (
                <Card className="gap-0 p-0">
                  <div className="space-y-3 p-4">
                    <h2 className="text-sm font-semibold">Reaction mix</h2>
                    <ul className="space-y-2">
                      {typeBreakdown.map(({ type, count }) => (
                        <li
                          key={type}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <Badge
                            variant="outline"
                            className={barkTypeMeta[type].badgeClass}
                          >
                            {barkTypeMeta[type].label}
                          </Badge>
                          <span className="tabular-nums text-muted-foreground">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ) : null}

              {creator || resolvedWriter ? (
                <Card className="gap-0 p-0">
                  <div className="space-y-3 p-4">
                    <h2 className="text-sm font-semibold">Profiles</h2>
                    {creator ? (
                      <Link
                        href={`/creators/${creator.handle}`}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <BadgeCheck className="mt-0.5 size-4 text-verified" />
                        <span>
                          <span className="block text-sm font-medium">
                            Creator profile
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{creator.handle}
                            {creator.name ? ` · ${creator.name}` : ""}
                          </span>
                        </span>
                      </Link>
                    ) : null}
                    {resolvedWriter ? (
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <PenSquare className="mt-0.5 size-4 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">
                            Writer
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {resolvedWriter.penName} · @{resolvedWriter.handle}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              {isOwner ? (
                <Card className="gap-0 p-0">
                  <div className="space-y-3 p-4">
                    <h2 className="text-sm font-semibold">Grow your presence</h2>
                    {writerCtaLoading ? (
                      <div className="h-[4.5rem] animate-pulse rounded-lg border bg-muted/40" />
                    ) : resolvedWriter ? (
                      <Link
                        href="/stories/dashboard"
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <PenSquare className="mt-0.5 size-4 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">
                            Writer dashboard
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Writing as {resolvedWriter.penName} · @
                            {resolvedWriter.handle}
                          </span>
                        </span>
                      </Link>
                    ) : myWriterApp ? (
                      <Link
                        href="/stories/dashboard"
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <PenSquare className="mt-0.5 size-4 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">
                            Application status
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {myWriterApp.status === "pending"
                              ? `Application ${myWriterApp.applicationCode} is under review.`
                              : `Application ${myWriterApp.applicationCode} is already on file.`}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href="/stories/apply"
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <PenSquare className="mt-0.5 size-4 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">
                            Become a Writer
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Publish serialized fiction on Stories.
                          </span>
                        </span>
                      </Link>
                    )}
                    {creator ? null : (
                      <Link
                        href="/creators/apply"
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <BadgeCheck className="mt-0.5 size-4 text-verified" />
                        <span>
                          <span className="block text-sm font-medium">
                            Become a Creator
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Claim a public profile and respond officially.
                          </span>
                        </span>
                      </Link>
                    )}
                  </div>
                </Card>
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) cancelEditing();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              How you appear across reactions, cases, and replies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PersonAvatar
                id={user.id}
                name={editor.name || displayName}
                imageUrl={avatarUrl ?? clerkUser?.imageUrl}
                className="size-16 text-xl"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void editor.changeAvatar(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={editor.avatarBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {editor.avatarBusy ? "Updating…" : "Change photo"}
                </Button>
                {clerkUser?.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={editor.avatarBusy}
                    onClick={() => void editor.changeAvatar(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-edit-name">Display name</Label>
                <Input
                  id="profile-edit-name"
                  value={editor.name}
                  onChange={(e) => editor.setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-edit-username">Username</Label>
                <Input
                  id="profile-edit-username"
                  value={editor.username}
                  onChange={(e) => editor.setUsername(e.target.value)}
                  placeholder="yourname"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  3–30 characters. Letters, numbers, and underscores.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-edit-bio">Bio</Label>
              <Textarea
                id="profile-edit-bio"
                value={editor.bio}
                onChange={(e) => editor.setBio(e.target.value)}
                className="min-h-24"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-edit-website">Website</Label>
                <Input
                  id="profile-edit-website"
                  value={editor.website}
                  onChange={(e) => editor.setWebsite(e.target.value)}
                  placeholder="https://your-research-site.org"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-edit-country">Country</Label>
                <CountrySelect
                  id="profile-edit-country"
                  value={editor.country}
                  onChange={editor.setCountry}
                  disabled={editor.saving}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelEditing}
              disabled={editor.saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveEditing()} disabled={editor.saving}>
              {editor.saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
