import { countries } from "@/lib/countries";

/** Sentinel for worldwide / unscoped country filters (URL: ?country=ALL). */
export const COUNTRY_SCOPE_ALL = "ALL";

export function isCountryScopeAll(code: string): boolean {
  return code.trim().toUpperCase() === COUNTRY_SCOPE_ALL;
}

export function isValidCountryCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return countries.some((country) => country.code === normalized);
}

export function isValidCountryScope(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return isCountryScopeAll(normalized) || isValidCountryCode(normalized);
}

/** Sentence naming the active country scope, including the all-countries case. */
export function viewingFromLabel(code: string, countryLabel: string): string {
  return isCountryScopeAll(code)
    ? "Viewing from all countries"
    : `Viewing from ${countryLabel}`;
}
