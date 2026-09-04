export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(iso: string): string {
  const then = new Date(iso);
  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  if (days < 7) return `${Math.round(days)}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Deterministic gradient class pair from an id, for avatar/thumbnail placeholders. */
const GRADIENTS = [
  "from-orange-500/80 to-red-700/80",
  "from-amber-500/80 to-orange-700/80",
  "from-violet-500/80 to-purple-800/80",
  "from-rose-500/80 to-red-800/80",
  "from-rose-500/80 to-red-800/80",
  "from-amber-600/80 to-orange-900/80",
  "from-fuchsia-500/80 to-pink-800/80",
  "from-yellow-600/80 to-amber-900/80",
];

export function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
