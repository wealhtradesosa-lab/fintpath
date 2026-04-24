// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────
// Helper centralizado para emitir eventos de uso que puedan después ser
// instrumentados con GA4, Mixpanel, PostHog u otro tracker externo.
//
// DISEÑO:
// - Por defecto solo emite console.info con prefijo '[finpathia-analytics]'
// - Si window.dataLayer existe (GA4/GTM), también lo pushea allí con shape
//   { event: nombre, ...payload }
// - Si window.mixpanel.track existe, lo invoca
// - Si window.posthog.capture existe, lo invoca
// - Falla silenciosamente si no hay tracker (no rompe la UI)
//
// PRIVACIDAD:
// Nunca se envían montos o PII del contribuyente. Solo metadatos de USO:
// qué señales se activaron (sin el valor), cuántos años de historial hay,
// si el owner es natural o jurídica, etc.
// ═══════════════════════════════════════════════════════════════════════════

export function track(event, payload = {}) {
  if (typeof window === "undefined") return;

  try {
    // Log local (útil durante desarrollo y auditoría)
    if (window.console && window.console.info) {
      window.console.info("[finpathia-analytics]", event, payload);
    }

    // Guardar últimos 50 eventos en localStorage para dashboard interno
    // (ver Dashboard de observabilidad en el menú admin). Falla silenciosa
    // si localStorage está bloqueado.
    try {
      const KEY = "finpathia_analytics_recent";
      const raw = window.localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ event, payload, ts: Date.now() });
      const truncated = arr.slice(0, 50);
      window.localStorage.setItem(KEY, JSON.stringify(truncated));
    } catch { /* noop */ }

    // GA4 via gtag directo (sin GTM) — la forma nativa de enviar eventos
    // Santiago tiene configurado gtag con G-51CV6PWRLT en index.html,
    // por lo que los eventos emitidos acá aparecen en GA4 → Reports → Events.
    if (typeof window.gtag === "function") {
      window.gtag("event", event, payload);
    }

    // GA4 / Google Tag Manager via dataLayer (compat con GTM si se usa)
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...payload });
    }

    // Mixpanel si está cargado
    if (window.mixpanel && typeof window.mixpanel.track === "function") {
      window.mixpanel.track(event, payload);
    }

    // PostHog si está cargado
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture(event, payload);
    }
  } catch (e) {
    // Analytics nunca debe romper la experiencia principal
    if (window.console) window.console.warn("[finpathia-analytics] track failed:", e);
  }
}

// Helper para leer los eventos recientes del buffer local (dashboard interno)
export function getRecentEvents() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("finpathia_analytics_recent");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Helper para limpiar el buffer (útil después de exportar o debug)
export function clearRecentEvents() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("finpathia_analytics_recent");
  } catch { /* noop */ }
}
