"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

export function CaseVisitDigestBanner({ code }: { code: string }) {
  const { isSignedIn } = useAuth();
  const digest = useQuery(
    api.cases.getVisitDigest,
    isSignedIn ? { code } : "skip"
  );
  const markVisited = useMutation(api.cases.markCaseVisited);
  const [dismissed, setDismissed] = React.useState(false);
  const marked = React.useRef(false);

  React.useEffect(() => {
    if (!isSignedIn || !digest || marked.current) return;
    const t = window.setTimeout(() => {
      marked.current = true;
      void markVisited({ code });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [isSignedIn, digest, code, markVisited]);

  if (
    !isSignedIn ||
    !digest ||
    dismissed ||
    digest.lastVisitedAt === null ||
    digest.highlights.length === 0
  ) {
    return null;
  }

  return (
    <Card className="gap-0 border-primary/20 bg-primary/5 p-0">
      <div className="flex items-start gap-3 p-4">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">Since you last visited</p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {digest.highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
