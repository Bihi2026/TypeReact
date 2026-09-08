"use client";

import * as React from "react";
import {
  Download,
  Share,
  PlusSquare,
  Sparkles,
  Zap,
  Bell,
  MonitorCheck,
  CheckCircle2,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { usePWA, type DetectedBrowser } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function chromiumInstallLabel(browser: DetectedBrowser): string {
  if (browser === "edge") return "Apps";
  return "Install TypeReact / Install app";
}

function ManualInstallSteps() {
  const { isIOS, isAndroid, browserName, isDesktop } = usePWA();

  if (isIOS) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          How to install on iOS Safari:
        </h4>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>
              Tap the <strong>Share</strong> button{" "}
              <Share className="inline size-4 text-primary align-text-bottom" />{" "}
              in the Safari navigation bar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>
              Scroll down and select <strong>Add to Home Screen</strong>{" "}
              <PlusSquare className="inline size-4 text-primary align-text-bottom" />
              .
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>
              Tap <strong>Add</strong> in the top-right corner to finish.
            </span>
          </li>
        </ol>
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          How to install on Android:
        </h4>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>
              Tap the browser menu{" "}
              <MoreVertical className="inline size-4 text-primary align-text-bottom" />
              .
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>
              Choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>Confirm to add TypeReact to your home screen.</span>
          </li>
        </ol>
      </div>
    );
  }

  const chromiumLike =
    browserName === "chrome" ||
    browserName === "edge" ||
    browserName === "brave" ||
    browserName === "opera" ||
    browserName === "samsung";

  if (isDesktop && chromiumLike) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Install from your browser menu:
        </h4>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>
              Open the browser menu (three dots) in the top-right corner.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>
              Select <strong>{chromiumInstallLabel(browserName)}</strong>
              {browserName === "edge" ? (
                <>
                  {" "}
                  → <strong>Install this site as an app</strong>
                </>
              ) : null}
              .
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>
              Confirm the install dialog to add TypeReact to your device.
            </span>
          </li>
        </ol>
      </div>
    );
  }

  if (browserName === "safari" && isDesktop) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
        <p>
          On macOS Safari, use <strong>File → Add to Dock</strong> (Safari 17+)
          or open this site in <strong>Chrome</strong> or <strong>Edge</strong>{" "}
          for a one-click install.
        </p>
      </div>
    );
  }

  if (browserName === "firefox") {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
        <p>
          Firefox does not support installing this site as an app. Open
          TypeReact in <strong>Chrome</strong> or <strong>Edge</strong> to
          install.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
      <p>
        Use your browser&apos;s menu to look for <strong>Install app</strong> or{" "}
        <strong>Add to Home Screen</strong>. Chrome or Edge on HTTPS (or
        localhost) gives the best install experience.
      </p>
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 text-left text-xs">
      <div className="flex items-center gap-2 rounded-md border p-2.5">
        <Zap className="size-4 text-[#E83F00]" />
        <span className="font-medium">Instant launch & speed</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border p-2.5">
        <MonitorCheck className="size-4 text-[#E83F00]" />
        <span className="font-medium">Dedicated window</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border p-2.5">
        <Sparkles className="size-4 text-[#E83F00]" />
        <span className="font-medium">Offline fallback</span>
      </div>
      <div className="flex items-center gap-2 rounded-md border p-2.5">
        <Bell className="size-4 text-[#E83F00]" />
        <span className="font-medium">Real-time alerts</span>
      </div>
    </div>
  );
}

export function PWAInstallDialog() {
  const {
    showInstallModal,
    setShowInstallModal,
    promptInstall,
    isIOS,
    isInstalled,
    hasNativePrompt,
    isPromptPending,
  } = usePWA();

  const handleInstallClick = async () => {
    await promptInstall();
  };

  const showNativeUi = hasNativePrompt || isPromptPending;

  return (
    <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="relative mb-2 flex size-16 items-center justify-center rounded-2xl shadow-md shadow-orange-500/20">
            <img
              src="/favicon.ico"
              alt="TypeReact"
              className="size-12 rounded-xl object-contain"
            />
          </div>
          <DialogTitle className="text-xl font-bold">
            {isInstalled ? "TypeReact is Installed" : "Install TypeReact App"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isInstalled
              ? "You are using the installed standalone version of TypeReact."
              : isPromptPending
                ? "Preparing the install prompt…"
                : "Get the best experience with instant access, offline support, and dedicated window."}
          </DialogDescription>
        </DialogHeader>

        {isInstalled ? (
          <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="text-sm font-medium">
              You already have TypeReact installed on your device.
            </p>
          </div>
        ) : isPromptPending ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <Loader2 className="size-10 animate-spin text-[#E83F00]" />
            <p className="text-sm text-muted-foreground">
              Waiting for the browser install prompt…
            </p>
          </div>
        ) : hasNativePrompt ? (
          <div className="space-y-3 py-2">
            <FeatureGrid />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {!isIOS ? <FeatureGrid /> : null}
            <ManualInstallSteps />
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setShowInstallModal(false)}
            disabled={isPromptPending}
          >
            {isInstalled || !showNativeUi ? "Done" : "Cancel"}
          </Button>
          {!isInstalled && showNativeUi ? (
            <Button
              onClick={handleInstallClick}
              disabled={isPromptPending}
              className="bg-[#E83F00] text-white hover:bg-[#d03500]"
            >
              {isPromptPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {isPromptPending ? "Preparing…" : "Install Now"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
