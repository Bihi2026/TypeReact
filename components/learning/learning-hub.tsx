"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LearningArticle } from "@/components/learning/learning-article";
import { LearningDownload } from "@/components/learning/learning-download";
import { LearningResourceCard } from "@/components/learning/learning-resource-card";
import { LearningVideoPlayer } from "@/components/learning/learning-video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  learningCategories,
  learningCategoryLabel,
  learningTypeMeta,
} from "@/lib/learning/catalog";
import { toUiLearningResource } from "@/lib/learning/query";
import type { LearningCategory, LearningResourceType } from "@/lib/types";

const typeFilters: Array<{ id: "all" | LearningResourceType; label: string }> =
  [
    { id: "all", label: "All" },
    { id: "video", label: "Videos" },
    { id: "article", label: "Articles" },
    { id: "download", label: "Downloads" },
  ];

export function LearningHubSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex items-start gap-3">
        <div className="size-10 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function LearningDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-3/4 max-w-md animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function LearningHub() {
  const docs = useQuery(api.learning.listPublished);
  const resources = React.useMemo(
    () => (docs ?? []).map(toUiLearningResource),
    [docs]
  );
  const [category, setCategory] =
    React.useState<LearningCategory>("getting-started");
  const [typeFilter, setTypeFilter] = React.useState<
    "all" | LearningResourceType
  >("all");

  const activeCategory = learningCategories.find((c) => c.id === category);
  const filtered = resources.filter((r) => {
    if (r.category !== category) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  if (docs === undefined) {
    return <LearningHubSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <GraduationCap className="size-5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            Learning Center
            {resources.length > 0 ? (
              <Badge variant="secondary">{resources.length}</Badge>
            ) : null}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Watch tutorials, read guides, and download checklists to get the
            most out of TypeReact — from your first reaction to opening an
            accountability case.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {learningCategories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={category === cat.id ? "default" : "outline"}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
        {activeCategory ? (
          <p className="text-sm text-muted-foreground">
            {activeCategory.description}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Resources
            <Badge variant="secondary" className="tabular-nums">
              {filtered.length}
              {typeFilter === "all"
                ? ` in ${activeCategory?.label ?? "category"}`
                : ""}
            </Badge>
          </h2>
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => (
              <Badge
                key={filter.id}
                variant={typeFilter === filter.id ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setTypeFilter(filter.id)}
              >
                {filter.label}
              </Badge>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No resources in this category yet"
            description="Check back soon — we're adding guides and tutorials regularly."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((resource) => (
              <LearningResourceCard
                key={resource.id}
                resource={resource}
                showCategory={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LearningResourceDetail({ slug }: { slug: string }) {
  const doc = useQuery(api.learning.getBySlug, { slug });
  const allDocs = useQuery(api.learning.listPublished);
  const resource = doc ? toUiLearningResource(doc) : null;
  const related = React.useMemo(() => {
    if (!resource || !allDocs) return [];
    return allDocs
      .map(toUiLearningResource)
      .filter(
        (r) => r.category === resource.category && r.slug !== resource.slug
      )
      .slice(0, 3);
  }, [allDocs, resource]);

  if (doc === undefined) {
    return <LearningDetailSkeleton />;
  }

  if (!resource) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Resource not found"
        description="This guide may have been removed or is not published yet."
        action={
          <Button asChild variant="outline">
            <Link href="/learn">Back to Learning Center</Link>
          </Button>
        }
      />
    );
  }

  const typeMeta = learningTypeMeta[resource.type];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/learn">
            <ArrowLeft className="size-4" aria-hidden />
            Learning Center
          </Link>
        </Button>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{typeMeta.label}</Badge>
            <Badge variant="outline">
              {learningCategoryLabel(resource.category)}
            </Badge>
            {resource.durationMinutes ? (
              <Badge variant="outline">{resource.durationMinutes} min</Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {resource.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {resource.description}
          </p>
        </div>
      </div>

      {resource.type === "video" ? (
        <LearningVideoPlayer resource={resource} />
      ) : null}
      {resource.type === "article" && resource.contentBlocks?.length ? (
        <LearningArticle blocks={resource.contentBlocks} />
      ) : null}
      {resource.type === "download" ? (
        <LearningDownload resource={resource} />
      ) : null}

      {related.length > 0 ? (
        <section className="space-y-4 border-t pt-8">
          <h2 className="text-lg font-semibold">
            More in {learningCategoryLabel(resource.category)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <LearningResourceCard
                key={item.id}
                resource={item}
                showCategory
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
