"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  Hash,
  Home,
  LayoutDashboard,
  PenLine,
  PenSquare,
  Scale,
  Search,
  Users,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMyWriterApplication } from "@/components/stories/writer-cta";
import { toUiBark } from "@/lib/barks/query";
import { toUiCase } from "@/lib/cases/query";
import { toUiStory } from "@/lib/stories/query";
import { creators, topics } from "@/lib/data";

const BARK_CODE_RE = /^(TR|BRK)-(\d{4})-(\d{3,5})$/i;

function normalizeBarkCode(raw: string): string | null {
  const match = raw.trim().toUpperCase().match(BARK_CODE_RE);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3].padStart(4, "0")}`;
}

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const barkCode = normalizeBarkCode(query);
  const barkDocs = useQuery(api.barks.listPublic, {});
  const publishedBarks = barkDocs ? barkDocs.map(toUiBark) : [];
  const lookupDoc = useQuery(
    api.barks.getByCode,
    open && barkCode ? { code: barkCode } : "skip"
  );
  const lookupBark = lookupDoc ? toUiBark(lookupDoc) : null;
  const caseDocs = useQuery(api.cases.list);
  const publishedCases = caseDocs ? caseDocs.map(toUiCase) : [];
  const storyDocs = useQuery(api.stories.listPublic);
  const publishedStories = storyDocs ? storyDocs.map((doc) => toUiStory(doc)) : [];
  const { loading: writerLoading, application } = useMyWriterApplication();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const barkItems = publishedBarks
    .filter((b) => b.code !== lookupBark?.code)
    .slice(0, 6);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Search TypeReact"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4.5" />
      </Button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-72 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:inline-flex"
        aria-label="Search TypeReact"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">
          Search reactions, cases, creators…
        </span>
        <kbd className="pointer-events-none hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
          Ctrl K
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title="Search TypeReact"
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search reactions, Reaction IDs (TR-…), cases, creators…"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {lookupBark ? (
              <CommandGroup heading="Reaction ID">
                <CommandItem
                  value={`${lookupBark.code} ${lookupBark.title} open reaction`}
                  onSelect={() => go(`/barks/${lookupBark.code}`)}
                >
                  <FileText />
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {lookupBark.code}
                    </span>
                    {lookupBark.title}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/")}>
                <Home /> Home
              </CommandItem>
              <CommandItem onSelect={() => go("/explore")}>
                <Compass /> Explore
              </CommandItem>
              <CommandItem onSelect={() => go("/create")}>
                <PenSquare /> Create Reaction
              </CommandItem>
              <CommandItem onSelect={() => go("/stories")}>
                <BookOpen /> Stories
              </CommandItem>
              <CommandItem onSelect={() => go("/learn")}>
                <GraduationCap /> Learning Center
              </CommandItem>
              {writerLoading ? null : application?.status === "approved" ? (
                <CommandItem onSelect={() => go("/stories/dashboard")}>
                  <LayoutDashboard /> Writer dashboard
                </CommandItem>
              ) : application ? null : (
                <CommandItem onSelect={() => go("/stories/apply")}>
                  <PenLine /> Become a Writer
                </CommandItem>
              )}
              <CommandItem onSelect={() => go("/search")}>
                <Search /> Advanced Search
              </CommandItem>
            </CommandGroup>
            {barkItems.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Reactions">
                  {barkItems.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={`${b.code} ${b.title}`}
                      keywords={[b.code]}
                      onSelect={() => go(`/barks/${b.code}`)}
                    >
                      <FileText />
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {b.code}
                        </span>
                        {b.title}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
            {publishedCases.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Accountability Cases">
                  {publishedCases.slice(0, 6).map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.code} ${c.title}`}
                      keywords={[c.code]}
                      onSelect={() => go(`/cases/${c.code}`)}
                    >
                      <Scale />
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {c.code}
                        </span>
                        {c.title}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
            {publishedStories.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Stories">
                  {publishedStories.slice(0, 6).map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.title}
                      onSelect={() => go(`/stories/${s.slug}`)}
                    >
                      <BookOpen />
                      <span className="truncate">{s.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
            <CommandSeparator />
            <CommandGroup heading="Creators">
              {creators.slice(0, 6).map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => go(`/creators/${c.handle}`)}
                >
                  <Users />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Topics">
              {topics.slice(0, 6).map((t) => (
                <CommandItem
                  key={t.slug}
                  value={t.name}
                  onSelect={() => go(`/topics/${t.slug}`)}
                >
                  <Hash />
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
