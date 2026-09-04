import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Hash, Scale } from "lucide-react";
import { BarkCard } from "@/components/bark-card";
import { CaseCard } from "@/components/case-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPublicBarksByTopic } from "@/app/actions/barks";
import { listCaseCategoryStats, listCasesByCategory } from "@/app/actions/cases";
import { caseCategoryMeta } from "@/lib/meta";
import { getTopic, isCaseCategory } from "@/lib/topics";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/topics/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = getTopic(slug);
  return { title: topic ? `${topic.name} — Topic` : "Topic not found" };
}

export default async function TopicPage(props: PageProps<"/topics/[slug]">) {
  const { slug } = await props.params;
  const topic = getTopic(slug);
  if (!topic || !isCaseCategory(slug)) notFound();

  const [topicCases, topicBarks, stats] = await Promise.all([
    listCasesByCategory(slug),
    listPublicBarksByTopic(slug),
    listCaseCategoryStats(),
  ]);
  const caseCount =
    stats.find((row) => row.slug === slug)?.caseCount ?? topicCases.length;
  const group = caseCategoryMeta[slug].group;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Hash className="size-6 text-primary" aria-hidden />
            {topic.name}
            {caseCount > 0 && <Badge variant="secondary">Active</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {topic.description}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(topicBarks.length)} reactions ·{" "}
            {formatNumber(caseCount)} accountability cases
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/circles?topic=${encodeURIComponent(slug)}`}>
              Start research circle
            </Link>
          </Button>
          <Button>Follow topic</Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Cases</h2>
        {topicCases.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No cases in this category yet"
            description="Open an accountability case to start a public, evidence-based record."
          />
        ) : (
          topicCases.map((c) => (
            <CaseCard key={c.id} accountabilityCase={c} />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Reactions</h2>
        {topicBarks.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reactions in this topic yet"
            description="Start the first evidence-based discussion in this topic."
          />
        ) : (
          topicBarks.map((b) => <BarkCard key={b.id} bark={b} />)
        )}
      </section>
    </div>
  );
}
