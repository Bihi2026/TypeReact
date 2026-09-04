"use client";

import { MessageSquare } from "lucide-react";
import { usePaginatedQuery } from "convex/react";
import { BarkCard } from "@/components/bark-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { sortBarksByPublishedAt, toUiBark } from "@/lib/barks/query";
import type { Bark, BarkType } from "@/lib/types";

const types: { value: BarkType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "agree", label: "Agree" },
  { value: "disagree", label: "Disagree" },
  { value: "mixed", label: "Mixed" },
  { value: "unpack", label: "Unpack" },
];

const empty = (
  <EmptyState
    icon={MessageSquare}
    title="No published reactions yet"
    description="When someone publishes a reaction, it will show up here."
  />
);

export function BarksList({ initialBarks }: { initialBarks: Bark[] }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.barks.listPublicPage,
    {},
    { initialNumItems: 10 }
  );
  const data =
    status === "LoadingFirstPage" && results.length === 0
      ? initialBarks
      : results.map(toUiBark);
  const sorted = sortBarksByPublishedAt(data);

  return (
    <Tabs defaultValue="all">
      <TabsList className="w-full sm:w-auto">
        {types.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {types.map((t) => {
        const items =
          t.value === "all" ? sorted : sorted.filter((b) => b.type === t.value);
        return (
          <TabsContent key={t.value} value={t.value} className="mt-4 space-y-4">
            {items.length === 0 ? (
              empty
            ) : (
              <>
                <div className="space-y-3">
                  {items.map((b) => (
                    <BarkCard key={b.id} bark={b} compactActions />
                  ))}
                </div>
                {t.value === "all" && status !== "Exhausted" ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={status === "LoadingMore"}
                      onClick={() => loadMore(10)}
                    >
                      {status === "LoadingMore" ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
