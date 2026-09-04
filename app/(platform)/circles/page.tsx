import { Suspense } from "react";
import type { Metadata } from "next";
import { CirclesLibrary } from "@/components/circles/circles-library";

export const metadata: Metadata = {
  title: "Research Circles",
};

export default function CirclesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
      <CirclesLibrary />
    </Suspense>
  );
}
