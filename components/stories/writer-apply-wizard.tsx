"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  PenLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { genreMeta } from "@/lib/story-meta";
import type { StoryGenre } from "@/lib/story-types";
import { cn } from "@/lib/utils";

const STEPS = ["Profile", "Sample", "Commitments", "Review"] as const;
const MIN_SAMPLE_WORDS = 100;
const PREVIEW_WORDS = 120;

type WriterLanguage = "en" | "ar" | "es" | "fr" | "hi";
type WriterCadence = "weekly" | "biweekly" | "monthly" | "complete";

const cadenceLabel: Record<WriterCadence, string> = {
  weekly: "Weekly parts",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  complete: "Completed works only",
};

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function sampleExcerpt(text: string, limit = PREVIEW_WORDS): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= limit) return text.trim();
  return `${parts.slice(0, limit).join(" ")}…`;
}

function ApplyPageChrome({
  children,
  bare = false,
}: {
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
          <Link href="/stories">
            <ArrowLeft /> Back to stories
          </Link>
        </Button>
        {!bare ? (
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <PenLine className="size-5 text-primary" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Become a Writer
              </h1>
              <p className="text-sm text-muted-foreground">
                Publish serialized stories, join contests, and build readers.
                One short application and one writing sample.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
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
      <p className="text-center text-xs text-muted-foreground sm:hidden">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
    </div>
  );
}

function ApplyWizardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Skeleton className="h-8 w-36" />
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-7 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

function ApplicationStatusCard({
  code,
  status,
}: {
  code: string;
  status: "pending" | "rejected";
}) {
  const rejected = status === "rejected";
  return (
    <ApplyPageChrome bare>
      <Card>
        <CardHeader className="items-center space-y-3 text-center">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full",
              rejected ? "bg-disagree/15" : "bg-mixed/20"
            )}
          >
            {rejected ? (
              <XCircle className="size-7 text-disagree" aria-hidden />
            ) : (
              <Clock3
                className="size-7 text-mixed-foreground dark:text-mixed"
                aria-hidden
              />
            )}
          </span>
          <div className="space-y-2">
            <CardTitle>
              {rejected ? "Application not approved" : "Application received"}
            </CardTitle>
            <Badge variant="secondary" className="font-mono">
              {code}
            </Badge>
          </div>
          <CardDescription className="max-w-md leading-relaxed">
            {rejected
              ? "This application is already on file, so a new submission is not available from this page."
              : "Our editorial team reads every sample — usually within a week. Once approved, you get the writer dashboard, publishing tools, and contest entry."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button size="sm" asChild>
            <Link href="/profile">Go to profile</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/stories">Back to stories</Link>
          </Button>
        </CardContent>
      </Card>
    </ApplyPageChrome>
  );
}

export function WriterApplyWizard() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const application = useQuery(
    api.writers.getMyApplication,
    isAuthenticated ? {} : "skip"
  );
  const apply = useMutation(api.writers.apply);
  const genres = React.useMemo(() => Object.keys(genreMeta) as StoryGenre[], []);
  const [step, setStep] = React.useState(0);
  const [penName, setPenName] = React.useState("");
  const [selectedGenres, setSelectedGenres] = React.useState<StoryGenre[]>([]);
  const [language, setLanguage] = React.useState<WriterLanguage>("en");
  const [sampleTitle, setSampleTitle] = React.useState("");
  const [sample, setSample] = React.useState("");
  const [originality, setOriginality] = React.useState(false);
  const [policy, setPolicy] = React.useState(false);
  const [cadence, setCadence] = React.useState<WriterCadence>("weekly");
  const [submitting, setSubmitting] = React.useState(false);
  const [applicationCode, setApplicationCode] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    const name = user?.fullName ?? user?.username ?? "";
    if (name) setPenName((current) => current || name);
  }, [user?.fullName, user?.username]);

  React.useEffect(() => {
    if (application?.status === "approved") {
      router.replace("/stories/dashboard");
    }
  }, [application, router]);

  const words = wordCount(sample);
  const wordProgress = Math.min(100, (words / MIN_SAMPLE_WORDS) * 100);

  const toggleGenre = (g: StoryGenre) =>
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const next = () => {
    if (step === 0 && (!penName.trim() || selectedGenres.length === 0)) {
      toast.error("Add a pen name and pick at least one genre.");
      return;
    }
    if (step === 1) {
      if (!sampleTitle.trim()) {
        toast.error("Give your sample a title.");
        return;
      }
      if (words < MIN_SAMPLE_WORDS) {
        toast.error(`Your sample needs at least ${MIN_SAMPLE_WORDS} words.`, {
          description: `Currently ${words} — show the reviewers your voice.`,
        });
        return;
      }
    }
    if (step === 2 && (!originality || !policy)) {
      toast.error("Both declarations are required to publish on TypeReact.");
      return;
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!isSignedIn) {
      toast.error("Sign in to submit a writer application.");
      return;
    }
    if (!originality || !policy) {
      toast.error("Both declarations are required to publish on TypeReact.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apply({
        penName: penName.trim(),
        language,
        genres: selectedGenres,
        sampleTitle: sampleTitle.trim(),
        sample,
        cadence,
        originalityAccepted: originality,
        policyAccepted: policy,
      });
      setApplicationCode(result.applicationCode);
      toast.success("Writer application submitted", {
        description:
          "The editorial team reviews applications within a week. You'll be notified either way.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (
    isLoading ||
    (isAuthenticated && application === undefined) ||
    application?.status === "approved"
  ) {
    return <ApplyWizardSkeleton />;
  }

  if (application) {
    return (
      <ApplicationStatusCard
        code={application.applicationCode}
        status={application.status === "rejected" ? "rejected" : "pending"}
      />
    );
  }

  if (applicationCode) {
    return <ApplicationStatusCard code={applicationCode} status="pending" />;
  }

  return (
    <ApplyPageChrome>
      <Stepper step={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Writing profile</CardTitle>
            <CardDescription>
              How readers will see you across your stories.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pen-name">Pen name</Label>
                <Input
                  id="pen-name"
                  value={penName}
                  onChange={(e) => setPenName(e.target.value)}
                  placeholder="The name on your covers"
                />
              </div>
              <div className="space-y-2">
                <Label>Primary language</Label>
                <Select
                  value={language}
                  onValueChange={(value) =>
                    setLanguage(value as WriterLanguage)
                  }
                >
                  <SelectTrigger aria-label="Primary language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Genres you write</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {genres.map((g) => {
                  const active = selectedGenres.includes(g);
                  const Icon = genreMeta[g].icon;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-accent/50 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {genreMeta[g].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Writing sample</CardTitle>
            <CardDescription>
              An opening scene, a chapter, a handful of poems — at least{" "}
              {MIN_SAMPLE_WORDS} words of your best work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sample-title">Sample title</Label>
              <Input
                id="sample-title"
                value={sampleTitle}
                onChange={(e) => setSampleTitle(e.target.value)}
                placeholder="e.g. The Punctuality Bonus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-body">Sample</Label>
              <Textarea
                id="sample-body"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
                placeholder="Paste or write your sample here…"
                className="min-h-56 font-serif"
              />
              <div className="space-y-1.5" aria-live="polite">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      words >= MIN_SAMPLE_WORDS
                        ? "text-agree"
                        : "text-muted-foreground"
                    )}
                  >
                    {words} / {MIN_SAMPLE_WORDS} words minimum
                  </span>
                  {words >= MIN_SAMPLE_WORDS ? (
                    <span className="text-agree">Ready</span>
                  ) : null}
                </div>
                <Progress
                  value={wordProgress}
                  aria-label={`${words} of ${MIN_SAMPLE_WORDS} words`}
                  className="h-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Commitments</CardTitle>
            <CardDescription>
              The two promises every TypeReact writer makes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="originality"
                checked={originality}
                onCheckedChange={(v) => setOriginality(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="originality" className="cursor-pointer font-normal">
                <span className="block font-medium">Originality</span>
                <span className="text-xs text-muted-foreground">
                  Everything I publish is my own work. Fan fiction is welcome
                  when labeled; plagiarism ends a writer account permanently.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="content-policy"
                checked={policy}
                onCheckedChange={(v) => setPolicy(v === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="content-policy"
                className="cursor-pointer font-normal"
              >
                <span className="block font-medium">Content policy</span>
                <span className="text-xs text-muted-foreground">
                  I&apos;ll tag mature content honestly and follow the{" "}
                  <Link
                    href="/policies/community-guidelines"
                    className="text-primary underline underline-offset-4"
                    target="_blank"
                  >
                    Community Guidelines
                  </Link>{" "}
                  — no hate speech, no harassment, in fiction or comments.
                </span>
              </Label>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Planned publishing cadence</Label>
              <Select
                value={cadence}
                onValueChange={(value) => setCadence(value as WriterCadence)}
              >
                <SelectTrigger
                  className="w-full sm:max-w-xs"
                  aria-label="Publishing cadence"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly parts</SelectItem>
                  <SelectItem value="biweekly">Every two weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="complete">
                    Completed works only
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Not binding — it helps us surface your stories to the right
                readers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review and submit</CardTitle>
            <CardDescription>
              Confirm your details. The editorial team reviews applications
              within a week.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pen name</dt>
                <dd className="font-medium">{penName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Language</dt>
                <dd className="font-medium uppercase">{language}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Genres</dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {selectedGenres.map((g) => (
                    <Badge key={g} variant="secondary">
                      {genreMeta[g].label}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cadence</dt>
                <dd className="font-medium">{cadenceLabel[cadence]}</dd>
              </div>
            </dl>

            <div className="space-y-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    &ldquo;{sampleTitle}&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {words} words
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                >
                  Continue editing
                </Button>
              </div>
              <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground/90">
                {sampleExcerpt(sample)}
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <p>
                Approval unlocks the writer dashboard, story publishing, and
                contest entry. Rejections come with editorial feedback and a
                30-day reapply window.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={next}>
            Continue <ArrowRight />
          </Button>
        ) : !isSignedIn ? (
          <SignInButton>
            <Button size="sm">
              <PenLine /> Sign in to submit
            </Button>
          </SignInButton>
        ) : (
          <Button size="sm" onClick={submit} disabled={submitting}>
            <PenLine />
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        )}
      </div>
    </ApplyPageChrome>
  );
}
