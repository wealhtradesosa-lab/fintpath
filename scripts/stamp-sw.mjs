// ════════════════════════════════════════════════════════════════════════════
// stamp-sw.mjs — Sella dist/sw.js con una versión única por build.
//
// CAUSA RAÍZ (23-jul-2026, Santiago: "no veo que al cambiar el mes cambie la
// nota" — estaba viendo código viejo pese a que producción ya tenía el fix):
//   El navegador detecta una actualización del Service Worker comparando
//   BYTE A BYTE el /sw.js servido contra el instalado. public/sw.js se copia
//   verbatim a dist/ y su CACHE_VERSION estaba hardcodeada desde el 5-may-2026,
//   así que sw.js era IDÉNTICO en cada deploy. Resultado: nunca se disparaba
//   'updatefound' → nunca skipWaiting → nunca 'controllerchange' → nunca el
//   reload automático. Los usuarios (sobre todo con la PWA instalada o pestañas
//   de larga vida) se quedaban corriendo el bundle viejo indefinidamente,
//   aunque el deploy en Netlify estuviera correcto.
//
// FIX: tras cada `vite build`, reescribir CACHE_VERSION con un valor único
// (timestamp del build). Así sw.js cambia siempre → el navegador detecta el
// SW nuevo → la maquinaria de auto-update que ya existe en PWAInstallPrompt
// (skipWaiting + controllerchange + reload) por fin funciona como fue diseñada.
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SW_PATH = "dist/sw.js";

if (!existsSync(SW_PATH)) {
  console.warn("[stamp-sw] dist/sw.js no existe — nada que sellar.");
  process.exit(0);
}

const src = readFileSync(SW_PATH, "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const RX = /const CACHE_VERSION = "[^"]*";/;

if (!RX.test(src)) {
  // No abortamos el build por esto, pero avisamos fuerte: sin sello volvemos
  // al bug de "usuarios congelados en la versión vieja".
  console.warn("[stamp-sw] ⚠️  No se encontró CACHE_VERSION en dist/sw.js — SW NO sellado.");
  process.exit(0);
}

const out = src.replace(RX, `const CACHE_VERSION = "build-${stamp}";`);
writeFileSync(SW_PATH, out);
console.log(`[stamp-sw] ✅ Service Worker sellado: build-${stamp}`);
