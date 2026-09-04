import Link from "next/link";
import { CountrySelect } from "@/components/profile/country-select";

export function CountryScopeBar({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">Country</p>
        <p className="text-xs text-muted-foreground">
          Reactions and sources shown for your selected country
        </p>
        <Link
          href="/settings/country"
          className="inline-block text-xs text-primary hover:underline"
        >
          Set default in settings
        </Link>
      </div>
      <CountrySelect
        id={id}
        value={value}
        onChange={onChange}
        includeAll
        className="w-full border-border bg-background sm:w-52"
      />
    </div>
  );
}
