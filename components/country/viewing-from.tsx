import { countries } from "@/lib/countries";
import { isCountryScopeAll, viewingFromLabel } from "@/lib/country-scope";

export function ViewingFrom({ code }: { code: string }) {
  const normalized = code.trim().toUpperCase();
  if (isCountryScopeAll(normalized)) {
    return <span>{viewingFromLabel(normalized, "")}</span>;
  }

  const country = countries.find((item) => item.code === normalized);
  const name = country?.name ?? normalized;

  return (
    <span className="inline-flex items-center gap-1.5">
      Viewing from
      <img
        src={`https://flagcdn.com/w40/${normalized.toLowerCase()}.png`}
        alt=""
        width={20}
        height={15}
        className="inline-block h-3.5 w-5 rounded-[2px] object-cover"
      />
      {name}
    </span>
  );
}
