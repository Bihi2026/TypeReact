import {
  canonicalUrl,
  facebookPhotoId,
  facebookReelId,
  instagramMediaId,
  isTikTokShortHost,
  parsePublicUrl,
  xStatusId,
  youtubeVideoId,
} from "@/lib/detect-source";
import type { SourcePlatform } from "@/lib/types";

export type RemoteMeta = {
  title?: string;
  authorName?: string;
  /** Platform handle when known (e.g. Instagram username from author_url). */
  authorHandle?: string;
  thumbnailUrl?: string;
  category?: string;
};

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
};

type FxTweet = {
  tweet?: {
    text?: string;
    author?: { name?: string; screen_name?: string };
    media?: {
      photos?: { url?: string }[];
      videos?: { thumbnail_url?: string }[];
      all?: { url?: string; type?: string; thumbnail_url?: string }[];
    };
  };
};

const TIMEOUT_MS = 8000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const BOT_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const TWITTER_BOT_UA = "Twitterbot/1.0";

const GENERIC_TITLES = new Set([
  "facebook",
  "facebook - log in or sign up",
  "log into facebook",
  "instagram",
  "tiktok",
  "x",
  "twitter",
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}

function metaContent(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
        "i"
      ),
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]) return decodeEntities(match[1].trim());
    }
  }
  return undefined;
}

const IG_RESERVED_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "explore",
  "accounts",
  "about",
  "developer",
  "legal",
  "web",
  "directory",
]);

const BAD_HANDLES = new Set(["", "instagram", "unknown", "creator"]);

function cleanTitle(title?: string): string | undefined {
  const value = title?.trim();
  if (!value) return undefined;
  if (GENERIC_TITLES.has(value.toLowerCase())) return undefined;
  return value;
}

function cleanAuthor(name?: string): string | undefined {
  const value = name?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return undefined;
  if (GENERIC_TITLES.has(value.toLowerCase())) return undefined;
  if (BAD_HANDLES.has(value.toLowerCase())) return undefined;
  return value;
}

function normalizeHandle(raw?: string): string | undefined {
  const handle = raw?.replace(/^@/, "").trim().toLowerCase();
  if (!handle) return undefined;
  if (IG_RESERVED_PATHS.has(handle) || BAD_HANDLES.has(handle)) return undefined;
  if (!/^[a-z0-9._]{1,30}$/i.test(handle)) return undefined;
  return handle;
}

function handleFromAuthorUrl(authorUrl?: string): string | undefined {
  if (!authorUrl) return undefined;
  try {
    const parsed = new URL(authorUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return normalizeHandle(parts[0]);
  } catch {
    return undefined;
  }
}

/** Meta removed author_* / thumbnail_* from oEmbed; recover them from embed HTML. */
function parseInstagramEmbedHtml(html?: string): {
  authorHandle?: string;
  authorName?: string;
  caption?: string;
} {
  if (!html) return {};

  const decoded = decodeEntities(html);
  const sharedBy = decoded.match(
    /(?:A\s+(?:post|video|reel)\s+shared\s+by|Shared\s+by)\s+([^<(@]+?)\s*\(@([a-z0-9._]+)\)/i
  );
  let authorName = cleanAuthor(sharedBy?.[1]);
  let authorHandle = normalizeHandle(sharedBy?.[2]);

  if (!authorHandle) {
    const atOnly = decoded.match(/@([a-z0-9._]{1,30})\b/i);
    authorHandle = normalizeHandle(atOnly?.[1]);
  }

  if (!authorHandle) {
    const profileLinks = [
      ...decoded.matchAll(
        /https?:\/\/(?:www\.)?instagram\.com\/([a-z0-9._]+)\/?/gi
      ),
    ];
    for (const match of profileLinks) {
      const candidate = normalizeHandle(match[1]);
      if (candidate) {
        authorHandle = candidate;
        break;
      }
    }
  }

  if (!authorName && authorHandle) {
    authorName = authorHandle;
  }

  const plain = stripHtml(decoded);
  let caption: string | undefined;
  if (plain) {
    const withoutShared = plain
      .replace(
        /(?:A\s+(?:post|video|reel)\s+shared\s+by|Shared\s+by)\s+[^(]+?\(@[a-z0-9._]+\)\.?/i,
        ""
      )
      .replace(/View\s+this\s+post\s+on\s+Instagram/i, "")
      .replace(/\s+/g, " ")
      .trim();
    caption = cleanTitle(withoutShared);
  }

  return { authorHandle, authorName, caption };
}

export function parseOpenGraph(html: string): RemoteMeta {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return {
    title: cleanTitle(
      metaContent(html, ["og:title", "twitter:title"]) ??
        (titleTag ? decodeEntities(titleTag.trim()) : undefined)
    ),
    authorName: cleanAuthor(
      metaContent(html, [
        "author",
        "article:author",
        "og:article:author",
        "og:site_name",
      ])
    ),
    thumbnailUrl: metaContent(html, [
      "og:image",
      "og:image:secure_url",
      "twitter:image",
      "twitter:image:src",
    ]),
  };
}

function hasCard(meta: RemoteMeta | null | undefined): boolean {
  return Boolean(
    meta?.title || meta?.authorName || meta?.authorHandle || meta?.thumbnailUrl
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchHtml(
  url: string,
  userAgent = `${BROWSER_UA} ${BOT_UA}`
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": userAgent,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function scrapeOpenGraph(url: string): Promise<RemoteMeta> {
  for (const ua of [TWITTER_BOT_UA, BOT_UA, BROWSER_UA]) {
    const html = await fetchHtml(url, ua);
    if (!html) continue;
    const og = parseOpenGraph(html);
    if (hasCard(og)) return og;
  }
  return {};
}

function authorFromPipeTitle(title?: string): string | undefined {
  if (!title || !title.includes("|")) return undefined;
  const last = title.split("|").map((part) => part.trim()).at(-1);
  return cleanAuthor(last);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolveTikTokUrl(raw: string): Promise<string> {
  const parsed = parsePublicUrl(raw);
  if (!parsed) return raw.trim();
  if (!isTikTokShortHost(parsed.hostname)) return parsed.href;
  try {
    const res = await fetch(parsed.href, {
      headers: { "User-Agent": BROWSER_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.url || parsed.href;
  } catch {
    return parsed.href;
  }
}

async function unfurlYouTube(videoId: string): Promise<RemoteMeta | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const data = await fetchJson<OEmbed>(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
  );
  if (!data) return null;
  return {
    title: data.title,
    authorName: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    category: "Video",
  };
}

async function unfurlTikTok(url: string): Promise<RemoteMeta | null> {
  const resolved = await resolveTikTokUrl(url);
  const parsed = parsePublicUrl(resolved);
  const oembedTarget = parsed ? canonicalUrl(parsed).href : resolved;
  const data = await fetchJson<OEmbed>(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(oembedTarget)}`
  );
  if (!data) return null;
  return {
    title: data.title,
    authorName: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    category: "Video",
  };
}

async function unfurlFacebook(canonicalHref: string): Promise<RemoteMeta | null> {
  const parsed = parsePublicUrl(canonicalHref);
  if (!parsed) return null;
  const reelId = facebookReelId(parsed);
  const endpoint = reelId
    ? `https://graph.facebook.com/v26.0/oembed_video?url=${encodeURIComponent(canonicalHref)}`
    : `https://graph.facebook.com/v26.0/oembed_post?url=${encodeURIComponent(canonicalHref)}`;
  await fetchJson<OEmbed>(endpoint);

  const og = await scrapeOpenGraph(canonicalHref);
  const category = facebookPhotoId(parsed)
    ? "Photo"
    : reelId
      ? "Video"
      : "Post";
  if (!hasCard(og)) return { category };
  return {
    ...og,
    authorName: og.authorName || authorFromPipeTitle(og.title),
    category,
  };
}

async function unfurlInstagram(canonicalHref: string): Promise<RemoteMeta | null> {
  const parsed = parsePublicUrl(canonicalHref);
  if (!parsed) return null;
  const media = instagramMediaId(parsed);
  const category =
    media?.kind === "reel" ? "Reel" : media?.kind === "tv" ? "Video" : "Post";

  const data = await fetchJson<OEmbed>(
    `https://graph.facebook.com/v26.0/instagram_oembed?url=${encodeURIComponent(
      canonicalHref
    )}&omitscript=true`
  );

  const fromHtml = parseInstagramEmbedHtml(data?.html);
  const authorHandle =
    normalizeHandle(handleFromAuthorUrl(data?.author_url)) ||
    fromHtml.authorHandle;
  const authorName =
    cleanAuthor(data?.author_name) || fromHtml.authorName || authorHandle;

  // Meta no longer returns thumbnail/author via oEmbed fields — scrape OG too.
  const og = await scrapeOpenGraph(canonicalHref);

  const title =
    cleanTitle(data?.title) ||
    og.title ||
    fromHtml.caption ||
    authorFromPipeTitle(og.title);

  const thumbnailUrl = data?.thumbnail_url || og.thumbnailUrl;

  const merged: RemoteMeta = {
    title,
    authorName: authorName || cleanAuthor(og.authorName),
    authorHandle: authorHandle || normalizeHandle(og.authorHandle),
    thumbnailUrl,
    category,
  };

  if (hasCard(merged)) return merged;
  return media ? { category } : null;
}

async function unfurlX(statusId: string): Promise<RemoteMeta | null> {
  const fx = await fetchJson<FxTweet>(
    `https://api.fxtwitter.com/status/${statusId}`
  );
  const tweet = fx?.tweet;
  if (tweet) {
    const photo =
      tweet.media?.photos?.[0]?.url ??
      tweet.media?.all?.find((item) => item.type === "photo")?.url;
    const videoThumb =
      tweet.media?.videos?.[0]?.thumbnail_url ??
      tweet.media?.all?.find((item) => item.type === "video")?.thumbnail_url;
    return {
      title: tweet.text,
      authorName: tweet.author?.name || tweet.author?.screen_name,
      thumbnailUrl: photo || videoThumb,
      category: "Post",
    };
  }

  const oembed = await fetchJson<OEmbed>(
    `https://publish.twitter.com/oembed?url=${encodeURIComponent(
      `https://x.com/i/status/${statusId}`
    )}&omit_script=true`
  );
  if (!oembed) return null;
  return {
    title: oembed.html ? stripHtml(oembed.html) : undefined,
    authorName: oembed.author_name,
    category: "Post",
  };
}

async function unfurlArticle(url: string): Promise<RemoteMeta | null> {
  const og = await scrapeOpenGraph(url);
  if (!hasCard(og)) return null;
  return { ...og, category: "Article" };
}

export function remoteMetaIsLimited(meta: RemoteMeta | null): boolean {
  return !hasCard(meta);
}

export async function unfurlSource(
  raw: string,
  platform: SourcePlatform
): Promise<RemoteMeta | null> {
  const parsed = parsePublicUrl(raw);
  if (!parsed) return null;
  const canonical = canonicalUrl(parsed).href;

  switch (platform) {
    case "youtube": {
      const id = youtubeVideoId(parsed);
      return id ? unfurlYouTube(id) : null;
    }
    case "tiktok":
      return unfurlTikTok(raw);
    case "facebook":
      return unfurlFacebook(canonical);
    case "instagram":
      return unfurlInstagram(canonical);
    case "x": {
      const id = xStatusId(parsed);
      return id ? unfurlX(id) : unfurlArticle(canonical);
    }
    default:
      return unfurlArticle(canonical);
  }
}
