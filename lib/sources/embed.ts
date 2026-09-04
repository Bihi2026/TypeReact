import {
  facebookReelId,
  instagramMediaId,
  parsePublicUrl,
  tiktokVideoId,
  xStatusId,
  youtubeVideoId,
} from "@/lib/detect-source";
import type { SourcePlatform } from "@/lib/types";

export type SourceEmbedAspect = "16:9" | "9:16" | "1:1";

export type SourceEmbed =
  | {
      kind: "iframe";
      src: string;
      title: string;
      aspect: SourceEmbedAspect;
      provider: SourcePlatform;
    }
  | {
      kind: "html5";
      src: string;
      title: string;
      aspect: SourceEmbedAspect;
      contentType?: string;
    }
  | {
      kind: "none";
      reason: string;
    };

const DIRECT_VIDEO_EXT = /\.(mp4|webm|ogg|m4v|mov)(\?|#|$)/i;

function isDirectVideoUrl(url: URL): boolean {
  return DIRECT_VIDEO_EXT.test(url.pathname) || DIRECT_VIDEO_EXT.test(url.href);
}

/**
 * Resolve an official in-app embed for a source URL.
 * Does not proxy streams — only provider embeds / direct media files.
 */
export function resolveSourceEmbed(
  rawUrl: string,
  platform?: SourcePlatform | null
): SourceEmbed {
  const parsed = parsePublicUrl(rawUrl);
  if (!parsed) {
    return { kind: "none", reason: "Invalid source URL" };
  }

  if (isDirectVideoUrl(parsed)) {
    return {
      kind: "html5",
      src: parsed.href,
      title: "Video",
      aspect: "16:9",
      contentType: "video/mp4",
    };
  }

  const yt = youtubeVideoId(parsed);
  if (yt || platform === "youtube") {
    if (!yt) {
      return { kind: "none", reason: "Could not find a YouTube video ID" };
    }
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`,
      title: "YouTube video",
      aspect: "16:9",
      provider: "youtube",
    };
  }

  const tiktok = tiktokVideoId(parsed);
  if (tiktok || platform === "tiktok") {
    if (!tiktok) {
      return {
        kind: "none",
        reason: "TikTok short links need the full /video/ URL to embed",
      };
    }
    return {
      kind: "iframe",
      src: `https://www.tiktok.com/embed/v2/${encodeURIComponent(tiktok)}`,
      title: "TikTok video",
      aspect: "9:16",
      provider: "tiktok",
    };
  }

  const ig = instagramMediaId(parsed);
  if (ig || platform === "instagram") {
    if (!ig) {
      return {
        kind: "none",
        reason: "Could not find an Instagram post or reel to embed",
      };
    }
    const path = ig.kind === "reel" ? "reel" : ig.kind === "tv" ? "tv" : "p";
    return {
      kind: "iframe",
      src: `https://www.instagram.com/${path}/${encodeURIComponent(ig.id)}/embed`,
      title: "Instagram media",
      aspect: ig.kind === "p" ? "1:1" : "9:16",
      provider: "instagram",
    };
  }

  const fbReel = facebookReelId(parsed);
  if (fbReel || platform === "facebook") {
    if (!fbReel && platform === "facebook") {
      // Try generic video plugin with the page URL (works for some watch links).
      const href = encodeURIComponent(parsed.href);
      return {
        kind: "iframe",
        src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560`,
        title: "Facebook video",
        aspect: "16:9",
        provider: "facebook",
      };
    }
    if (!fbReel) {
      return {
        kind: "none",
        reason: "This Facebook URL can’t be embedded as video",
      };
    }
    const href = encodeURIComponent(parsed.href);
    return {
      kind: "iframe",
      src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560`,
      title: "Facebook video",
      aspect: "9:16",
      provider: "facebook",
    };
  }

  const status = xStatusId(parsed);
  if (status || platform === "x") {
    if (!status) {
      return { kind: "none", reason: "Could not find an X post ID to embed" };
    }
    return {
      kind: "iframe",
      src: `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(status)}`,
      title: "X post",
      aspect: "16:9",
      provider: "x",
    };
  }

  if (platform === "livestream") {
    return {
      kind: "none",
      reason: "This livestream can’t be embedded in TypeReact",
    };
  }

  return {
    kind: "none",
    reason: "This source can’t be played in-app",
  };
}

export function sourceEmbedIsPlayable(embed: SourceEmbed): boolean {
  return embed.kind === "iframe" || embed.kind === "html5";
}
