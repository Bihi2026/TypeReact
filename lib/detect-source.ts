import { getCreator } from "@/lib/data";
import type { Creator, Source, SourcePlatform } from "@/lib/types";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export type DetectedSource = {
  source: Source;
  creator: Creator | null;
  detailsLimited?: boolean;
};

function withProtocol(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function hostname(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function parsePublicUrl(raw: string): URL | null {
  try {
    const parsed = new URL(withProtocol(raw));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    parsed.hostname = hostname(parsed.hostname);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function youtubeVideoId(url: URL): string | null {
  const host = hostname(url.hostname);
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ?? null;
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
      return parts[1] ?? null;
    }
  }
  return null;
}

export function youtubeThumbnailUrl(raw: string): string | undefined {
  const parsed = parsePublicUrl(raw);
  if (!parsed) return undefined;
  const id = youtubeVideoId(parsed);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

export function xStatusId(url: URL): string | null {
  const host = hostname(url.hostname);
  if (host !== "x.com" && host !== "twitter.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("status");
  return i >= 0 ? (parts[i + 1] ?? null) : null;
}

export function xHandle(url: URL): string | null {
  const host = hostname(url.hostname);
  if (host !== "x.com" && host !== "twitter.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("status");
  if (i <= 0) return null;
  const handle = parts[i - 1];
  return handle && handle !== "i" ? handle : null;
}

export function isTikTokShortHost(host: string): boolean {
  const h = hostname(host);
  return h === "vm.tiktok.com" || h === "vt.tiktok.com";
}

export function tiktokVideoId(url: URL): string | null {
  const host = hostname(url.hostname);
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const videoIdx = parts.indexOf("video");
  if (videoIdx >= 0) return parts[videoIdx + 1] ?? null;
  if (parts[0] === "shorts" && parts[1]) return parts[1];
  return null;
}

/** Instagram post or reel shortcode (path segment after /p/ or /reel/). */
export function instagramMediaId(url: URL): {
  id: string;
  kind: "p" | "reel" | "tv";
} | null {
  const host = hostname(url.hostname);
  if (host !== "instagram.com" && !host.endsWith(".instagram.com")) {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) return { id: parts[1], kind: "p" };
  if (parts[0] === "reel" && parts[1]) return { id: parts[1], kind: "reel" };
  if (parts[0] === "reels" && parts[1]) return { id: parts[1], kind: "reel" };
  if (parts[0] === "tv" && parts[1]) return { id: parts[1], kind: "tv" };
  return null;
}

export function facebookPhotoId(url: URL): string | null {
  if (platformFromHost(url.hostname) !== "facebook") return null;
  const fbid = url.searchParams.get("fbid");
  if (fbid) return fbid;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "photo.php") return url.searchParams.get("fbid");
  const photosIdx = parts.indexOf("photos");
  if (photosIdx >= 0) return parts.at(-1) ?? null;
  return null;
}

export function facebookReelId(url: URL): string | null {
  if (platformFromHost(url.hostname) !== "facebook") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "reel" || parts[0] === "reels") return parts[1] ?? null;
  if (parts[0] === "watch") return url.searchParams.get("v");
  return null;
}

function facebookHostKey(host: string): string {
  const h = hostname(host);
  if (h === "fb.watch" || h === "fb.com") return "facebook.com";
  if (h === "facebook.com" || h.endsWith(".facebook.com")) return "facebook.com";
  return h;
}

function catalogKey(url: URL): string {
  const yt = youtubeVideoId(url);
  if (yt) return `youtube:${yt}`;
  const status = xStatusId(url);
  if (status) return `x:${status}`;
  const photo = facebookPhotoId(url);
  if (photo) return `facebook:photo:${photo}`;
  const reel = facebookReelId(url);
  if (reel) return `facebook:reel:${reel}`;
  const tiktok = tiktokVideoId(url);
  if (tiktok) return `tiktok:${tiktok}`;
  const ig = instagramMediaId(url);
  if (ig) return `instagram:${ig.kind}:${ig.id}`;
  const host = facebookHostKey(url.hostname);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}${url.search}`;
}

export function platformFromHost(host: string): SourcePlatform {
  const h = hostname(host);
  if (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be") {
    return "youtube";
  }
  if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return "tiktok";
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
  if (
    h === "facebook.com" ||
    h.endsWith(".facebook.com") ||
    h === "fb.watch" ||
    h === "fb.com"
  ) {
    return "facebook";
  }
  if (h === "x.com" || h === "twitter.com") return "x";
  return "article";
}

function titleFromUrl(url: URL): string {
  const yt = youtubeVideoId(url);
  if (yt) return `YouTube video ${yt}`;
  const tiktok = tiktokVideoId(url);
  if (tiktok) return `TikTok video ${tiktok}`;
  if (facebookPhotoId(url)) return "Facebook photo";
  if (facebookReelId(url)) return "Facebook reel";
  const status = xStatusId(url);
  if (status) return `Post by ${xHandle(url) ?? "X"}`;
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts.at(-1);
  if (last && last !== "watch" && last !== "photo" && last !== "reel") {
    try {
      return decodeURIComponent(last).replace(/[-_]+/g, " ");
    } catch {
      return last.replace(/[-_]+/g, " ");
    }
  }
  return hostname(url.hostname);
}

function syntheticId(url: URL): string {
  const key = catalogKey(url);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `detect:${hash.toString(16)}`;
}

export function canonicalUrl(url: URL): URL {
  const yt = youtubeVideoId(url);
  if (yt) return new URL(`https://www.youtube.com/watch?v=${yt}`);

  const photo = facebookPhotoId(url);
  if (photo) return new URL(`https://www.facebook.com/photo/?fbid=${photo}`);
  const reel = facebookReelId(url);
  if (reel) return new URL(`https://www.facebook.com/reel/${reel}`);

  const status = xStatusId(url);
  if (status) {
    const handle = xHandle(url);
    return new URL(
      handle
        ? `https://x.com/${handle}/status/${status}`
        : `https://x.com/i/status/${status}`
    );
  }

  const tiktok = tiktokVideoId(url);
  if (tiktok) {
    const path = url.pathname.replace(/\/+$/, "") || `/video/${tiktok}`;
    return new URL(`https://www.tiktok.com${path}`);
  }

  return url;
}

function syntheticSource(url: URL): Source {
  const canonical = canonicalUrl(url);
  return {
    id: syntheticId(canonical),
    platform: platformFromHost(canonical.hostname),
    url: canonical.href,
    title: titleFromUrl(canonical),
    creatorId: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    category: "Uncategorized",
    language: "Unknown",
    barkCount: 0,
    replyChainCount: 0,
    caseCount: 0,
    engagement: 0,
    evidenceRating: 0,
  };
}

export function remoteCreator(name: string, platform: SourcePlatform): Creator {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "creator";
  return {
    id: `remote:${platform}:${handle}`,
    handle,
    name,
    bio: "",
    verified: false,
    hasTeaBarksProfile: false,
    platforms: [platform],
    officialLinks: [],
    followers: 0,
    country: "",
    topics: [],
    totalSources: 1,
    totalBarksReceived: 0,
    responseRate: 0,
    joinedAt: new Date().toISOString().slice(0, 10),
  };
}

export function applyRemoteMeta(
  detected: DetectedSource,
  meta: {
    title?: string;
    authorName?: string;
    thumbnailUrl?: string;
    category?: string;
  }
): DetectedSource {
  const title = meta.title?.trim();
  const authorName = meta.authorName?.trim();
  const creator =
    detected.creator ??
    (authorName ? remoteCreator(authorName, detected.source.platform) : null);
  return {
    source: {
      ...detected.source,
      title: title || detected.source.title,
      thumbnailUrl: meta.thumbnailUrl || detected.source.thumbnailUrl,
      creatorId: creator?.id ?? detected.source.creatorId,
      category: meta.category || detected.source.category,
    },
    creator,
  };
}

export function detectSource(
  rawUrl: string,
  catalog: Source[]
): DetectedSource | null {
  const parsed = parsePublicUrl(rawUrl);
  if (!parsed) return null;

  const pastedKey = catalogKey(parsed);
  const match = catalog.find((s) => {
    const seed = parsePublicUrl(s.url);
    return seed ? catalogKey(seed) === pastedKey : false;
  });

  if (match) {
    return { source: match, creator: getCreator(match.creatorId) ?? null };
  }

  return { source: syntheticSource(parsed), creator: null };
}
