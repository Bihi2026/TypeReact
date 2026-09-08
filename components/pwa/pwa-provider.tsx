"use client";

import * as React from "react";
import {
  PWAContext,
  detectBrowser,
  detectPlatform,
  isChromiumBrowser,
  type BeforeInstallPromptEvent,
  type DetectedBrowser,
  type DetectedPlatform,
  type PWAContextValue,
} from "@/hooks/use-pwa";

const BANNER_DISMISSED_KEY = "typereact_pwa_banner_dismissed_v1";
const PROMPT_WAIT_MS = 3000;
const PROMPT_POLL_MS = 100;

function getStoredPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__pwaPrompt ?? null;
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = React.useState(false);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);
  const [isWindows, setIsWindows] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [browserName, setBrowserName] =
    React.useState<DetectedBrowser>("other");
  const [platformName, setPlatformName] =
    React.useState<DetectedPlatform>("other");
  const [isBannerDismissed, setIsBannerDismissed] = React.useState(true);
  const [showInstallModal, setShowInstallModal] = React.useState(false);
  const [isPromptPending, setIsPromptPending] = React.useState(false);

  const deferredPromptRef = React.useRef<BeforeInstallPromptEvent | null>(null);

  const capturePrompt = React.useCallback((e: BeforeInstallPromptEvent) => {
    deferredPromptRef.current = e;
    setDeferredPrompt(e);
    setIsInstallable(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const checkStandalone = () => {
      const isWindowStandalone =
        standaloneMedia.matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true ||
        document.referrer.includes("android-app://");

      setIsStandalone(isWindowStandalone);
      setIsInstalled(isWindowStandalone);
    };

    checkStandalone();
    standaloneMedia.addEventListener("change", checkStandalone);

    const ua = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const maxTouchPoints = window.navigator.maxTouchPoints || 0;
    const detectedPlatform = detectPlatform(ua, platform, maxTouchPoints);
    const detectedBrowser = detectBrowser(ua);

    setPlatformName(detectedPlatform);
    setBrowserName(detectedBrowser);
    setIsIOS(detectedPlatform === "ios");
    setIsAndroid(detectedPlatform === "android");
    setIsMac(detectedPlatform === "mac");
    setIsWindows(detectedPlatform === "windows");
    setIsDesktop(
      detectedPlatform === "windows" ||
        detectedPlatform === "mac" ||
        detectedPlatform === "linux" ||
        detectedPlatform === "other"
    );

    try {
      const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
      if (!dismissed) {
        setIsBannerDismissed(false);
      }
    } catch {
      // ignore localStorage errors in private browsing
    }

    // Register SW immediately so installability criteria are met sooner.
    // In development, unregister any SW and clear caches instead — cached
    // HTML from a previous build causes hydration mismatches with hot code.
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            for (const registration of registrations) {
              void registration.unregister();
            }
          })
          .catch(() => {});
        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => {
              for (const key of keys) {
                if (key.startsWith("typereact-cache")) {
                  void caches.delete(key);
                }
              }
            })
            .catch(() => {});
        }
      } else {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (
                    newWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log("[PWA] New version available.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      }
    }

    if (window.__pwaPrompt) {
      capturePrompt(window.__pwaPrompt);
    }

    const earlyListener = (e: BeforeInstallPromptEvent) => {
      capturePrompt(e);
    };
    if (!window.__pwaPromptListeners) {
      window.__pwaPromptListeners = [];
    }
    window.__pwaPromptListeners.push(earlyListener);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaPrompt = promptEvent;
      capturePrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__pwaPrompt = null;
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallModal(false);
      setIsPromptPending(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      standaloneMedia.removeEventListener("change", checkStandalone);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (window.__pwaPromptListeners) {
        window.__pwaPromptListeners = window.__pwaPromptListeners.filter(
          (listener) => listener !== earlyListener
        );
      }
    };
  }, [capturePrompt]);

  const waitForNativePrompt = React.useCallback(async (): Promise<
    BeforeInstallPromptEvent | null
  > => {
    const existing =
      deferredPromptRef.current ?? getStoredPrompt() ?? deferredPrompt;
    if (existing) return existing;

    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // ignore
      }
    }

    const deadline = Date.now() + PROMPT_WAIT_MS;
    while (Date.now() < deadline) {
      const prompt =
        deferredPromptRef.current ?? getStoredPrompt() ?? null;
      if (prompt) return prompt;
      await new Promise((resolve) => setTimeout(resolve, PROMPT_POLL_MS));
    }

    return deferredPromptRef.current ?? getStoredPrompt() ?? null;
  }, [deferredPrompt]);

  const runNativePrompt = React.useCallback(
    async (prompt: BeforeInstallPromptEvent): Promise<boolean> => {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        window.__pwaPrompt = null;
        deferredPromptRef.current = null;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setIsInstallable(false);
          setShowInstallModal(false);
          return true;
        }
        return false;
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
        return false;
      }
    },
    []
  );

  const promptInstall = React.useCallback(async (): Promise<boolean> => {
    const immediate =
      deferredPromptRef.current ?? getStoredPrompt() ?? deferredPrompt;

    if (immediate) {
      return runNativePrompt(immediate);
    }

    const chromium = isChromiumBrowser(browserName);
    if (chromium && !isIOS) {
      setIsPromptPending(true);
      try {
        const waited = await waitForNativePrompt();
        if (waited) {
          return await runNativePrompt(waited);
        }
      } finally {
        setIsPromptPending(false);
      }
    }

    // Fallback: instructions for iOS / unsupported / not yet eligible
    setShowInstallModal(true);
    return false;
  }, [
    deferredPrompt,
    browserName,
    isIOS,
    waitForNativePrompt,
    runNativePrompt,
  ]);

  const dismissBanner = React.useCallback(() => {
    setIsBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const hasNativePrompt = Boolean(deferredPrompt);
  const isChromium = isChromiumBrowser(browserName);

  const value: PWAContextValue = React.useMemo(
    () => ({
      isInstallable:
        hasNativePrompt ||
        isInstallable ||
        isPromptPending ||
        (isIOS && !isStandalone) ||
        (isChromium && !isStandalone && !isInstalled),
      isInstalled,
      isIOS,
      isAndroid,
      isMac,
      isWindows,
      isDesktop,
      isStandalone,
      browserName,
      platformName,
      hasNativePrompt,
      isPromptPending,
      isChromium,
      isBannerDismissed,
      showInstallModal,
      setShowInstallModal,
      promptInstall,
      dismissBanner,
    }),
    [
      hasNativePrompt,
      isInstallable,
      isPromptPending,
      isInstalled,
      isIOS,
      isAndroid,
      isMac,
      isWindows,
      isDesktop,
      isStandalone,
      browserName,
      platformName,
      isChromium,
      isBannerDismissed,
      showInstallModal,
      promptInstall,
      dismissBanner,
    ]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}
