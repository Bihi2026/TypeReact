"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { History, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BarkTypeBadge } from "@/components/bark-type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toUiBark } from "@/lib/barks/query";
import { formatDate, formatNumber } from "@/lib/format";
import type { Bark } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BarkVersionHistory({ code }: { code: string }) {
  const versions = useQuery(api.barks.listVersions, { code });
  if (!versions || versions.length === 0) return null;
  return (
    <Card className="gap-0 p-0">
      <div className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" aria-hidden />
          Version history
        </h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.version}
              className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
            >
              <p className="font-medium">
                v{v.version} · {formatDate(new Date(v.createdAt).toISOString())}
              </p>
              <p className="text-muted-foreground">{v.changeNote}</p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function AmendReactionForm({
  bark,
}: {
  bark: Bark;
}) {
  const { userId } = useAuth();
  const amend = useMutation(api.barks.amend);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(bark.title);
  const [body, setBody] = React.useState(
    bark.content
      .map((block) => {
        if (block.kind === "heading") return `## ${block.text}`;
        if (block.kind === "quote")
          return `> ${block.text}${block.attribution ? ` — ${block.attribution}` : ""}`;
        if (block.kind === "list") return block.items.map((i) => `- ${i}`).join("\n");
        if (block.kind === "evidence") {
          const idx = block.evidenceId.replace(`${bark.code}-ev-`, "");
          return `[[ev:${idx}]]`;
        }
        return block.text;
      })
      .join("\n\n")
  );
  const [changeNote, setChangeNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!userId || userId !== bark.authorId || bark.status === "draft") {
    return null;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Amend reaction
      </Button>
    );
  }

  return (
    <Card className="gap-0 p-0">
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setSaving(true);
            try {
              await amend({
                code: bark.code,
                title,
                body,
                changeNote,
              });
              toast.success("Amendment published");
              setOpen(false);
              setChangeNote("");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not amend"
              );
            } finally {
              setSaving(false);
            }
          })();
        }}
      >
        <h2 className="text-sm font-semibold">Publish amendment (v{(bark.version ?? 1) + 1})</h2>
        <div className="space-y-1.5">
          <Label htmlFor="amend-title">Title</Label>
          <Input
            id="amend-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amend-body">Body</Label>
          <Textarea
            id="amend-body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amend-note">What changed</Label>
          <Input
            id="amend-note"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Corrected citation / clarified claim…"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Publishing…" : "Publish amendment"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SourceDebateGraph({
  sourceUrl,
  excludeCode,
}: {
  sourceUrl?: string;
  excludeCode: string;
}) {
  const data = useQuery(
    api.barks.listRelatedBySource,
    sourceUrl ? { sourceUrl, excludeCode } : "skip"
  );
  if (!sourceUrl || !data || data.total === 0) return null;
  const related = data.related.map(toUiBark);
  const total = data.total;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <Card className="gap-0 p-0">
      <div className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Source debate</h2>
          <p className="text-xs text-muted-foreground">
            {formatNumber(total)} other reactions on this source
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(
            [
              ["agree", data.byType.agree],
              ["disagree", data.byType.disagree],
              ["mixed", data.byType.mixed],
              ["unpack", data.byType.unpack],
            ] as const
          ).map(([type, count]) => (
            <div
              key={type}
              className="rounded-md border bg-muted/30 px-2 py-1.5"
            >
              <BarkTypeBadge type={type} />
              <p className="mt-1 tabular-nums text-muted-foreground">
                {count} · {pct(count)}%
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {related.slice(0, 4).map((b) => (
            <Link
              key={b.id}
              href={`/barks/${b.code}`}
              className="block rounded-md border px-3 py-2 text-sm hover:border-primary/40"
            >
              <span className="font-medium line-clamp-1">{b.title}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {b.code} · {b.type}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PromoteToCaseButton({ bark }: { bark: Bark }) {
  const { userId } = useAuth();
  const promote = useMutation(api.barks.promoteToCase);
  const [busy, setBusy] = React.useState(false);
  if (!userId || userId !== bark.authorId) return null;
  if (bark.promotedCaseCode) {
    return (
      <Button asChild size="sm" variant="secondary">
        <Link href={`/cases/${bark.promotedCaseCode}`}>
          Open case {bark.promotedCaseCode}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy || bark.evidence.length === 0}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const result = await promote({ code: bark.code });
            toast.success(`Case ${result.caseCode} opened`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not promote"
            );
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      {busy ? "Promoting…" : "Promote to case"}
    </Button>
  );
}

export function EvidenceVoteControls({
  code,
  evidenceIndex,
  className,
}: {
  code: string;
  evidenceIndex: number;
  className?: string;
}) {
  const { isSignedIn } = useAuth();
  const state = useQuery(api.barks.evidenceVoteState, { code });
  const vote = useMutation(api.barks.voteEvidence);
  const row = state?.find((s) => s.evidenceIndex === evidenceIndex);
  const myVote = row?.myVote ?? null;

  const cast = async (next: "attest" | "challenge" | "clear") => {
    if (!isSignedIn) {
      toast.message("Sign in to attest or challenge evidence");
      return;
    }
    try {
      await vote({
        code,
        evidenceIndex,
        vote: next === myVote ? "clear" : next,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not vote");
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Button
        type="button"
        size="sm"
        variant={myVote === "attest" ? "secondary" : "outline"}
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={() => void cast("attest")}
      >
        <ShieldCheck className="size-3" />
        Attest {formatNumber(row?.attestCount ?? 0)}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={myVote === "challenge" ? "secondary" : "outline"}
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={() => void cast("challenge")}
      >
        <ShieldAlert className="size-3" />
        Challenge {formatNumber(row?.challengeCount ?? 0)}
      </Button>
    </div>
  );
}
