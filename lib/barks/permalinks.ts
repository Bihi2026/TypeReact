/** Fragment ids for deep links into a Reaction body. */

export function evidencePermalinkHash(index: number): string {
  return `ev-${index + 1}`;
}

export function blockPermalinkHash(index: number): string {
  return `block-${index + 1}`;
}

export function withPermalinkHash(pathOrUrl: string, hash: string): string {
  const clean = hash.replace(/^#/, "");
  if (!clean) return pathOrUrl;
  const base = pathOrUrl.split("#")[0] ?? pathOrUrl;
  return `${base}#${clean}`;
}
