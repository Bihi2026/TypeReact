"use client";

import {
  AtSign,
  BriefcaseBusiness,
  Check,
  Copy,
  Link2,
  MessageCircle,
  Quote,
  Share2,
  Smartphone,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BRAND_NAME, contentKindLabel } from "@/lib/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

async function copyText(text: string, success: string, description?: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success, description ? { description } : undefined);
    return true;
  } catch {
    toast.error("Couldn't copy. Select and copy it manually.");
    return false;
  }
}

function openShareUrl(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

function shareTextForKind(
  kind: "bark" | "case",
  title: string,
  code: string
): string {
  return kind === "bark"
    ? `${title} (${code}) on ${BRAND_NAME}`
    : `${title} (${code}) — Accountability Case on ${BRAND_NAME}`;
}

function xShareUrl(text: string, url: string) {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function facebookShareUrl(url: string) {
  const params = new URLSearchParams({ u: url });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

function linkedInShareUrl(url: string) {
  const params = new URLSearchParams({ url });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}

function whatsAppShareUrl(text: string, url: string) {
  const params = new URLSearchParams({ text: `${text} ${url}` });
  return `https://wa.me/?${params.toString()}`;
}

const itemClass =
  "min-h-11 touch-manipulation sm:min-h-8";

const platformItemClass = cn(
  itemClass,
  "flex-col justify-center gap-1 px-2 py-2 text-center sm:flex-row sm:justify-start sm:gap-1.5 sm:px-1.5 sm:py-1 sm:text-left"
);

function PlatformShareItem({
  icon: Icon,
  shortLabel,
  label,
  onSelect,
}: {
  icon: LucideIcon;
  shortLabel: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem className={platformItemClass} onSelect={onSelect}>
      <Icon className="size-4" />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </DropdownMenuItem>
  );
}

export function ShareMenu({
  code,
  title,
  kind,
  path,
  /** Optional deep-link fragment, e.g. `ev-2` or `block-1` (with or without `#`). */
  hash,
}: {
  code: string;
  title: string;
  kind: "bark" | "case";
  /** Absolute path, e.g. `/barks/TR-2026-0341` */
  path: string;
  hash?: string;
}) {
  const [copied, setCopied] = React.useState<"code" | "url" | "cite" | null>(
    null
  );
  const [canNativeShare, setCanNativeShare] = React.useState(false);
  const kindLabel = contentKindLabel(kind);
  const fragment = hash?.replace(/^#/, "") ?? "";

  React.useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const pathWithHash = fragment ? `${path.split("#")[0]}#${fragment}` : path;
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${pathWithHash}`
      : pathWithHash;

  const shareText = shareTextForKind(kind, title, code);

  const cite =
    kind === "bark"
      ? fragment
        ? `${title} (${code} §${fragment}). ${BRAND_NAME}. ${url}`
        : `${title} (${code}). ${BRAND_NAME}. ${url}`
      : `${title} (${code}). ${BRAND_NAME} Accountability Case. ${url}`;

  const mark = (key: "code" | "url" | "cite") => {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Couldn't open the share sheet.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 touch-manipulation"
          aria-label={`Share ${kindLabel}`}
        >
          <Share2 className="size-3.5" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(18rem,calc(100vw-1.5rem))] sm:w-60"
      >
        <DropdownMenuLabel className="truncate">
          Share this {kindLabel}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-0.5 p-0.5 sm:contents sm:p-0">
          <PlatformShareItem
            icon={AtSign}
            shortLabel="X"
            label="Share on X"
            onSelect={() => openShareUrl(xShareUrl(shareText, url))}
          />
          <PlatformShareItem
            icon={ThumbsUp}
            shortLabel="Facebook"
            label="Share on Facebook"
            onSelect={() => openShareUrl(facebookShareUrl(url))}
          />
          <PlatformShareItem
            icon={BriefcaseBusiness}
            shortLabel="LinkedIn"
            label="Share on LinkedIn"
            onSelect={() => openShareUrl(linkedInShareUrl(url))}
          />
          <PlatformShareItem
            icon={MessageCircle}
            shortLabel="WhatsApp"
            label="Share on WhatsApp"
            onSelect={() => openShareUrl(whatsAppShareUrl(shareText, url))}
          />
        </div>
        {canNativeShare ? (
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => void shareNative()}
          >
            <Smartphone className="size-4" />
            Share via device
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={itemClass}
          onSelect={async () => {
            if (
              await copyText(
                code,
                `${kindLabel} ID copied`,
                "Paste into Search to find it."
              )
            ) {
              mark("code");
            }
          }}
        >
          {copied === "code" ? (
            <Check className="size-4 text-agree" />
          ) : (
            <Copy className="size-4" />
          )}
          Copy {kindLabel} ID
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemClass}
          onSelect={async () => {
            if (
              await copyText(
                url,
                fragment ? "Deep link copied" : "Link copied",
                fragment ? `Anchored to #${fragment}` : undefined
              )
            ) {
              mark("url");
            }
          }}
        >
          {copied === "url" ? (
            <Check className="size-4 text-agree" />
          ) : (
            <Link2 className="size-4" />
          )}
          {fragment ? "Copy deep link" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={itemClass}
          onSelect={async () => {
            if (
              await copyText(
                cite,
                "Citation copied",
                "Ready to paste into notes or replies."
              )
            ) {
              mark("cite");
            }
          }}
        >
          {copied === "cite" ? (
            <Check className="size-4 text-agree" />
          ) : (
            <Quote className="size-4" />
          )}
          Copy citation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
