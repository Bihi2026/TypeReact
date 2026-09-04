"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Search, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { publishCreatorReview } from "@/app/actions/creator-reviews";
import { listPublicCreators } from "@/app/actions/creators";
import { BarkTypeBadge } from "@/components/bark-type-badge";
import { PersonAvatar } from "@/components/person-avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { barkTypeMeta } from "@/lib/meta";
import type { BarkType, Creator } from "@/lib/types";

const STEPS = ["Creator", "Write", "Publish"] as const;

export function CreateReviewWizard({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [creators, setCreators] = React.useState<Creator[]>([]);
  const [loadingCreators, setLoadingCreators] = React.useState(true);
  const [creatorQuery, setCreatorQuery] = React.useState("");
  const [selectedCreator, setSelectedCreator] = React.useState<Creator | null>(
    null
  );
  const [reviewType, setReviewType] = React.useState<BarkType>("mixed");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");

  React.useEffect(() => {
    void listPublicCreators().then((rows) => {
      setCreators(rows);
      setLoadingCreators(false);
    });
  }, []);

  const filteredCreators = React.useMemo(() => {
    const q = creatorQuery.trim().toLowerCase();
    if (!q) return creators.slice(0, 12);
    return creators
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          (c.externalHandle?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 12);
  }, [creatorQuery, creators]);

  const publishMutation = useMutation({
    mutationFn: publishCreatorReview,
    onSuccess: ({ code }) => {
      toast.success("Creator review published");
      router.push(`/reviews/${code}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not publish review");
    },
  });

  const canAdvance =
    step === 0
      ? !!selectedCreator
      : step === 1
        ? title.trim().length > 0 && body.trim().length > 0
        : true;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Write a Creator Review</h1>
        <p className="text-sm text-muted-foreground">
          Assess a creator&apos;s overall work, patterns, and accountability — not
          just one video.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <span
              className={
                i === step
                  ? "font-medium text-primary"
                  : i < step
                    ? "text-foreground"
                    : undefined
              }
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden>→</span>}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a creator</CardTitle>
            <CardDescription>
              Search verified creators on TypeReact to review their body of work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={creatorQuery}
                onChange={(e) => setCreatorQuery(e.target.value)}
                placeholder="Search by name or handle…"
                className="pl-9"
              />
            </div>
            {loadingCreators ? (
              <p className="text-sm text-muted-foreground">Loading creators…</p>
            ) : filteredCreators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No creators found.</p>
            ) : (
              <ul className="space-y-2">
                {filteredCreators.map((creator) => {
                  const selected = selectedCreator?.id === creator.id;
                  return (
                    <li key={creator.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCreator(creator)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <PersonAvatar
                          id={creator.id}
                          name={creator.name}
                          className="size-10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-medium">
                            {creator.name}
                            {creator.verified && (
                              <VerifiedBadge className="size-3.5" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{creator.handle}
                          </p>
                        </div>
                        {selected && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && selectedCreator && (
        <Card>
          <CardHeader>
            <CardTitle>Write your review</CardTitle>
            <CardDescription>
              Reviewing{" "}
              <Link
                href={`/creators/${selectedCreator.handle}`}
                className="font-medium text-foreground hover:underline"
              >
                {selectedCreator.name}
              </Link>
              . Be specific, sourced, and fair.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Overall stance</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(barkTypeMeta) as BarkType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReviewType(type)}
                    className="rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <BarkTypeBadge
                      type={type}
                      className={
                        reviewType === type ? "ring-2 ring-primary ring-offset-2" : ""
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-title">Title</Label>
              <Input
                id="review-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A clear headline for your creator review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-body">Review</Label>
              <Textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                placeholder="Summarize the creator's track record, recurring claims, response patterns, and what readers should know."
                className="font-serif text-base leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && selectedCreator && (
        <Card>
          <CardHeader>
            <CardTitle>Publish review</CardTitle>
            <CardDescription>
              Your permanent review code is generated at publish.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarkTypeBadge type={reviewType} />
                <Badge variant="outline">Creator Review</Badge>
              </div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="size-4" aria-hidden />
                About {selectedCreator.name}
              </p>
              <p className="line-clamp-4 font-serif text-sm text-foreground/90 whitespace-pre-wrap">
                {body}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (step === 0) onBack();
            else setStep((s) => s - 1);
          }}
        >
          <ArrowLeft className="size-4" />
          {step === 0 ? "Back to type" : "Previous"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={publishMutation.isPending || !selectedCreator}
            onClick={() => {
              if (!selectedCreator) return;
              publishMutation.mutate({
                creatorId: selectedCreator.id,
                type: reviewType,
                title: title.trim(),
                body: body.trim(),
                status: "public",
                evidence: [],
              });
            }}
          >
            {publishMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Publish review
          </Button>
        )}
      </div>
    </div>
  );
}
