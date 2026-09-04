"use client";

import {
  Camera,
  Clock,
  ExternalLink,
  FileText,
  Film,
  FlaskConical,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { EvidenceVoteControls } from "@/components/bark/advanced-reaction-tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  evidencePermalinkHash,
  withPermalinkHash,
} from "@/lib/barks/permalinks";
import { getPerson } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { evidenceTypeMeta } from "@/lib/meta";
import type { Evidence, EvidenceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeIcons: Record<EvidenceType, typeof FileText> = {
  screenshot: Camera,
  document: FileText,
  video: Film,
  link: Link2,
  timestamp: Clock,
  research: FlaskConical,
};

export function EvidenceCard({
  evidence,
  className,
  barkCode,
  evidenceIndex,
}: {
  evidence: Evidence;
  className?: string;
  barkCode?: string;
  evidenceIndex?: number;
}) {
  const Icon = (evidence.type && typeIcons[evidence.type]) || FileText;
  const addedByName =
    evidence.addedByName ||
    (evidence.addedById ? getPerson(evidence.addedById).name : "Anonymous");
  const isVideo =
    evidence.type === "video" ||
    Boolean(evidence.contentType?.startsWith("video/"));

  return (
    <Card className={cn("gap-0 p-0", className)}>
      <div className="flex gap-3 p-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium leading-tight">
              {evidence.title}
            </span>
            {evidence.timestamp && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {evidence.timestamp}
              </Badge>
            )}
            {evidence.verified && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] text-agree"
                title="Source verified"
              >
                <ShieldCheck className="size-3" aria-hidden />
                Verified
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {evidence.description}
          </p>
          {evidence.type === "screenshot" && evidence.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={evidence.url}
              alt=""
              className="mt-2 max-h-48 w-full rounded-md border object-contain bg-muted"
            />
          )}
          {isVideo && evidence.url && (
            <video
              controls
              preload="metadata"
              className="mt-2 w-full rounded-md border bg-black"
              src={evidence.url}
            >
              {evidence.contentType ? (
                <source src={evidence.url} type={evidence.contentType} />
              ) : null}
            </video>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
            <span>
              {evidence.type && evidenceTypeMeta[evidence.type]?.label
                ? evidenceTypeMeta[evidence.type].label
                : evidence.type || "Evidence"}
            </span>
            <span aria-hidden>·</span>
            <span>
              Added by {addedByName}, {formatDate(evidence.addedAt)}
            </span>
            {evidence.fileName && <span aria-hidden>·</span>}
            {evidence.fileName && (
              <span className="truncate">{evidence.fileName}</span>
            )}
            {evidence.url &&
              evidence.type !== "screenshot" &&
              evidence.type !== "timestamp" &&
              !isVideo && (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Open source <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
          </div>
          {barkCode !== undefined && evidenceIndex !== undefined ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <EvidenceVoteControls
                code={barkCode}
                evidenceIndex={evidenceIndex}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => {
                  const hash = evidencePermalinkHash(evidenceIndex);
                  const origin = window.location.origin;
                  const url = withPermalinkHash(
                    `${origin}/barks/${barkCode}`,
                    hash
                  );
                  void navigator.clipboard.writeText(url).then(
                    () => toast.success("Evidence link copied"),
                    () => toast.error("Couldn't copy link")
                  );
                }}
              >
                <Link2 className="size-3" aria-hidden />
                Copy link
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
