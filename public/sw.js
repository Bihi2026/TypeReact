// Service Worker for TypeReact PWA
const CACHE_NAME = "typereact-cache-v3";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/logo.png",
];

// Install Event - Pre-cache core shell & offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Pre-cache partial failure:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Ignore chrome extensions, Clerk auth internal endpoints, Convex backend WebSocket/HTTP mutations
  if (
    url.protocol.startsWith("chrome-extension") ||
    url.hostname.includes("clerk") ||
    url.hostname.includes("convex.cloud") ||
    url.hostname.includes("convex.site") ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/webhook")
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages): Network first -> Cache -> Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return offlinePage;
          }
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Offline | TypeReact</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f4f2ee; color: #111; text-align: center; padding: 20px; }
                  .card { background: white; border-radius: 12px; padding: 32px; max-width: 420px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                  h1 { color: #E83F00; font-size: 24px; margin-bottom: 8px; }
                  p { color: #555; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
                  button { background: #E83F00; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; }
                  button:hover { background: #cf3800; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>You're Offline</h1>
                  <p>Please check your internet connection to continue browsing TypeReact discussions and reactions.</p>
                  <button onclick="window.location.reload()">Retry</button>
                </div>
              </body>
            </html>`,
            {
              headers: { "Content-Type": "text/html" },
            }
          );
        })
    );
    return;
  }

  // 2. Static Next.js assets, fonts, icons, images: Cache first -> Network fallback with caching
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            return new Response(null, { status: 404, statusText: "Not Found" });
          });
      })
    );
    return;
  }

  // 3. All other requests: Network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(null, { status: 503, statusText: "Service Unavailable" });
      })
  );
});

// Listen for messages from clients (e.g. skip waiting)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
