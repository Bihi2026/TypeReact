"use client";

import { Scale } from "lucide-react";
import { useQuery } from "convex/react";
import { CaseCard } from "@/components/case-card";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/convex/_generated/api";
import { isCountryScopeAll } from "@/lib/country-scope";
import { toUiCase } from "@/lib/cases/query";

export function ExploreCases({
  selectedCountry,
  countryName,
}: {
  selectedCountry: string;
  countryName?: string;
}) {
  const worldwide = isCountryScopeAll(selectedCountry);
  const byCountry = useQuery(
    api.cases.listByCountry,
    worldwide ? "skip" : { country: selectedCountry }
  );
  const allCases = useQuery(api.cases.list, worldwide ? {} : "skip");
  const docs = worldwide ? allCases : byCountry;
  const data = docs ? docs.map(toUiCase) : null;

  if (data === null) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading cases">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title={
          worldwide
            ? "No cases yet"
            : `No cases in ${countryName ?? "this country"} yet`
        }
        description={
          worldwide
            ? "When accountability cases are opened, they will show up here."
            : `When accountability cases are opened from ${countryName ?? "your selected country"}, they will show up here.`
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.map((c) => (
        <CaseCard key={c.id} accountabilityCase={c} />
      ))}
    </div>
  );
}
