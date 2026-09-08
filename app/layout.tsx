import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { ReadingTextSizeProvider } from "@/components/reading-text-size-provider";
import { AppProviders } from "@/components/providers/app-providers";
import { AppClerkProvider } from "@/components/providers/clerk-provider";
import { PWAProvider } from "@/components/pwa/pwa-provider";
import { PWAInstallBanner } from "@/components/pwa/install-banner";
import { PWAInstallDialog } from "@/components/pwa/install-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: {
    default: "TypeReact — Evidence-Based Discussion & Accountability",
    template: "%s | TypeReact",
  },
  description:
    "Where ideas are challenged through evidence. Analyze, debate, and document public content with evidence-based arguments.",
  applicationName: "TypeReact",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TypeReact",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TypeReact" />
        <meta name="application-name" content="TypeReact" />
        <meta name="theme-color" content="#E83F00" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.__pwaPrompt = null;
                window.__pwaPromptListeners = [];
                window.addEventListener('beforeinstallprompt', function(e) {
                  e.preventDefault();
                  window.__pwaPrompt = e;
                  if (window.__pwaPromptListeners && window.__pwaPromptListeners.length) {
                    window.__pwaPromptListeners.forEach(function(listener) {
                      try { listener(e); } catch (err) {}
                    });
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className="flex min-h-full min-w-0 flex-col overflow-x-hidden">
        <AppClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <LocaleProvider>
              <ReadingTextSizeProvider>
                <AppProviders>
                  <PWAProvider>
                    <TooltipProvider delayDuration={200}>
                      {children}
                      <PWAInstallBanner />
                      <PWAInstallDialog />
                    </TooltipProvider>
                    <Toaster />
                  </PWAProvider>
                </AppProviders>
              </ReadingTextSizeProvider>
            </LocaleProvider>
          </ThemeProvider>
        </AppClerkProvider>
      </body>
    </html>
  );
}
