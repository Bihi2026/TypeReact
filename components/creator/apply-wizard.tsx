"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardCopy,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
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
import { CountrySelect } from "@/components/profile/country-select";
import {
  applyAsCreator,
  getCreatorByIdAction,
} from "@/app/actions/creators";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { REACTION_PLURAL } from "@/lib/brand";
import { topics } from "@/lib/data";
import { platformMeta } from "@/lib/meta";
import type { Creator, SourcePlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Platforms", "Ownership", "Identity", "Review"] as const;

const applicablePlatforms: SourcePlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "x",
  "podcast",
  "livestream",
];

function generateVerificationId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TR-${suffix}`;
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
          <Link href="/creators">
            <ArrowLeft /> Back to creators
          </Link>
        </Button>
        {!bare ? (
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <BadgeCheck className="size-5 text-primary" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Become a Creator
              </h1>
              <p className="text-sm text-muted-foreground">
                Verify that you own the public channels being discussed on
                TypeReact. Verified creators get a badge, an official profile,
                and the ability to respond to {REACTION_PLURAL.toLowerCase()}{" "}
                and accountability cases about their content.
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

export function ApplyWizardSkeleton() {
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

export function ApplyWizard() {
  const { isSignedIn, user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState(0);
  const [selected, setSelected] = React.useState<SourcePlatform[]>([]);
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [displayName, setDisplayName] = React.useState("");
  const [category, setCategory] = React.useState<string>("");
  const [country, setCountry] = React.useState("EG");
  const [about, setAbout] = React.useState("");
  const [legalName, setLegalName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [proofPostUrl, setProofPostUrl] = React.useState("");
  const [emergencyContacts, setEmergencyContacts] = React.useState([
    { name: "", phone: "", relationship: "" },
    { name: "", phone: "", relationship: "" },
  ]);
  const [verificationId, setVerificationId] = React.useState("");
  const [claimCreatorId, setClaimCreatorId] = React.useState<string>();
  const [claimProfile, setClaimProfile] = React.useState<Creator | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [applicationCode, setApplicationCode] = React.useState<string | null>(
    null
  );
  const [submittedVerificationId, setSubmittedVerificationId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    const name = user?.fullName ?? user?.username ?? "";
    if (name) setDisplayName((current) => current || name);
    const primaryEmail = user?.primaryEmailAddress?.emailAddress;
    if (primaryEmail) setEmail((current) => current || primaryEmail);
  }, [user?.fullName, user?.username, user?.primaryEmailAddress?.emailAddress]);

  React.useEffect(() => {
    const claim = searchParams.get("claim");
    if (!claim) return;
    setClaimCreatorId(claim);
    void getCreatorByIdAction(claim).then((doc) => {
      if (!doc) return;
      setClaimProfile(doc);
      setDisplayName((current) => current || doc.name);
      setAbout((current) => current || doc.bio);
      setCategory((current) => current || doc.topics[0] || "");
      if (doc.country) setCountry((current) => current || doc.country);
      if (doc.platforms.length) {
        setSelected((current) => (current.length ? current : doc.platforms));
      }
      setLinks((prev) => {
        const next = { ...prev };
        for (const link of doc.officialLinks) {
          const platform =
            doc.platforms.find((p) =>
              link.label.toLowerCase().includes(platformMeta[p].label.toLowerCase())
            ) ?? doc.platforms[0];
          if (platform && !next[platform]) next[platform] = link.url;
        }
        return next;
      });
    });
  }, [searchParams]);

  const claimEligibility = useQuery(
    api.creators.canClaimCreator,
    claimCreatorId && isAuthenticated
      ? { creatorId: claimCreatorId as Id<"creators"> }
      : "skip"
  );

  React.useEffect(() => {
    if (step === 1 && !verificationId) {
      setVerificationId(generateVerificationId());
    }
  }, [step, verificationId]);

  const togglePlatform = (p: SourcePlatform) =>
    setSelected((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const next = () => {
    if (step === 0) {
      if (selected.length === 0) {
        toast.error("Select at least one platform you create on.");
        return;
      }
      const missingLink = selected.filter(
        (p) => !(links[p] ?? "").trim()
      );
      if (missingLink.length > 0) {
        toast.error(
          `Add a link for ${missingLink
            .map((p) => platformMeta[p].label)
            .join(", ")}.`
        );
        return;
      }
      if (
        claimProfile?.externalPlatform &&
        claimProfile.externalHandle &&
        !selected.includes(claimProfile.externalPlatform)
      ) {
        toast.error(
          `Include ${platformMeta[claimProfile.externalPlatform].label} — your official link must match @${claimProfile.externalHandle}.`
        );
        return;
      }
    }
    if (step === 2) {
      if (!displayName.trim() || !category) {
        toast.error("Add your public name and a content category.");
        return;
      }
      if (!legalName.trim() || !email.trim() || !phone.trim()) {
        toast.error("Legal name, email, and phone are required.");
        return;
      }
      const filledContacts = emergencyContacts.filter(
        (contact) =>
          contact.name.trim() &&
          contact.phone.trim() &&
          contact.relationship.trim()
      );
      if (filledContacts.length < 2) {
        toast.error("Add at least two emergency contacts.");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!isSignedIn) {
      toast.error("Sign in to submit a creator application.");
      return;
    }
    setSubmitting(true);
    try {
      const officialLinks = selected
        .map((platform) => ({
          label: platformMeta[platform].label,
          url: (links[platform] ?? "").trim(),
        }))
        .filter((link) => link.url);
      const result = await applyAsCreator({
        name: displayName.trim(),
        bio: about.trim(),
        country,
        category,
        platforms: selected,
        officialLinks,
        verificationMethod: "code",
        claimCreatorId,
        legalName: legalName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        proofPostUrl: proofPostUrl.trim() || undefined,
        verificationIdHint: verificationId,
        emergencyContacts: emergencyContacts.filter(
          (contact) =>
            contact.name.trim() &&
            contact.phone.trim() &&
            contact.relationship.trim()
        ),
      });
      setApplicationCode(result.applicationCode);
      setSubmittedVerificationId(result.verificationId ?? verificationId);
      toast.success("Application submitted", {
        description:
          "Our verification team reviews applications within 3–5 days. You'll be notified of the outcome.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (applicationCode) {
    return (
      <ApplyPageChrome bare>
        <Card>
          <CardHeader className="items-center space-y-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-mixed/20">
              <Clock3
                className="size-7 text-mixed-foreground dark:text-mixed"
                aria-hidden
              />
            </span>
            <div className="space-y-2">
              <CardTitle>Application pending review</CardTitle>
              <Badge variant="secondary" className="font-mono">
                {applicationCode}
              </Badge>
              {submittedVerificationId ? (
                <Badge variant="outline" className="font-mono">
                  {submittedVerificationId}
                </Badge>
              ) : null}
            </div>
            <CardDescription className="max-w-md leading-relaxed">
              Your creator application is with the verification team. Once
              approved, your profile gets the{" "}
              <BadgeCheck className="inline size-4 text-verified" aria-hidden />{" "}
              verified badge and you can post Official Responses to{" "}
              {REACTION_PLURAL.toLowerCase()} and cases about your content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/profile">Go to profile</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/creators">Back to creators</Link>
            </Button>
          </CardContent>
        </Card>
      </ApplyPageChrome>
    );
  }

  if (
    claimCreatorId &&
    isAuthenticated &&
    claimEligibility !== undefined &&
    !claimEligibility.allowed
  ) {
    return (
      <ApplyPageChrome bare>
        <Card>
          <CardHeader className="items-center space-y-3 text-center">
            <CardTitle>Cannot claim this profile</CardTitle>
            <CardDescription className="max-w-md leading-relaxed">
              {claimEligibility.reason ??
                "You are not eligible to claim this creator profile."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/creators">Browse creators</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/create">Publish a reaction</Link>
            </Button>
          </CardContent>
        </Card>
      </ApplyPageChrome>
    );
  }

  return (
    <ApplyPageChrome>
      <Stepper step={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where do you create?</CardTitle>
            <CardDescription>
              Select your platforms and paste a link to your channel or profile
              on each.
              {claimProfile?.externalHandle && claimProfile.externalPlatform ? (
                <>
                  {" "}
                  Your{" "}
                  {platformMeta[claimProfile.externalPlatform].label} link must
                  match @{claimProfile.externalHandle}.
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {applicablePlatforms.map((p) => {
              const active = selected.includes(p);
              return (
                <div
                  key={p}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    active && "border-primary/50 bg-accent/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`platform-${p}`}
                      checked={active}
                      onCheckedChange={() => togglePlatform(p)}
                    />
                    <Label
                      htmlFor={`platform-${p}`}
                      className="flex flex-1 cursor-pointer items-center gap-2"
                    >
                      <PlatformIcon platform={p} className="size-4" />
                      {platformMeta[p].label}
                    </Label>
                  </div>
                  {active && (
                    <Input
                      className="mt-3"
                      placeholder={`Link to your ${platformMeta[p].label} channel or profile`}
                      value={links[p] ?? ""}
                      onChange={(e) =>
                        setLinks((prev) => ({ ...prev, [p]: e.target.value }))
                      }
                      aria-label={`${platformMeta[p].label} link`}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Prove ownership</CardTitle>
            <CardDescription>
              Place a one-time code in your channel bio or a pinned post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add this code to the bio or a pinned post of each selected
              channel, then submit. We check for it during review and you can
              remove it after approval.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {verificationId || "Generating…"}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy verification code"
                disabled={!verificationId}
                onClick={() => {
                  if (!verificationId) return;
                  navigator.clipboard.writeText(verificationId);
                  toast.success("Code copied to clipboard");
                }}
              >
                <ClipboardCopy className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proof-post-url">Proof post URL (optional)</Label>
              <Input
                id="proof-post-url"
                value={proofPostUrl}
                onChange={(e) => setProofPostUrl(e.target.value)}
                placeholder="Link to the post or bio where you placed the code"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Public identity</CardTitle>
            <CardDescription>
              How your creator profile will appear on TypeReact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creator-name">Public name</Label>
                <Input
                  id="creator-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Content category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger aria-label="Content category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creator-country">Country</Label>
              <CountrySelect
                id="creator-country"
                value={country}
                onChange={setCountry}
                className="sm:max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creator-about">About your content</Label>
              <Textarea
                id="creator-about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="What do you make, and for whom?"
                className="min-h-24"
              />
            </div>
            <Separator />
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Private verification</h3>
                <p className="text-xs text-muted-foreground">
                  Used only for identity review — never shown on your public
                  profile.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legal-name">Legal name</Label>
                  <Input
                    id="legal-name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creator-email">Email</Label>
                  <Input
                    id="creator-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="creator-phone">Phone</Label>
                <Input
                  id="creator-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="sm:max-w-xs"
                />
              </div>
              <div className="space-y-3">
                <Label>Emergency contacts (at least 2)</Label>
                {emergencyContacts.map((contact, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3"
                  >
                    <Input
                      placeholder="Name"
                      value={contact.name}
                      onChange={(e) =>
                        setEmergencyContacts((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? { ...row, name: e.target.value }
                              : row
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="Phone"
                      value={contact.phone}
                      onChange={(e) =>
                        setEmergencyContacts((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? { ...row, phone: e.target.value }
                              : row
                          )
                        )
                      }
                    />
                    <Input
                      placeholder="Relationship"
                      value={contact.relationship}
                      onChange={(e) =>
                        setEmergencyContacts((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? { ...row, relationship: e.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEmergencyContacts((prev) => [
                      ...prev,
                      { name: "", phone: "", relationship: "" },
                    ])
                  }
                >
                  Add another contact
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review and submit</CardTitle>
            <CardDescription>
              The verification team reviews applications within 3–5 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Public name</dt>
                <dd className="font-medium">{displayName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">
                  {topics.find((t) => t.slug === category)?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Platforms</dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {selected.map((p) => (
                    <Badge key={p} variant="secondary" className="gap-1">
                      <PlatformIcon platform={p} className="size-3" />
                      {platformMeta[p].label}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ownership proof</dt>
                <dd className="font-mono text-xs font-medium">
                  {verificationId}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Legal name</dt>
                <dd className="font-medium">{legalName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Emergency contacts</dt>
                <dd className="font-medium">
                  {
                    emergencyContacts.filter(
                      (contact) =>
                        contact.name.trim() &&
                        contact.phone.trim() &&
                        contact.relationship.trim()
                    ).length
                  }
                </dd>
              </div>
            </dl>
            <Separator />
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                By submitting you confirm you own these channels and agree to
                the{" "}
                <Link
                  href="/policies/community-guidelines"
                  className="text-primary underline underline-offset-4"
                >
                  Community Guidelines
                </Link>
                . Misrepresenting ownership is impersonation and leads to a
                permanent ban.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : !isSignedIn ? (
          <SignInButton>
            <Button>
              <BadgeCheck className="size-4" /> Sign in to submit
            </Button>
          </SignInButton>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            <BadgeCheck className="size-4" />
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        )}
      </div>
    </ApplyPageChrome>
  );
}
