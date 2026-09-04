"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { AskForEvidenceButton } from "@/components/bark/evidence-requests";
import { PermalinkScroll } from "@/components/bark/permalink-scroll";
import { EvidenceCard } from "@/components/evidence-card";
import { MentionText } from "@/components/comments/mention-text";
import { ReadingProse } from "@/components/reading-prose";
import {
  blockPermalinkHash,
  evidencePermalinkHash,
  withPermalinkHash,
} from "@/lib/barks/permalinks";
import type { ContentBlock, Evidence } from "@/lib/types";
import { cn } from "@/lib/utils";

async function copyPermalink(path: string, hash: string, label: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = withPermalinkHash(`${origin}${path}`, hash);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(`${label} link copied`);
  } catch {
    toast.error("Couldn't copy link");
  }
}

function BlockAnchor({
  id,
  barkCode,
  blockIndex,
  claimSnippet,
  label,
  className,
  children,
  allowAskEvidence,
}: {
  id: string;
  barkCode?: string;
  blockIndex?: number;
  claimSnippet?: string;
  label: string;
  className?: string;
  children: React.ReactNode;
  allowAskEvidence?: boolean;
}) {
  return (
    <div id={id} className={cn("group/anchor scroll-mt-24", className)}>
      {barkCode ? (
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/anchor:opacity-100 focus-visible:opacity-100"
            aria-label={`Copy link to ${label}`}
            onClick={() =>
              void copyPermalink(`/barks/${barkCode}`, id, label)
            }
          >
            <Link2 className="size-3" aria-hidden />
            Permalink
          </button>
          {allowAskEvidence &&
          blockIndex !== undefined &&
          claimSnippet ? (
            <AskForEvidenceButton
              barkCode={barkCode}
              blockIndex={blockIndex}
              claimSnippet={claimSnippet}
            />
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function BarkContent({
  content,
  evidence,
  barkCode,
}: {
  content: ContentBlock[];
  evidence: Evidence[];
  barkCode?: string;
}) {
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));

  return (
    <ReadingProse>
      <PermalinkScroll />
      {content.map((block, i) => {
        const blockId = blockPermalinkHash(i);
        switch (block.kind) {
          case "heading":
            return (
              <BlockAnchor
                key={i}
                id={blockId}
                barkCode={barkCode}
                blockIndex={i}
                claimSnippet={block.text}
                label="section"
                allowAskEvidence
              >
                <h2>
                  <MentionText text={block.text} />
                </h2>
              </BlockAnchor>
            );
          case "paragraph":
            return (
              <BlockAnchor
                key={i}
                id={blockId}
                barkCode={barkCode}
                blockIndex={i}
                claimSnippet={block.text}
                label="paragraph"
                allowAskEvidence
              >
                <p>
                  <MentionText text={block.text} />
                </p>
              </BlockAnchor>
            );
          case "quote":
            return (
              <BlockAnchor
                key={i}
                id={blockId}
                barkCode={barkCode}
                blockIndex={i}
                claimSnippet={block.text}
                label="quote"
                allowAskEvidence
              >
                <blockquote>
                  <MentionText text={block.text} />
                  {block.attribution && (
                    <footer className="mt-2 font-sans text-xs not-italic text-muted-foreground">
                      — {block.attribution}
                    </footer>
                  )}
                </blockquote>
              </BlockAnchor>
            );
          case "list":
            return (
              <BlockAnchor
                key={i}
                id={blockId}
                barkCode={barkCode}
                blockIndex={i}
                claimSnippet={block.items.join("; ")}
                label="list"
                allowAskEvidence
              >
                <ul>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <MentionText text={item} />
                    </li>
                  ))}
                </ul>
              </BlockAnchor>
            );
          case "evidence": {
            const ev = evidenceById.get(block.evidenceId);
            const evidenceIndex = evidence.findIndex(
              (item) => item.id === block.evidenceId
            );
            const evHash =
              evidenceIndex >= 0
                ? evidencePermalinkHash(evidenceIndex)
                : blockId;
            return ev ? (
              <BlockAnchor
                key={i}
                id={evHash}
                barkCode={barkCode}
                label="evidence"
              >
                <EvidenceCard
                  evidence={ev}
                  barkCode={barkCode}
                  evidenceIndex={
                    evidenceIndex >= 0 ? evidenceIndex : undefined
                  }
                />
              </BlockAnchor>
            ) : null;
          }
          default:
            return null;
        }
      })}
    </ReadingProse>
  );
}
