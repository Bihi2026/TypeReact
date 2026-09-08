"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  Share,
  PlusSquare,
  Sparkles,
  Zap,
  MonitorCheck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { usePWA, type DetectedBrowser } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function chromiumInstallLabel(browser: DetectedBrowser): string {
  if (browser === "edge") return "Apps";
  return "Install TypeReact / Install app";
}

function InstallInstructions() {
  const {
    isIOS,
    isAndroid,
    browserName,
    isDesktop,
    hasNativePrompt,
    isPromptPending,
    isChromium,
    promptInstall,
  } = usePWA();

  if (isIOS) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-left">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          iOS Installation Steps:
        </h4>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>
              Tap the <strong>Share</strong> icon{" "}
              <Share className="inline size-3.5 text-primary align-text-bottom" />{" "}
              in Safari.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>
              Select <strong>Add to Home Screen</strong>{" "}
              <PlusSquare className="inline size-3.5 text-primary align-text-bottom" />
              .
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>
              Tap <strong>Add</strong> to confirm.
            </span>
          </li>
        </ol>
      </div>
    );
  }

  // Chromium: always offer one-click native install (waits for prompt if needed)
  if (isChromium || hasNativePrompt) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Click below to add TypeReact to your desktop or mobile app launcher.
          No app store downloads required.
        </p>
        <Button
          onClick={() => {
            void promptInstall();
          }}
          disabled={isPromptPending}
          className="w-full bg-[#E83F00] text-white hover:bg-[#d03500]"
          size="lg"
        >
          {isPromptPending ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : (
            <Download className="mr-2 size-5" />
          )}
          {isPromptPending ? "Preparing install…" : "Install App"}
        </Button>
      </div>
    );
  }

  if (isAndroid) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/40 p-4 text-left">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Android Installation Steps:
          </h4>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <span>
                Tap the browser menu{" "}
                <MoreVertical className="inline size-3.5 text-primary align-text-bottom" />
                .
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              <span>
                Choose <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              <span>Confirm to finish installing TypeReact.</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  if (isDesktop && browserName === "safari") {
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Use your browser menu to look for <strong>Install app</strong> or{" "}
        <strong>Add to Home Screen</strong>. For one-click install, use Chrome
        or Edge on HTTPS (or localhost).
      </p>
      <p className="text-xs text-muted-foreground">
        Tip: look for{" "}
        <strong>{chromiumInstallLabel(browserName)}</strong> in the browser
        menu if available.
      </p>
    </div>
  );
}

export default function InstallPage() {
  const {
    isInstalled,
    isIOS,
    isStandalone,
    hasNativePrompt,
    isChromium,
    isPromptPending,
  } = usePWA();

  const isAppInstalled = isInstalled || isStandalone;
  const canOneClick = hasNativePrompt || (isChromium && !isIOS);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center sm:mb-12">
        <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#FF5A1F] to-[#D03500] shadow-lg shadow-orange-500/25">
          <img
            src="/favicon.ico"
            alt="TypeReact"
            className="size-14 rounded-2xl object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Install TypeReact
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Experience evidence-based discussions with instant launch, offline
          support, and dedicated app performance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-xl">
              {isAppInstalled ? "Status: Installed" : "Get the App"}
            </CardTitle>
            <CardDescription>
              {isAppInstalled
                ? "TypeReact is already installed and running on your system."
                : isIOS
                  ? "Install directly to your iPhone or iPad home screen."
                  : canOneClick
                    ? isPromptPending
                      ? "Preparing the browser install prompt…"
                      : "Install instantly with one click on your browser or device."
                    : "Follow the steps below to install TypeReact on this device."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAppInstalled ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-6 shrink-0" />
                <p className="text-sm font-medium">
                  You are running the installed standalone TypeReact app.
                </p>
              </div>
            ) : (
              <InstallInstructions />
            )}
          </CardContent>
          <CardFooter className="pt-0">
            <Button asChild variant="ghost" className="w-full text-xs">
              <Link href="/">
                Continue in browser <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Lightning Fast Launch</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                App shell and cached assets load immediately without browser tab
                overhead.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Offline Resilience</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Browse cached evidence and continue reading even with unstable
                connectivity.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MonitorCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                Dedicated Standalone Window
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Run TypeReact in its own clean window without URL bar
                distractions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Always Up to Date</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatic background updates ensure you always have the latest
                features and security fixes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
