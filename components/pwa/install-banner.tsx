"use client";

import * as React from "react";
import { Download, X, Loader2 } from "lucide-react";
import { usePWA } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PWAInstallBanner({ className }: { className?: string }) {
  const {
    isInstalled,
    isStandalone,
    isBannerDismissed,
    isInstallable,
    isIOS,
    isPromptPending,
    promptInstall,
    dismissBanner,
  } = usePWA();

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (isInstalled || isStandalone || isBannerDismissed) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <div
      role="region"
      aria-label="Install application banner"
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
          <img
            src="/favicon.ico"
            alt=""
            className="size-7 rounded-md object-contain"
          />
        </div>

        <div className="min-w-0 flex-1 pr-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-foreground">
              Install TypeReact
            </h4>
            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
              App
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            Install for a faster, full-screen experience and instant access.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              disabled={isPromptPending}
              onClick={() => {
                void promptInstall();
              }}
              className="h-7 bg-[#E83F00] px-3 text-xs font-semibold text-white hover:bg-[#d03500]"
            >
              {isPromptPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-3.5" />
              )}
              {isPromptPending ? "Preparing…" : "Install"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissBanner}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Not now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissBanner}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss install banner"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
