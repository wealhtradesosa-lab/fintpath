// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · sw.js — SERVICE WORKER DE RETIRADA (9-oct-2026)
//
// Santiago: "varias veces he bajado e instalado el PWA en mi celular y en mi
// computador; funciona bien un par de veces y luego pantalla en blanco".
// Un par de veces = hasta el siguiente deploy. El service worker guardaba la
// app localmente; en cada deploy los archivos con hash cambian de nombre y la
// copia local quedaba apuntando a archivos que ya no existen. Como FINPATHIA
// sin internet no sirve (todo vive en Supabase), la caché offline solo
// aportaba este problema.
//
// Este archivo existe únicamente para que los dispositivos que YA tienen un
// service worker instalado lo reemplacen por este, que:
//   1. borra todas las cachés de la app,
//   2. se desinstala a sí mismo,
//   3. recarga las pestañas/ventanas abiertas para que carguen limpio.
// La app ya no registra service workers nuevos (PWAInstallPrompt). Sigue
// siendo instalable: el manifest basta.
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) {}
  })());
});

// Sin handler de fetch: nada pasa por acá. El navegador va directo a la red.
