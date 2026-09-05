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

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE FUNNEL (sesión 4-may-2026)
//
// Eventos canónicos del funnel de conversión FINPATHIA:
//   - pioneros_view: alguien abre /pioneros (auto-disparado en pioneros.html)
//   - signup_modal_opened: se abre el modal de registro
//   - signup_completed: cuenta creada exitosamente
//   - login_completed: login exitoso
//   - upgrade_modal_opened: abre modal de planes/upgrade
//   - checkout_started: click en upgrade Pro hacia Stripe
//   - checkout_completed: pago confirmado (vía webhook Stripe)
//   - feature_used: una feature key fue usada
//
// Estos helpers encapsulan eventos comunes con sus parámetros estandarizados.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identifica al usuario en GA4 con su user_id (UUID Supabase).
 * Permite conectar sesiones del mismo user en múltiples dispositivos.
 */
export function identifyUser(userId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("config", "G-51CV6PWRLT", { user_id: userId });
    }
  } catch (e) {
    if (window.console) window.console.warn("[analytics] identify failed:", e);
  }
}

/**
 * Disparado cuando se completa un signup. Captura si vino con promo
 * (campaña Pioneros) y vía qué método.
 */
export function trackSignup({ method = "email", userId } = {}) {
  const promoCode = (typeof window !== "undefined" && window.sessionStorage)
    ? window.sessionStorage.getItem("fp3_promo_code") || ""
    : "";

  // 05-sep-2026 — Intención de signup (ej. temporada de renta). Sin PII:
  // nunca dígitos de cédula. Se limpia al disparar para no contaminar
  // registros posteriores en la misma pestaña.
  let signupIntent = null;
  try {
    const raw = (typeof window !== "undefined" && window.sessionStorage)
      ? window.sessionStorage.getItem("fp3_signup_intent") : null;
    signupIntent = raw ? JSON.parse(raw) : null;
  } catch { signupIntent = null; }

  track("signup_completed", {
    method,
    with_promo: !!promoCode,
    promo_code: promoCode || undefined,
    campaign: promoCode === "PIONEROS2026" ? "pioneros_2026" : undefined,
    source: signupIntent?.source || undefined,
    intent: signupIntent?.intent || undefined,
    dias_restantes: signupIntent?.dias_restantes ?? undefined,
  });

  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("fp3_signup_intent");
    }
  } catch { /* noop */ }

  // Meta Pixel (25-jul-2026): este es EL evento por el que Meta debe optimizar
  // la pauta de Instagram. Sin él solo puede buscar clics baratos.
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "CompleteRegistration", {
      content_name: promoCode ? "signup_promo" : "signup",
      status: true,
    });
  }

  if (userId) identifyUser(userId);
}

/**
 * Disparado cuando se inicia un checkout (click upgrade hacia Stripe).
 */
export function trackCheckoutStarted({ plan, billingCycle, priceId } = {}) {
  const promoCode = (typeof window !== "undefined" && window.sessionStorage)
    ? window.sessionStorage.getItem("fp3_promo_code") || ""
    : "";

  track("checkout_started", {
    plan: plan || "unknown",
    billing_cycle: billingCycle || "monthly",
    price_id: priceId,
    with_promo: !!promoCode,
    promo_code: promoCode || undefined,
  });

  // Meta Pixel: permite medir cuántos de los registrados llegan a intentar pagar.
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "InitiateCheckout", {
      content_name: plan || "unknown",
      currency: "USD",
      value: billingCycle === "anual" ? 243 : 27,
    });
  }
}

/**
 * Lee UTMs de la URL al cargar la página y los guarda en sessionStorage.
 * Si el user vino vía `?utm_source=whatsapp&utm_campaign=pioneros`, esos
 * datos viajan en cada evento posterior — atribución de canal.
 *
 * Llamarse una vez al boot del app (en App.jsx useEffect inicial).
 */
export function captureUTMs() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });

  if (Object.keys(utm).length > 0) {
    try {
      window.sessionStorage.setItem("fp3_utm", JSON.stringify(utm));
    } catch { /* noop */ }
    track("campaign_landed", utm);
  }
}
