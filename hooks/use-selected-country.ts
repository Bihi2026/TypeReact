"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { countries } from "@/lib/countries";
import {
  COUNTRY_SCOPE_ALL,
  isValidCountryCode,
  isValidCountryScope,
} from "@/lib/country-scope";
import { defaultUserSettings } from "@/lib/user-settings";

export function useSelectedCountry(basePath: "/" | "/explore") {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const settings = useQuery(
    api.userSettings.getMine,
    isAuthenticated ? {} : "skip"
  );

  const urlCountry = params.get("country")?.trim().toUpperCase() ?? "";
  const settingsCountry = settings?.country?.trim().toUpperCase() ?? "";

  const [selectedCountry, setSelectedCountry] = React.useState(
    COUNTRY_SCOPE_ALL
  );
  const [isCountryRefreshing, setIsCountryRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (urlCountry && isValidCountryScope(urlCountry)) {
      setSelectedCountry(urlCountry);
      return;
    }
    if (isLoading) return;
    if (isAuthenticated) {
      if (settings === undefined) return;
      setSelectedCountry(
        settingsCountry && isValidCountryCode(settingsCountry)
          ? settingsCountry
          : defaultUserSettings.country
      );
      return;
    }
    setSelectedCountry(COUNTRY_SCOPE_ALL);
  }, [
    urlCountry,
    settingsCountry,
    isAuthenticated,
    isLoading,
    settings,
  ]);

  React.useEffect(() => {
    if (!isCountryRefreshing) return;
    const timer = setTimeout(() => setIsCountryRefreshing(false), 200);
    return () => clearTimeout(timer);
  }, [selectedCountry, isCountryRefreshing]);

  const handleCountryChange = (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!isValidCountryScope(normalized)) return;
    if (normalized === selectedCountry) return;
    setIsCountryRefreshing(true);
    setSelectedCountry(normalized);

    const next = new URLSearchParams(params.toString());
    next.set("country", normalized);
    const query = next.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  };

  const countryMeta = countries.find((c) => c.code === selectedCountry);
  const countryLabel = countryMeta
    ? `${countryMeta.flag} ${countryMeta.name}`
    : selectedCountry === COUNTRY_SCOPE_ALL
      ? "All countries"
      : selectedCountry;

  return {
    selectedCountry,
    countryMeta,
    countryLabel,
    isCountryRefreshing,
    handleCountryChange,
  };
}
