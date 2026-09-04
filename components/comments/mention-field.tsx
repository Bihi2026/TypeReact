"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { PersonAvatar } from "@/components/person-avatar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

function tokenAtCaret(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = before.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,32})$/);
  if (!match) return null;
  const prefix = match[2];
  const start = caret - prefix.length - 1;
  return { start, end: caret, prefix };
}

export type MentionFieldHandle = {
  insertAtCaret: (text: string) => void;
  wrapSelection: (prefix: string, suffix?: string, placeholder?: string) => void;
};

export const MentionField = React.forwardRef<
  MentionFieldHandle,
  {
    barkCode?: string;
    circleId?: Id<"researchCircles">;
    /** Default: creators/writers. `users` searches platform usernames for invites. */
    searchSource?: "mentions" | "users";
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
  }
>(function MentionField(
  {
    barkCode,
    circleId,
    searchSource = "mentions",
    value,
    onChange,
    placeholder,
    className,
    id,
  },
  ref
) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const token = tokenAtCaret(value, caret);
  const openToken = Boolean(token) && !dismissed;
  const mentionResults = useQuery(
    api.mentions.search,
    openToken && token && searchSource === "mentions"
      ? {
          prefix: token.prefix,
          ...(barkCode ? { barkCode } : {}),
          ...(circleId ? { circleId } : {}),
        }
      : "skip"
  );
  const userResults = useQuery(
    api.profiles.searchByUsername,
    openToken && token && searchSource === "users"
      ? { prefix: token.prefix }
      : "skip"
  );
  const hits = React.useMemo(() => {
    if (searchSource === "users") {
      return (userResults ?? []).map((row) => ({
        handle: row.username,
        name: row.name,
        kind: "member" as const,
      }));
    }
    return (mentionResults ?? []).map((row) => ({
      handle: row.handle,
      name: row.name,
      kind: row.kind,
    }));
  }, [searchSource, userResults, mentionResults]);
  const resultsLoading =
    searchSource === "users"
      ? userResults === undefined
      : mentionResults === undefined;
  const open = openToken && (resultsLoading || hits.length > 0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [token?.prefix, token?.start]);

  React.useEffect(() => {
    if (!token) setDismissed(false);
  }, [token]);

  const insert = (handle: string) => {
    if (!token) return;
    const next = `${value.slice(0, token.start)}@${handle} ${value.slice(token.end)}`;
    onChange(next);
    setDismissed(true);
    const pos = token.start + handle.length + 2;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const insertAtCaret = (text: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? caret;
    const end = el?.selectionEnd ?? caret;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const wrapSelection = (
    prefix: string,
    suffix = prefix,
    placeholder = "text"
  ) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? caret;
    const end = el?.selectionEnd ?? caret;
    const selected = value.slice(start, end) || placeholder;
    const next =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      node.setSelectionRange(cursor, cursor);
      setCaret(cursor);
    });
  };

  React.useImperativeHandle(
    ref,
    () => ({ insertAtCaret, wrapSelection }),
    [caret, value, onChange]
  );

  const syncCaret = () => {
    const el = textareaRef.current;
    if (el) setCaret(el.selectionStart ?? 0);
  };

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}
    >
      <PopoverAnchor asChild>
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          placeholder={placeholder}
          aria-label={id === "bark-body" ? "Reaction content" : "Write a reply"}
          aria-autocomplete="list"
          className={cn("min-h-20 resize-y", className)}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissed(false);
          }}
          onClick={syncCaret}
          onKeyUp={syncCaret}
          onSelect={syncCaret}
          onKeyDown={(e) => {
            if (!openToken || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              const hit = hits[activeIndex] ?? hits[0];
              if (hit) insert(hit.handle);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDismissed(true);
            }
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[min(100%,20rem)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ul role="listbox" className="max-h-56 overflow-y-auto">
          {resultsLoading ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Searching…
            </li>
          ) : (
            hits.map((hit, i) => (
            <li key={`${hit.kind}-${hit.handle}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  i === activeIndex && "bg-muted"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(hit.handle);
                }}
              >
                <PersonAvatar
                  id={hit.handle}
                  name={hit.name}
                  className="size-7"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{hit.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{hit.handle}
                    {hit.kind !== "member" ? ` · ${hit.kind}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
});

MentionField.displayName = "MentionField";
