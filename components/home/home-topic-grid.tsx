"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Hash,
  BriefcaseBusiness,
  Building2,
  CircleHelp,
  Factory,
  FileBarChart,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Lightbulb,
  Newspaper,
  Scale,
  Sprout,
  TrafficCone,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  HOME_DISCOVERY_TOPICS,
  HOME_TOPIC_PARAM,
  homeDiscoveryCounts,
  type HomeDiscoveryTopic,
} from "@/lib/home-discovery";
import type { Bark } from "@/lib/types";
import { cn } from "@/lib/utils";

export type HomeCaseTopic = {
  slug: string;
  name: string;
  group: "Conduct" | "Integrity" | "Behavior";
  caseCount: number;
  trending: boolean;
};

const TOPIC_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  news: Newspaper,
  ask: CircleHelp,
  problems: TriangleAlert,
  solutions: Wrench,
  ideas: Lightbulb,
  reports: FileBarChart,
  economy: Landmark,
  jobs: BriefcaseBusiness,
  business: Factory,
  government: Building2,
  "law-and-justice": Scale,
  health: HeartPulse,
  education: GraduationCap,
  housing: Home,
  infrastructure: TrafficCone,
  environment: Sprout,
  "people-life": Users,
};

const cardClass =
  "flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-card px-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md";

export function HomeTopicGrid({
  published,
  caseTopics,
}: {
  published: Bark[];
  caseTopics: HomeCaseTopic[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get(HOME_TOPIC_PARAM) ?? "";
  const counts = homeDiscoveryCounts(published);

  const onSelect = (topic: HomeDiscoveryTopic) => {
    if (topic.href) {
      router.push(topic.href);
      return;
    }
    const next = new URLSearchParams(params.toString());
    if (active === topic.slug) {
      next.delete(HOME_TOPIC_PARAM);
    } else {
      next.set(HOME_TOPIC_PARAM, topic.slug);
    }
    const query = next.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  };

  return (
    <section
      aria-labelledby="home-topics"
      className="min-w-0 border-b bg-background px-4 py-6 sm:px-6"
    >
      <div className="mb-4">
        <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-px w-8 bg-primary" aria-hidden />
          Browse
        </p>
        <h2 id="home-topics" className="text-lg font-semibold tracking-tight">
          Explore topics
        </h2>
        <p className="text-sm text-muted-foreground">
          Filter the feed by what you want to follow
        </p>
      </div>
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {HOME_DISCOVERY_TOPICS.map((topic) => {
          const Icon = TOPIC_ICONS[topic.slug] ?? Newspaper;
          const selected = active === topic.slug && !topic.href;
          const count = counts[topic.slug] ?? 0;
          return (
            <li key={topic.slug} className="w-[17rem] shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                onClick={() => onSelect(topic)}
                aria-pressed={selected}
                className={cn(
                  cardClass,
                  selected && "border-primary bg-primary/5 ring-2 ring-primary/20"
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    topic.iconBg,
                    topic.iconColor
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {topic.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground sm:text-xs">
                    {topic.hint}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            </li>
          );
        })}
        {caseTopics.map((topic) => (
          <li key={topic.slug} className="w-[17rem] shrink-0 snap-start sm:w-auto">
            <Link href={`/topics/${topic.slug}`} className={cardClass}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Hash className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold leading-tight">
                    {topic.name}
                  </span>
                  {topic.trending ? (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      Trending
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground sm:text-xs">
                  {topic.group}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {formatNumber(topic.caseCount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
