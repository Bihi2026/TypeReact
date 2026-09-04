"use client";

import * as React from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { reportCategoryMeta, reportSeverityMeta } from "@/lib/meta";
import type { ReportCategory } from "@/lib/types";

export function ReportDialog({
  target,
  open,
  onOpenChange,
  barkCode,
  caseCode,
  storySlug,
  targetKind = "bark",
  targetId,
}: {
  /** Human-readable description of what is being reported, e.g. `reaction TR-2026-0341` */
  target: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barkCode?: string;
  caseCode?: string;
  storySlug?: string;
  targetKind?: "bark" | "comment";
  targetId?: string;
}) {
  const categories = React.useMemo(
    () => Object.keys(reportCategoryMeta) as ReportCategory[],
    []
  );
  const [category, setCategory] = React.useState<ReportCategory | null>(null);
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { isSignedIn } = useAuth();
  const submitBarkReport = useMutation(api.barks.submitReport);
  const submitCaseReport = useMutation(api.cases.submitReport);
  const submitStoryReport = useMutation(api.storySocial.submitReport);

  const submit = async () => {
    if (!category) {
      toast.error("Select a reason for the report.");
      return;
    }
    if ((barkCode || caseCode || storySlug) && !isSignedIn) {
      toast.error("Sign in to submit a report.");
      return;
    }
    if (barkCode || caseCode || storySlug) {
      setSubmitting(true);
      try {
        if (caseCode) {
          await submitCaseReport({
            code: caseCode,
            category,
            details,
          });
        } else if (barkCode) {
          await submitBarkReport({
            code: barkCode,
            targetKind,
            targetId: targetId ?? barkCode,
            category,
            details,
          });
        } else if (storySlug) {
          await submitStoryReport({
            slug: storySlug,
            category,
            details,
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Sign in to submit a report."
        );
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    toast.success("Report submitted", {
      description:
        "Our moderation team will review it and notify you of the outcome. Thank you for keeping TypeReact safe.",
    });
    onOpenChange(false);
    setCategory(null);
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-destructive" aria-hidden />
            Report {target}
          </DialogTitle>
          <DialogDescription>
            Reports are private — the author won&apos;t see who filed. Content
            doesn&apos;t need to be illegal to be reported; see the{" "}
            <Link
              href="/policies/community-guidelines"
              className="text-primary underline underline-offset-4"
              target="_blank"
            >
              Community Guidelines
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-3">
          <RadioGroup
            value={category ?? undefined}
            onValueChange={(v) => setCategory(v as ReportCategory)}
            className="gap-2"
          >
            {categories.map((c) => {
              const meta = reportCategoryMeta[c];
              const severity = reportSeverityMeta[meta.severity];
              return (
                <Label
                  key={c}
                  htmlFor={`report-${c}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
                >
                  <RadioGroupItem id={`report-${c}`} value={c} className="mt-0.5" />
                  <span className="flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <Badge
                        variant="outline"
                        className={`${severity.badgeClass} text-[10px]`}
                      >
                        {severity.label}
                      </Badge>
                    </span>
                    <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        </ScrollArea>
        <div className="space-y-2">
          <Label htmlFor="report-details">Details (optional)</Label>
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything that helps moderators find and assess the violation — timestamps, context, related content…"
            className="min-h-20"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Self-contained report trigger for server-rendered surfaces: a ghost
 * flag button that owns its dialog state.
 */
export function ReportButton({
  target,
  label = "Report",
  iconOnly = false,
  barkCode,
  caseCode,
  storySlug,
  targetKind,
  targetId,
}: {
  target: string;
  label?: string;
  iconOnly?: boolean;
  barkCode?: string;
  caseCode?: string;
  storySlug?: string;
  targetKind?: "bark" | "comment";
  targetId?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : "sm"}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={`Report ${target}`}
      >
        <Flag className="size-4" aria-hidden />
        {!iconOnly && label}
      </Button>
      <ReportDialog
        target={target}
        open={open}
        onOpenChange={setOpen}
        barkCode={barkCode}
        caseCode={caseCode}
        storySlug={storySlug}
        targetKind={targetKind}
        targetId={targetId}
      />
    </>
  );
}
