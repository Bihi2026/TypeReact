"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EvidenceCard } from "@/components/evidence-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { claimStatusMeta } from "@/lib/meta";
import type { Bark, BarkClaim, ClaimStatus } from "@/lib/types";

function ClaimMapView({ bark }: { bark: Bark }) {
  const claims = bark.claims ?? [];
  if (claims.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="size-5" aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight">Claim map</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Structured claim↔evidence links for scanning this Reaction as research.
      </p>
      <ul className="space-y-3">
        {claims.map((claim) => (
          <li key={claim.id}>
            <Card className="gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{claim.text}</p>
                <Badge
                  variant="outline"
                  className={claimStatusMeta[claim.status].badgeClass}
                >
                  {claimStatusMeta[claim.status].label}
                </Badge>
              </div>
              <div className="space-y-2">
                {claim.evidenceIndexes.map((idx) => {
                  const ev = bark.evidence[idx];
                  return ev ? (
                    <EvidenceCard
                      key={`${claim.id}-${idx}`}
                      evidence={ev}
                      barkCode={bark.live ? bark.code : undefined}
                      evidenceIndex={idx}
                    />
                  ) : null;
                })}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

type DraftClaim = {
  key: string;
  id?: string;
  text: string;
  status: ClaimStatus;
  evidenceIndexes: number[];
};

export function ClaimMapEditor({ bark }: { bark: Bark }) {
  const { userId } = useAuth();
  const setClaims = useMutation(api.barks.setClaims);
  const [open, setOpen] = React.useState(false);
  const [drafts, setDrafts] = React.useState<DraftClaim[]>(() =>
    (bark.claims ?? []).map((c, i) => ({
      key: c.id || `c${i}`,
      id: c.id,
      text: c.text,
      status: c.status,
      evidenceIndexes: c.evidenceIndexes,
    }))
  );
  const [saving, setSaving] = React.useState(false);

  if (!userId || userId !== bark.authorId || !bark.live) return null;

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {bark.claims && bark.claims.length > 0 ? "Edit claim map" : "Add claim map"}
      </Button>
    );
  }

  return (
    <Card className="gap-0 p-0">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Claim map</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Link claims to evidence already attached to this Reaction.
        </p>
        {bark.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Attach evidence first, then map claims to it.
          </p>
        ) : (
          <ul className="space-y-4">
            {drafts.map((draft, i) => (
              <li key={draft.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Claim {i + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={() =>
                      setDrafts((prev) => prev.filter((d) => d.key !== draft.key))
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Input
                  value={draft.text}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((d) =>
                        d.key === draft.key ? { ...d, text: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Checkable claim…"
                />
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDrafts((prev) =>
                      prev.map((d) =>
                        d.key === draft.key
                          ? { ...d, status: value as ClaimStatus }
                          : d
                      )
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(claimStatusMeta) as ClaimStatus[]).map(
                      (status) => (
                        <SelectItem key={status} value={status}>
                          {claimStatusMeta[status].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Linked evidence
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bark.evidence.map((ev, idx) => {
                      const checked = draft.evidenceIndexes.includes(idx);
                      return (
                        <Button
                          key={ev.id}
                          type="button"
                          size="sm"
                          variant={checked ? "secondary" : "outline"}
                          className="h-7 max-w-full truncate text-xs"
                          onClick={() =>
                            setDrafts((prev) =>
                              prev.map((d) => {
                                if (d.key !== draft.key) return d;
                                const next = checked
                                  ? d.evidenceIndexes.filter((n) => n !== idx)
                                  : [...d.evidenceIndexes, idx];
                                return { ...d, evidenceIndexes: next };
                              })
                            )
                          }
                        >
                          [{idx}] {ev.title}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bark.evidence.length === 0}
            onClick={() =>
              setDrafts((prev) => [
                ...prev,
                {
                  key: `new-${Date.now()}`,
                  text: "",
                  status: "unverified",
                  evidenceIndexes: bark.evidence.length > 0 ? [0] : [],
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Add claim
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  await setClaims({
                    code: bark.code,
                    claims: drafts.map((d) => ({
                      id: d.id,
                      text: d.text,
                      status: d.status,
                      evidenceIndexes: d.evidenceIndexes,
                    })),
                  });
                  toast.success("Claim map saved");
                  setOpen(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not save claim map"
                  );
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            {saving ? "Saving…" : "Save claim map"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ClaimMapSection({ bark }: { bark: Bark }) {
  return (
    <div className="space-y-3">
      <ClaimMapEditor bark={bark} />
      <ClaimMapView bark={bark} />
    </div>
  );
}
