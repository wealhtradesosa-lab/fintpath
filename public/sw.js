// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · Service Worker — Sesión 4-may-2026
//
// Habilita capacidades PWA: instalación en celular, carga rápida, offline parcial.
//
// ESTRATEGIA DE CACHEO:
//   - App shell (HTML, CSS, JS, fuentes, íconos) → cache-first
//     → carga instantánea en visitas repetidas
//     → si no hay conexión, sigue funcionando
//   - API calls (Supabase, Stripe, Anthropic, Netlify functions) → network-only
//     → datos siempre frescos, nunca cacheados
//   - Imágenes → stale-while-revalidate
//     → carga rápida de cache, se actualiza en background
//
// VERSIONADO:
// Cuando hacemos deploy con cambios al código, incrementamos CACHE_VERSION
// (sin esto, los users seguirían viendo la versión vieja en cache hasta cerrar
// el browser). El service worker detecta el nuevo SW al arrancar y reemplaza
// el cache viejo.
// ════════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = "v3-2026-05-05-auto-update";
const CACHE_STATIC = `finpathia-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `finpathia-runtime-${CACHE_VERSION}`;

// Recursos críticos que cacheamos al instalar (app shell)
// NO incluimos /assets/*.js ni *.css porque tienen hash y se cachean dinámicamente
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/og-finpathia.jpg",
];

// ─── Install: cachear app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Install", CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Si algún asset falla, no bloqueamos la instalación
        console.warn("[SW] Algunos assets no se cachearon:", err);
      });
    }).then(() => {
      // Activar SW inmediatamente sin esperar refresh
      return self.skipWaiting();
    })
  );
});

// ─── Activate: limpiar caches viejos ─────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate", CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k.startsWith("finpathia-") && k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map((k) => {
            console.log("[SW] Eliminando cache viejo:", k);
            return caches.delete(k);
          })
      );
    }).then(() => {
      // Tomar control inmediato de todas las pestañas abiertas
      return self.clients.claim();
    })
  );
});

// ─── Fetch: estrategia por tipo de recurso ───────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear GET (POST, PUT, etc no se cachean)
  if (request.method !== "GET") return;

  // ── API calls: network-only (datos siempre frescos) ────────────────────
  // Supabase, Stripe, Anthropic, Netlify Functions, GA4
  const isApi =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("stripe.com") ||
    url.hostname.includes("anthropic.com") ||
    url.pathname.startsWith("/.netlify/functions/") ||
    url.hostname.includes("googletagmanager.com") ||
    url.hostname.includes("google-analytics.com");

  if (isApi) {
    // Solo network. Si falla, falla — no servimos datos viejos para finanzas.
    return;
  }

  // ── Navegación HTML: network-first con fallback a cache ────────────────
  // Si hay internet, sirve la versión más reciente. Si no, sirve la cacheada.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear la respuesta para uso offline
          const copy = response.clone();
          caches.open(CACHE_RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => {
          // Sin red: servir desde cache, fallback a homepage
          return caches.match(request).then((cached) => cached || caches.match("/"));
        })
    );
    return;
  }

  // ── Assets estáticos (JS, CSS, fuentes): cache-first ───────────────────
  // Estos tienen hash en el nombre (main-ABC123.js), así que el cache es seguro
  if (url.pathname.startsWith("/assets/") || url.pathname.match(/\.(js|css|woff2?|ttf)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Imágenes e íconos: stale-while-revalidate ──────────────────────────
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico)$/) || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached); // Si falla, usar cache (si existe)
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── Default: network-first, cache como fallback ────────────────────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── Mensajes desde la app (para forzar update) ──────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
