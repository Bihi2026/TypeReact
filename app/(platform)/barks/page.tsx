import type { Metadata } from "next";
import { listPublicBarks } from "@/app/actions/barks";
import { BarksList } from "@/components/barks/barks-list";
import { sortBarksByPublishedAt } from "@/lib/barks/query";

export const metadata: Metadata = {
  title: "Reactions",
};

export const dynamic = "force-dynamic";

export default async function BarksPage() {
  const barks = sortBarksByPublishedAt(await listPublicBarks());

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reactions</h1>
        <p className="text-sm text-muted-foreground">
          Evidence-based responses to public content, newest first.
        </p>
      </div>
      <BarksList initialBarks={barks} />
    </div>
  );
}
