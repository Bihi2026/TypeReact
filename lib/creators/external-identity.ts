import { parsePublicUrl } from "@/lib/detect-source";
import {
  normalizeCreatorKey,
  platformHandleFromUrl,
} from "@/lib/creators/match-source";
import type { SourcePlatform } from "@/lib/types";

export type ExternalIdentity = {
  platform: SourcePlatform;
  externalHandle: string;
  displayName: string;
};

function titleCaseHandle(handle: string) {
  return handle
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const BAD_EXTERNAL_HANDLES = new Set(["", "instagram", "unknown", "creator"]);

export function resolveExternalIdentity(input: {
  url: string;
  platform: SourcePlatform;
  authorName?: string;
  authorHandle?: string;
}): ExternalIdentity | null {
  const parsed = parsePublicUrl(input.url);
  const authorName = input.authorName?.trim();
  const authorHandle = input.authorHandle?.trim();

  let externalHandle = "";
  if (authorHandle) {
    externalHandle = normalizeCreatorKey(authorHandle);
  }
  if (!externalHandle && parsed) {
    const fromUrl = platformHandleFromUrl(parsed, input.platform);
    if (fromUrl) externalHandle = normalizeCreatorKey(fromUrl);
  }
  if (!externalHandle && authorName) {
    externalHandle = normalizeCreatorKey(authorName);
  }
  if (!externalHandle || BAD_EXTERNAL_HANDLES.has(externalHandle)) {
    return null;
  }

  const displayName =
    authorName || titleCaseHandle(externalHandle) || externalHandle;

  return {
    platform: input.platform,
    externalHandle,
    displayName,
  };
}

export function channelUrlFromHandle(
  platform: SourcePlatform,
  handle: string
): string | null {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean || BAD_EXTERNAL_HANDLES.has(clean.toLowerCase())) return null;

  switch (platform) {
    case "youtube":
      return `https://youtube.com/@${clean}`;
    case "tiktok":
      return `https://tiktok.com/@${clean}`;
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    default:
      return null;
  }
}

export function channelUrlFromSource(
  url: string,
  platform: SourcePlatform
): string | null {
  const parsed = parsePublicUrl(url);
  if (!parsed) return null;
  const handle = platformHandleFromUrl(parsed, platform);
  if (!handle) return null;
  return channelUrlFromHandle(platform, handle) ?? parsed.href;
}
