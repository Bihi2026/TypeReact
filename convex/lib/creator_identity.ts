import type { Doc } from "../_generated/dataModel";

const RESERVED_PATH_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "watch",
  "video",
  "videos",
  "channel",
  "c",
  "user",
  "profile.php",
  "people",
  "pages",
  "i",
  "home",
  "search",
  "status",
  "embed",
  "shorts",
  "live",
  "share",
  "playlist",
]);

export function normalizeCreatorKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePublicUrl(raw: string): URL | null {
  try {
    const trimmed = raw.trim();
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname.includes(".")) return null;
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return parsed;
  } catch {
    return null;
  }
}

function atHandleFromPath(url: URL): string | null {
  for (const part of url.pathname.split("/").filter(Boolean)) {
    if (part.startsWith("@")) {
      return part.slice(1).toLowerCase();
    }
  }
  return null;
}

function firstPathSegment(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const segment = parts[0].toLowerCase();
  if (RESERVED_PATH_SEGMENTS.has(segment)) return null;
  return segment;
}

function xHandle(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const statusIndex = parts.indexOf("status");
  if (statusIndex > 0) {
    const handle = parts[statusIndex - 1];
    if (handle && handle !== "i") return handle.toLowerCase();
  }
  if (
    parts.length === 1 &&
    parts[0] !== "i" &&
    parts[0] !== "home" &&
    parts[0] !== "search"
  ) {
    return parts[0].toLowerCase();
  }
  return null;
}

function youtubeHandle(url: URL): string | null {
  const fromAt = atHandleFromPath(url);
  if (fromAt) return fromAt;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "c" && parts[1]) return parts[1].toLowerCase();
  if (parts[0] === "user" && parts[1]) return parts[1].toLowerCase();
  return null;
}

function instagramHandle(url: URL): string | null {
  const fromAt = atHandleFromPath(url);
  if (fromAt) return fromAt;
  return firstPathSegment(url);
}

function facebookHandle(url: URL): string | null {
  const fromAt = atHandleFromPath(url);
  if (fromAt) return fromAt;
  return firstPathSegment(url);
}

function tiktokHandle(url: URL): string | null {
  const fromAt = atHandleFromPath(url);
  if (fromAt) return fromAt;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "@" && parts[1]) return parts[1].toLowerCase();
  return firstPathSegment(url);
}

function platformHandleFromUrl(url: URL, platform: string): string | null {
  if (platform === "x") return xHandle(url);
  if (platform === "youtube") return youtubeHandle(url);
  if (platform === "instagram") return instagramHandle(url);
  if (platform === "facebook") return facebookHandle(url);
  if (platform === "tiktok") return tiktokHandle(url);
  return atHandleFromPath(url) ?? firstPathSegment(url);
}

export function resolveExternalIdentityFromLink(
  url: string,
  platform: string,
  authorName?: string
): { platform: string; externalHandle: string } | null {
  const parsed = parsePublicUrl(url);
  let externalHandle = "";
  if (parsed) {
    const fromUrl = platformHandleFromUrl(parsed, platform);
    if (fromUrl) externalHandle = normalizeCreatorKey(fromUrl);
  }
  if (!externalHandle && authorName?.trim()) {
    externalHandle = normalizeCreatorKey(authorName);
  }
  if (!externalHandle) return null;
  return { platform, externalHandle };
}

export function resolveHandleFromLink(
  url: string,
  platform: string
): string | null {
  const identity = resolveExternalIdentityFromLink(url, platform);
  return identity?.externalHandle ?? null;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function urlsReferToSameChannel(a: string, b: string): boolean {
  const urlA = parsePublicUrl(a);
  const urlB = parsePublicUrl(b);
  if (!urlA || !urlB) return false;

  const hostA = urlA.hostname.replace(/^www\./, "");
  const hostB = urlB.hostname.replace(/^www\./, "");
  if (hostA !== hostB) return false;

  const pathA = normalizePath(urlA.pathname);
  const pathB = normalizePath(urlB.pathname);
  if (pathA === pathB) return true;

  for (const platform of [
    "youtube",
    "tiktok",
    "instagram",
    "facebook",
    "x",
  ] as const) {
    const handleA = platformHandleFromUrl(urlA, platform);
    const handleB = platformHandleFromUrl(urlB, platform);
    if (
      handleA &&
      handleB &&
      normalizeCreatorKey(handleA) === normalizeCreatorKey(handleB)
    ) {
      return true;
    }
  }

  return false;
}

export function applicantMatchesCreatorIdentity(
  stub: Pick<
    Doc<"creators">,
    "externalPlatform" | "externalHandle" | "officialLinks" | "name"
  >,
  platforms: string[],
  officialLinks: { url: string }[]
): boolean {
  if (!stub.externalPlatform || !stub.externalHandle) return false;
  const expectedHandle = normalizeCreatorKey(stub.externalHandle);
  const expectedPlatform = stub.externalPlatform;
  const expectedName = normalizeCreatorKey(stub.name);

  for (const link of officialLinks) {
    if (!link.url.trim()) continue;

    for (const stubLink of stub.officialLinks) {
      if (urlsReferToSameChannel(link.url, stubLink.url)) return true;
    }

    for (const platform of platforms) {
      const identity = resolveExternalIdentityFromLink(link.url, platform);
      if (!identity) continue;

      if (
        identity.platform === expectedPlatform &&
        normalizeCreatorKey(identity.externalHandle) === expectedHandle
      ) {
        return true;
      }

      if (
        platform === expectedPlatform &&
        normalizeCreatorKey(identity.externalHandle) === expectedName
      ) {
        return true;
      }
    }
  }
  return false;
}
