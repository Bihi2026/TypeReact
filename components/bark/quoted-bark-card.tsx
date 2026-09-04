"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Quote } from "lucide-react";
import { BarkCode } from "@/components/bark-code";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { barkTypeMeta } from "@/lib/meta";
import type { BarkType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuotedBarkCard({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const preview = useQuery(api.barks.getQuotedPreview, { code });

  if (preview === undefined) {
    return (
      <Card className={cn("gap-0 p-4 text-sm text-muted-foreground", className)}>
        Loading quoted Reaction…
      </Card>
    );
  }

  if (preview === null) {
    return (
      <Card className={cn("gap-0 p-4 text-sm text-muted-foreground", className)}>
        Quoted Reaction {code} is unavailable.
      </Card>
    );
  }

  const typeMeta = barkTypeMeta[preview.type as BarkType];

  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <Link
        href={`/barks/${preview.code}`}
        className="block space-y-2 p-4 transition-colors hover:bg-muted/40"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Quote className="size-3.5" aria-hidden />
          <span>Quoting</span>
          <BarkCode code={preview.code} />
          {typeMeta ? (
            <Badge variant="secondary" className="text-[10px]">
              {typeMeta.label}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm font-semibold leading-snug">{preview.title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {preview.excerpt}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {preview.authorName}
          <span aria-hidden> · </span>
          Evidence {preview.evidenceRating}
        </p>
      </Link>
    </Card>
  );
}
