"use client";

import * as React from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bookmark, ExternalLink, FolderPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarkCard } from "@/components/bark-card";
import { CaseCard } from "@/components/case-card";
import { EmptyState } from "@/components/empty-state";
import { SaveSourceButton } from "@/components/sources/save-source-button";
import { SourceThumb } from "@/components/source-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiBark } from "@/lib/barks/query";
import { toUiCase } from "@/lib/cases/query";
import { platformMeta } from "@/lib/meta";
import type { Source, SourcePlatform } from "@/lib/types";

function SavedHeader({ total }: { total?: number }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bookmark className="size-5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          Saved
          {typeof total === "number" && total > 0 ? (
            <Badge variant="secondary">{total}</Badge>
          ) : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your personal research library — collections, notes, reactions, and
          cases.
        </p>
      </div>
    </div>
  );
}

function SavedSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-start gap-3">
        <div className="size-10 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TabCount({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 tabular-nums">
      {count}
    </Badge>
  );
}

function sourceFromSave(row: {
  _id: string;
  sourceUrl: string;
  sourceTitle: string;
  sourcePlatform: SourcePlatform;
  sourceCreatorName: string;
  sourceThumbnailUrl?: string;
  createdAt: number;
}): Source {
  return {
    id: row._id,
    platform: row.sourcePlatform,
    url: row.sourceUrl,
    title: row.sourceTitle,
    creatorId: "",
    publishedAt: new Date(row.createdAt).toISOString(),
    category: "",
    language: "en",
    barkCount: 0,
    replyChainCount: 0,
    caseCount: 0,
    engagement: 0,
    evidenceRating: 0,
    thumbnailUrl: row.sourceThumbnailUrl,
  };
}

type CollectionFilter = "all" | "uncategorized" | Id<"saveCollections">;

function SavedReactionsLibrary() {
  const { isAuthenticated } = useConvexAuth();
  const [filter, setFilter] = React.useState<CollectionFilter>("all");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const collections = useQuery(
    api.barks.listSaveCollections,
    isAuthenticated ? {} : "skip"
  );
  const libraryArgs =
    filter === "all"
      ? {}
      : filter === "uncategorized"
        ? { collectionId: null }
        : { collectionId: filter };
  const library = useQuery(
    api.barks.listMineSavedLibrary,
    isAuthenticated ? libraryArgs : "skip"
  );
  const createCollection = useMutation(api.barks.createSaveCollection);
  const deleteCollection = useMutation(api.barks.deleteSaveCollection);
  const updateSaveMeta = useMutation(api.barks.updateSaveMeta);

  if (collections === undefined || library === undefined) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-7 w-20 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const selectedCollection =
    filter !== "all" && filter !== "uncategorized"
      ? collections.find((c) => c._id === filter)
      : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "uncategorized" ? "default" : "outline"}
            onClick={() => setFilter("uncategorized")}
          >
            Uncategorized
          </Button>
          {collections.map((c) => (
            <Button
              key={c._id}
              type="button"
              size="sm"
              variant={filter === c._id ? "default" : "outline"}
              onClick={() => setFilter(c._id)}
            >
              {c.name}
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-5 px-1 tabular-nums"
              >
                {c.count}
              </Badge>
            </Button>
          ))}
          {!creating ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreating(true)}
            >
              <FolderPlus /> New collection
            </Button>
          ) : null}
          {selectedCollection ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete
            </Button>
          ) : null}
        </div>

        {creating ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              void (async () => {
                try {
                  const id = await createCollection({ name });
                  setNewName("");
                  setCreating(false);
                  setFilter(id);
                  toast.success("Collection created");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not create collection"
                  );
                }
              })();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              aria-label="New collection name"
              className="h-8 max-w-xs"
              autoFocus
            />
            <Button type="submit" size="sm">
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
            >
              Cancel
            </Button>
          </form>
        ) : null}
      </div>

      {library.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved reactions"
          description="Save a published reaction to keep it in your research library."
          action={
            <Button asChild size="sm">
              <Link href="/barks">Discover reactions</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {library.map((item) => {
            const bark = toUiBark(item.bark);
            return (
              <div key={item.saveId} className="space-y-2">
                <BarkCard bark={bark} />
                <div className="grid gap-3 rounded-xl border px-3 py-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Collection
                    </p>
                    <Select
                      value={item.collectionId ?? "none"}
                      onValueChange={(value) => {
                        void (async () => {
                          try {
                            await updateSaveMeta({
                              code: bark.code,
                              collectionId:
                                value === "none"
                                  ? null
                                  : (value as Id<"saveCollections">),
                            });
                            toast.success("Collection updated");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not update collection"
                            );
                          }
                        })();
                      }}
                    >
                      <SelectTrigger size="sm" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {collections.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Research note
                    </p>
                    <Textarea
                      key={`${item.saveId}-${item.note ?? ""}`}
                      defaultValue={item.note ?? ""}
                      placeholder="Why this matters…"
                      className="min-h-14 text-xs"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        const prev = (item.note ?? "").trim();
                        if (next === prev) return;
                        void (async () => {
                          try {
                            await updateSaveMeta({
                              code: bark.code,
                              note: next || null,
                            });
                            toast.success("Note saved");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not save note"
                            );
                          }
                        })();
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete collection?"
        description={
          selectedCollection
            ? `“${selectedCollection.name}” will be removed. Saved reactions stay in your library as uncategorized.`
            : undefined
        }
        confirmLabel="Delete collection"
        variant="destructive"
        onConfirm={async () => {
          if (filter === "all" || filter === "uncategorized") return;
          await deleteCollection({ collectionId: filter });
          setFilter("all");
          toast.success("Collection deleted");
        }}
      />
    </div>
  );
}

function SavedSignedIn() {
  const { isAuthenticated } = useConvexAuth();
  const barkDocs = useQuery(
    api.barks.listMineSaved,
    isAuthenticated ? {} : "skip"
  );
  const caseDocs = useQuery(
    api.cases.listMineSaved,
    isAuthenticated ? {} : "skip"
  );
  const sourceDocs = useQuery(
    api.saves.listMineSources,
    isAuthenticated ? {} : "skip"
  );

  if (
    !isAuthenticated ||
    barkDocs === undefined ||
    caseDocs === undefined ||
    sourceDocs === undefined
  ) {
    return <SavedSkeleton />;
  }

  const savedCases = caseDocs.map(toUiCase);
  const total = barkDocs.length + savedCases.length + sourceDocs.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <SavedHeader total={total} />
      <Tabs defaultValue="barks">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="barks" className="flex-none">
            Reactions
            <TabCount count={barkDocs.length} />
          </TabsTrigger>
          <TabsTrigger value="cases" className="flex-none">
            Cases
            <TabCount count={savedCases.length} />
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex-none">
            Sources
            <TabCount count={sourceDocs.length} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="barks" className="mt-4">
          <SavedReactionsLibrary />
        </TabsContent>
        <TabsContent value="cases" className="mt-4 space-y-3">
          {savedCases.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No saved cases"
              description="Save a published case to keep it in your research library."
              action={
                <Button asChild size="sm">
                  <Link href="/cases">Discover cases</Link>
                </Button>
              }
            />
          ) : (
            savedCases.map((c) => (
              <CaseCard key={c.id} accountabilityCase={c} />
            ))
          )}
        </TabsContent>
        <TabsContent value="sources" className="mt-4">
          {sourceDocs.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No saved sources"
              description="Save sources while browsing to build your research library."
              action={
                <Button asChild size="sm">
                  <Link href="/barks">Discover reactions</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y overflow-hidden rounded-xl border">
              {sourceDocs.map((row) => {
                const source = sourceFromSave(row);
                return (
                  <div
                    key={row._id}
                    className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                  >
                    <SourceThumb
                      source={source}
                      className="aspect-video w-full shrink-0 sm:w-28"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-snug">
                        {row.sourceTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {platformMeta[row.sourcePlatform].label}
                        {row.sourceCreatorName
                          ? ` · ${row.sourceCreatorName}`
                          : ""}
                      </p>
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open original{" "}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                    <SaveSourceButton
                      sourceUrl={row.sourceUrl}
                      sourceTitle={row.sourceTitle}
                      sourcePlatform={row.sourcePlatform}
                      sourceCreatorName={row.sourceCreatorName}
                      sourceThumbnailUrl={row.sourceThumbnailUrl}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SavedLibrary() {
  return (
    <>
      <Show when="signed-out">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          <SavedHeader />
          <EmptyState
            icon={Bookmark}
            title="Sign in to see saved items"
            description="Save reactions, cases, and sources while you research, then find them here."
            action={
              <SignInButton>
                <Button>Sign in</Button>
              </SignInButton>
            }
          />
        </div>
      </Show>
      <Show when="signed-in">
        <SavedSignedIn />
      </Show>
    </>
  );
}
