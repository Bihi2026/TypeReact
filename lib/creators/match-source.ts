import {
  facebookPhotoId,
  facebookReelId,
  parsePublicUrl,
  platformFromHost,
  tiktokVideoId,
  xHandle,
  xStatusId,
  youtubeVideoId,
} from "@/lib/detect-source";
import type { Creator, SourcePlatform } from "@/lib/types";

export function normalizeCreatorKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function atHandleFromPath(url: URL): string | null {
  for (const part of url.pathname.split("/").filter(Boolean)) {
    if (part.startsWith("@")) {
      return part.slice(1).toLowerCase();
    }
  }
  return null;
}

export function platformHandleFromUrl(
  url: URL,
  platform: SourcePlatform
): string | null {
  if (platform === "x") {
    const fromStatus = xHandle(url);
    if (fromStatus) return fromStatus.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
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

  if (
    platform === "youtube" ||
    platform === "tiktok" ||
    platform === "instagram" ||
    platform === "facebook"
  ) {
    if (platform === "youtube") {
      const fromAt = atHandleFromPath(url);
      if (fromAt) return fromAt;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "c" && parts[1]) return parts[1].toLowerCase();
      if (parts[0] === "user" && parts[1]) return parts[1].toLowerCase();
      return null;
    }
    if (platform === "instagram" || platform === "facebook") {
      const fromAt = atHandleFromPath(url);
      if (fromAt) return fromAt;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 1) return parts[0].toLowerCase();
      return null;
    }
    return atHandleFromPath(url);
  }

  return atHandleFromPath(url);
}

function urlsShareContentIdentity(a: URL, b: URL): boolean {
  const ytA = youtubeVideoId(a);
  const ytB = youtubeVideoId(b);
  if (ytA && ytB) return ytA === ytB;

  const statusA = xStatusId(a);
  const statusB = xStatusId(b);
  if (statusA && statusB) return statusA === statusB;

  const tiktokA = tiktokVideoId(a);
  const tiktokB = tiktokVideoId(b);
  if (tiktokA && tiktokB) return tiktokA === tiktokB;

  const photoA = facebookPhotoId(a);
  const photoB = facebookPhotoId(b);
  if (photoA && photoB) return photoA === photoB;

  const reelA = facebookReelId(a);
  const reelB = facebookReelId(b);
  if (reelA && reelB) return reelA === reelB;

  return false;
}

function hostsMatch(a: URL, b: URL): boolean {
  const normalize = (host: string) =>
    host.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  return normalize(a.hostname) === normalize(b.hostname);
}

export function officialLinkMatchesUrl(
  linkUrl: string,
  pastedUrl: URL
): boolean {
  const link = parsePublicUrl(linkUrl);
  if (!link) return false;

  if (urlsShareContentIdentity(link, pastedUrl)) return true;

  const linkPlatform = platformFromHost(link.hostname);
  const pastedPlatform = platformFromHost(pastedUrl.hostname);

  const linkHandle = platformHandleFromUrl(link, linkPlatform);
  const pastedHandle = platformHandleFromUrl(pastedUrl, pastedPlatform);

  if (linkHandle && pastedHandle && linkHandle === pastedHandle) {
    if (linkPlatform === pastedPlatform) return true;
    if (linkPlatform === "youtube" && pastedPlatform === "youtube") {
      return true;
    }
  }

  if (hostsMatch(link, pastedUrl)) {
    const linkPath = link.pathname.replace(/\/+$/, "") || "/";
    const pastedPath = pastedUrl.pathname.replace(/\/+$/, "") || "/";
    if (linkPath === pastedPath) return true;
  }

  return false;
}

function authorMatchesCreator(authorName: string, creator: Creator): boolean {
  const trimmed = authorName.trim();
  if (!trimmed) return false;

  const key = normalizeCreatorKey(trimmed);
  if (!key) return false;

  if (key === normalizeCreatorKey(creator.name)) return true;
  if (key === normalizeCreatorKey(creator.handle)) return true;
  if (trimmed.toLowerCase() === creator.name.toLowerCase()) return true;

  return false;
}

function findByOfficialLink(
  pastedUrl: URL,
  creators: Creator[]
): Creator | null {
  for (const creator of creators) {
    if (!creator.hasTeaBarksProfile) continue;
    for (const link of creator.officialLinks) {
      if (officialLinkMatchesUrl(link.url, pastedUrl)) {
        return creator;
      }
    }
  }
  return null;
}

function findByPlatformHandle(
  pastedUrl: URL,
  platform: SourcePlatform,
  creators: Creator[]
): Creator | null {
  const handle = platformHandleFromUrl(pastedUrl, platform);
  if (!handle) return null;

  const key = normalizeCreatorKey(handle);
  for (const creator of creators) {
    if (!creator.hasTeaBarksProfile) continue;
    if (normalizeCreatorKey(creator.handle) === key) return creator;
  }
  return null;
}

function findByAuthorName(
  authorName: string | undefined,
  creators: Creator[]
): Creator | null {
  if (!authorName?.trim()) return null;

  for (const creator of creators) {
    if (!creator.hasTeaBarksProfile) continue;
    if (authorMatchesCreator(authorName, creator)) return creator;
  }
  return null;
}

export type MatchSourceInput = {
  url: string;
  platform: SourcePlatform;
  authorName?: string;
};

export function matchApprovedCreator(
  input: MatchSourceInput,
  creators: Creator[]
): Creator | null {
  const pastedUrl = parsePublicUrl(input.url);
  if (!pastedUrl) return null;

  return (
    findByOfficialLink(pastedUrl, creators) ??
    findByPlatformHandle(pastedUrl, input.platform, creators) ??
    findByAuthorName(input.authorName, creators)
  );
}
