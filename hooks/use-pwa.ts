"use client";

import * as React from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type DetectedBrowser =
  | "chrome"
  | "edge"
  | "safari"
  | "firefox"
  | "brave"
  | "opera"
  | "samsung"
  | "other";

export type DetectedPlatform =
  | "windows"
  | "mac"
  | "linux"
  | "ios"
  | "android"
  | "other";

export interface PWAContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMac: boolean;
  isWindows: boolean;
  isDesktop: boolean;
  isStandalone: boolean;
  browserName: DetectedBrowser;
  platformName: DetectedPlatform;
  hasNativePrompt: boolean;
  isPromptPending: boolean;
  isChromium: boolean;
  isBannerDismissed: boolean;
  showInstallModal: boolean;
  setShowInstallModal: (show: boolean) => void;
  promptInstall: () => Promise<boolean>;
  dismissBanner: () => void;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
    __pwaPromptListeners?: Array<(e: BeforeInstallPromptEvent) => void>;
  }
}

export function detectBrowser(ua: string): DetectedBrowser {
  const lower = ua.toLowerCase();
  if (lower.includes("edg/")) return "edge";
  if (lower.includes("opr/") || lower.includes("opera")) return "opera";
  if (lower.includes("brave")) return "brave";
  if (lower.includes("samsungbrowser")) return "samsung";
  if (lower.includes("firefox") || lower.includes("fxios")) return "firefox";
  if (lower.includes("chrome") || lower.includes("crios")) return "chrome";
  if (lower.includes("safari") && !lower.includes("chrome")) return "safari";
  return "other";
}

export function isChromiumBrowser(browser: DetectedBrowser): boolean {
  return (
    browser === "chrome" ||
    browser === "edge" ||
    browser === "brave" ||
    browser === "opera" ||
    browser === "samsung"
  );
}

export function detectPlatform(
  ua: string,
  platform: string,
  maxTouchPoints: number
): DetectedPlatform {
  const lower = ua.toLowerCase();
  if (
    /iphone|ipad|ipod/.test(lower) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/android/.test(lower)) return "android";
  if (/win/.test(platform.toLowerCase()) || /windows/.test(lower)) {
    return "windows";
  }
  if (/mac/.test(platform.toLowerCase()) || /macintosh/.test(lower)) {
    return "mac";
  }
  if (/linux/.test(platform.toLowerCase()) || /linux/.test(lower)) {
    return "linux";
  }
  return "other";
}

export const PWAContext = React.createContext<PWAContextValue | null>(null);

export function usePWA(): PWAContextValue {
  const context = React.useContext(PWAContext);
  if (!context) {
    return {
      isInstallable: false,
      isInstalled: false,
      isIOS: false,
      isAndroid: false,
      isMac: false,
      isWindows: false,
      isDesktop: true,
      isStandalone: false,
      browserName: "chrome",
      platformName: "windows",
      hasNativePrompt: false,
      isPromptPending: false,
      isChromium: true,
      isBannerDismissed: true,
      showInstallModal: false,
      setShowInstallModal: () => {},
      promptInstall: async () => false,
      dismissBanner: () => {},
    };
  }
  return context;
}
