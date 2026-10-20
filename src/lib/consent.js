// Consentimiento de cookies para /patrimonio (oct-2026).
// Meta Pixel y Google Ads/GA4 NO se cargan hasta que la persona acepta.
// GA4 va en modo de consentimiento básico: ni siquiera se descarga gtag.js
// antes del "Aceptar". Esta página no incluye esos tags en el HTML.
export const CONSENT_COOKIE = "fp_consent";
export const PIXEL_ID = "1637963763961269";
export const GA4_ID = "G-51CV6PWRLT";
export const ADS_ID = "AW-613365221";

export function getConsent(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return null;
  const m = (doc.cookie || "").match(/(?:^|;\s*)fp_consent=(granted|denied)/);
  return m ? m[1] : null;
}

export function setConsent(value, doc = typeof document !== "undefined" ? document : null) {
  if (!doc || (value !== "granted" && value !== "denied")) return;
  doc.cookie = `${CONSENT_COOKIE}=${value}; max-age=15552000; path=/; SameSite=Lax`;
}

function addScript(doc, src) {
  const s = doc.createElement("script");
  s.async = true;
  s.src = src;
  doc.head.appendChild(s);
}

// Idempotente. Solo debe llamarse con consentimiento "granted".
export function loadTrackers(win = window, doc = document) {
  if (win.__fpTrackersLoaded) return false;
  win.__fpTrackersLoaded = true;

  // Meta Pixel
  if (!win.fbq) {
    const n = (win.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!win._fbq) win._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    addScript(doc, "https://connect.facebook.net/en_US/fbevents.js");
  }
  win.fbq("init", PIXEL_ID);
  win.fbq("track", "PageView");

  // GA4 + Google Ads
  win.dataLayer = win.dataLayer || [];
  win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
  addScript(doc, `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
  win.gtag("js", new Date());
  win.gtag("config", GA4_ID, { anonymize_ip: true, send_page_view: true });
  win.gtag("config", ADS_ID);
  return true;
}

// Llamar al montar la landing: carga solo si ya había aceptado antes.
export function initConsent(win = window, doc = document) {
  if (getConsent(doc) === "granted") loadTrackers(win, doc);
  return getConsent(doc);
}
