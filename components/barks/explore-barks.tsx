"use client";

import { MessageSquare } from "lucide-react";
import { useQuery } from "convex/react";
import { BarkCard } from "@/components/bark-card";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/convex/_generated/api";
import { isCountryScopeAll } from "@/lib/country-scope";
import { barksForCountry } from "@/lib/sources/under-discussion";
import { sortBarksByViews, toUiBark } from "@/lib/barks/query";
import type { Bark } from "@/lib/types";

export function ExploreBarks({
  initialBarks,
  selectedCountry,
  countryName,
}: {
  initialBarks: Bark[];
  selectedCountry: string;
  countryName?: string;
}) {
  const docs = useQuery(api.barks.listPublic, {});
  const data = docs ? docs.map(toUiBark) : initialBarks;
  const filtered = barksForCountry(data, selectedCountry);
  const trending = sortBarksByViews(filtered);
  const worldwide = isCountryScopeAll(selectedCountry);

  if (trending.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={
          worldwide
            ? "No reactions yet"
            : `No reactions in ${countryName ?? "this country"} yet`
        }
        description={
          worldwide
            ? "When reactions are published, they will show up here."
            : `When reactions from ${countryName ?? "your selected country"} are published, they will show up here.`
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {trending.map((b) => (
        <BarkCard key={b.id} bark={b} />
      ))}
    </div>
  );
}
