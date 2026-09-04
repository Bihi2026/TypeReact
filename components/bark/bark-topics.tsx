"use client";

import { Hash, Plus, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { caseCategoryMeta } from "@/lib/meta";
import { getTopic } from "@/lib/topics";
import type { CaseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_TOPICS = 5;

const ALL_TOPICS = Object.keys(caseCategoryMeta) as CaseCategory[];

const GROUPS: Array<"Conduct" | "Integrity" | "Behavior"> = [
  "Conduct",
  "Integrity",
  "Behavior",
];

export function TopicChips({
  topics,
  onRemove,
  className,
}: {
  topics: CaseCategory[];
  onRemove?: (topic: CaseCategory) => void;
  className?: string;
}) {
  if (topics.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {topics.map((slug) => {
        const topic = getTopic(slug);
        const label = topic?.name ?? caseCategoryMeta[slug]?.label ?? slug;
        return (
          <Badge
            key={slug}
            variant="secondary"
            className="gap-1 font-normal"
            asChild={!onRemove}
          >
            {onRemove ? (
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3 opacity-70" aria-hidden />
                <Link
                  href={`/topics/${slug}`}
                  className="hover:underline"
                >
                  {label}
                </Link>
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label={`Remove ${label}`}
                  onClick={() => onRemove(slug)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <Link href={`/topics/${slug}`} className="inline-flex items-center gap-1">
                <Hash className="size-3 opacity-70" aria-hidden />
                {label}
              </Link>
            )}
          </Badge>
        );
      })}
    </div>
  );
}

export function TopicPickerMenu({
  selected,
  onChange,
  disabled,
}: {
  selected: CaseCategory[];
  onChange: (next: CaseCategory[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const remaining = ALL_TOPICS.filter((t) => !selected.includes(t));
  const atCap = selected.length >= MAX_TOPICS;

  const add = (topic: CaseCategory) => {
    if (selected.includes(topic) || atCap) return;
    onChange([...selected, topic]);
    if (selected.length + 1 >= MAX_TOPICS) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || atCap || remaining.length === 0}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="size-3.5" />
          Add topic
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-1.5 pb-2 text-xs text-muted-foreground">
          Up to {MAX_TOPICS} topics · {selected.length} selected
        </p>
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {GROUPS.map((group) => {
            const items = remaining.filter(
              (slug) => caseCategoryMeta[slug].group === group
            );
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {items.map((slug) => (
                    <li key={slug}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => add(slug)}
                      >
                        <Hash className="size-3.5 shrink-0 text-primary" />
                        <span className="leading-snug">
                          {caseCategoryMeta[slug].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopicPicker({
  value,
  onChange,
  className,
}: {
  value: CaseCategory[];
  onChange: (next: CaseCategory[]) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <TopicChips
          topics={value}
          onRemove={(topic) => onChange(value.filter((t) => t !== topic))}
        />
        <TopicPickerMenu selected={value} onChange={onChange} />
      </div>
      <p className="text-xs text-muted-foreground">
        Tag topics so people can find this reaction from topic pages.
      </p>
    </div>
  );
}

export function BarkTopics({
  code,
  initialTopics,
  authorClerkId,
  live,
}: {
  code: string;
  initialTopics: string[];
  authorClerkId: string;
  live?: boolean;
}) {
  const { user } = useUser();
  const isAuthor = Boolean(user?.id && user.id === authorClerkId);
  const canEdit = Boolean(live && isAuthor);
  const liveDoc = useQuery(api.barks.getByCode, canEdit ? { code } : "skip");
  const setTopics = useMutation(api.barks.setTopics);
  const [saving, setSaving] = React.useState(false);

  const topics = (
    (liveDoc?.topics ?? initialTopics) as CaseCategory[]
  ).filter((t): t is CaseCategory => t in caseCategoryMeta);

  const save = async (next: CaseCategory[]) => {
    setSaving(true);
    try {
      await setTopics({ code, topics: next });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update topics"
      );
    } finally {
      setSaving(false);
    }
  };

  if (topics.length === 0 && !canEdit) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TopicChips
        topics={topics}
        onRemove={
          canEdit
            ? (topic) => void save(topics.filter((t) => t !== topic))
            : undefined
        }
      />
      {canEdit ? (
        <TopicPickerMenu
          selected={topics}
          onChange={(next) => void save(next)}
          disabled={saving}
        />
      ) : null}
    </div>
  );
}
