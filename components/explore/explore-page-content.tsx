"use client";

import Link from "next/link";
import { ExploreBarks } from "@/components/barks/explore-barks";
import { ExploreCases } from "@/components/cases/explore-cases";
import { CountryScopeBar } from "@/components/country/country-scope-bar";
import { ExploreSources } from "@/components/sources/explore-sources";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useSelectedCountry } from "@/hooks/use-selected-country";
import { topics } from "@/lib/data";
import type { Bark, Source } from "@/lib/types";

export function ExplorePageContent({
  initialBarks,
  initialSources,
}: {
  initialBarks: Bark[];
  initialSources: Source[];
}) {
  const {
    selectedCountry,
    countryMeta,
    countryLabel,
    handleCountryChange,
  } = useSelectedCountry("/explore");

  return (
    <div className="min-w-0 flex-1 space-y-6 px-4 py-8 lg:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Discover what the world is analyzing right now.
        </p>
      </div>

      <CountryScopeBar
        id="explore-country"
        value={selectedCountry}
        onChange={handleCountryChange}
      />

      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <Link key={t.slug} href={`/topics/${t.slug}`}>
            <Badge
              variant={t.trending ? "default" : "secondary"}
              className="cursor-pointer"
            >
              {t.name}
            </Badge>
          </Link>
        ))}
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="barks">Reactions</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
        </TabsList>
        <TabsContent value="sources" className="mt-4">
          <ExploreSources
            key={selectedCountry}
            initialBarks={initialBarks}
            initialSources={initialSources}
            selectedCountry={selectedCountry}
            countryLabel={countryLabel}
            countryName={countryMeta?.name}
          />
        </TabsContent>
        <TabsContent value="barks" className="mt-4">
          <ExploreBarks
            key={selectedCountry}
            initialBarks={initialBarks}
            selectedCountry={selectedCountry}
            countryName={countryMeta?.name}
          />
        </TabsContent>
        <TabsContent value="cases" className="mt-4">
          <ExploreCases
            key={selectedCountry}
            selectedCountry={selectedCountry}
            countryName={countryMeta?.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
