/**
 * service-worker.js — EthioStudy offline caching strategy
 *
 * Strategy:
 *  - App shell (HTML, CSS, JS) → Cache-First (versioned cache)
 *  - API requests              → Network-First with cache fallback
 *  - Google Fonts              → Stale-While-Revalidate
 *
 * On activation:
 *  - Old caches are purged so users always get the latest assets.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `ethiostudy-shell-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `ethiostudy-dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `ethiostudy-fonts-${CACHE_VERSION}`;

/* ─── Assets to pre-cache on install ────────────────────────────────────── */
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/dashboard.html",
  "/css/styles.css",
  "/js/api.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/db.js",
  "/js/offline.js",
  "/js/sync.js",
  "/js/tasks.js",
  "/js/timer.js",
  "/manifest.json",
];

/* ─── Install ────────────────────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ─── Activate ───────────────────────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  const allowedCaches = [SHELL_CACHE, DYNAMIC_CACHE, FONT_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !allowedCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch ──────────────────────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== "GET") return;
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Intercept and normalize clean navigation routes to match cached assets
  let modifiedRequest = event.request;
  if (event.request.mode === "navigate") {
    if (url.pathname === "/dashboard") {
      modifiedRequest = new Request("/dashboard.html");
    } else if (url.pathname === "/login") {
      modifiedRequest = new Request("/login.html");
    } else if (url.pathname === "/register") {
      modifiedRequest = new Request("/register.html");
    }
  }

  // Pass the modifiedRequest down to your caching strategies
  if (url.pathname.startsWith("/api/")) {
    // API routes use Network-First
    event.respondWith(networkFirst(modifiedRequest, DYNAMIC_CACHE));
  } else if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    // Fonts use Stale-While-Revalidate
    event.respondWith(staleWhileRevalidate(modifiedRequest, FONT_CACHE));
  } else {
    // Static app shell uses Cache-First
    event.respondWith(cacheFirst(modifiedRequest, SHELL_CACHE));
  }
});

/* ─── Strategies ─────────────────────────────────────────────────────────── */

/**
 * Cache-First: serve from cache, fallback to network, cache the response.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // No network and not cached — return offline fallback
    return offlineFallback(request);
  }
}

/**
 * Network-First: try network, cache success, fallback to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

/**
 * Stale-While-Revalidate: serve from cache immediately, update in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Add a .catch() block to handle network drops gracefully in the background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch((err) => {
      // Log a clean warning instead of crashing with an uncaught promise error
      console.log(`[Service Worker] Fetch failed in background (offline/server down) for: ${request.url}`);
    });

  return cached || fetchPromise;
}

/**
 * Offline fallback — return the cached dashboard for navigation requests.
 */
async function offlineFallback(request) {
  const url = new URL(request.url);

  // For HTML navigation requests, serve dashboard (or index)
  if (request.destination === "document") {
    const fallback =
      (await caches.match("/dashboard.html")) ||
      (await caches.match("/index.html"));
    if (fallback) return fallback;
  }

  // Generic 503 response
  return new Response(
    JSON.stringify({ error: "Offline", message: "No internet connection." }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

/* ─── Background Sync (via postMessage) ─────────────────────────────────── */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
