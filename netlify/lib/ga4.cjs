// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Eventos de embudo desde el SERVIDOR (activation, advisor_used)
//
// Se mandan por el Measurement Protocol de GA4 SOLO si existe GA4_API_SECRET.
// Si no, solo se registran en el log de Netlify.
//
// PRIVACIDAD: los parámetros pasan por una lista blanca: utm_* y el ángulo
// de entrada. Nunca montos, nivel, correo, user_id ni el texto de una pregunta.
// El client_id es el de la cookie _ga del navegador (el mismo visitante que
// GA ya conoce), NUNCA el id de Supabase.
// ═══════════════════════════════════════════════════════════════════════════
const MEASUREMENT_ID_DEFECTO = "G-51CV6PWRLT";
const CLAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const limpiarTexto = (v, max = 100) =>
  typeof v === "string" ? v.replace(/[^\w .:/@+-]/g, "").trim().slice(0, max) || null : null;

/** Deja solo utm_* válidos. */
function limpiarUtm(utm) {
  const out = {};
  if (!utm || typeof utm !== "object") return out;
  for (const k of CLAVES_UTM) {
    const v = limpiarTexto(utm[k]);
    if (v) out[k] = v;
  }
  return out;
}

/** Ángulo de entrada (ej. "renta:declaracion", "pioneros"). */
const limpiarAngulo = (a) => limpiarTexto(a, 60);

/** "_ga=GA1.1.123456.789" → "123456.789". null si no hay cookie. */
function clientIdDesdeCookie(cookieHeader) {
  const m = /(?:^|;\s*)_ga=([^;]+)/.exec(String(cookieHeader || ""));
  if (!m) return null;
  const partes = decodeURIComponent(m[1]).split(".");
  if (partes.length < 4) return null;
  const cid = `${partes[partes.length - 2]}.${partes[partes.length - 1]}`;
  return /^\d+\.\d+$/.test(cid) ? cid : null;
}

/**
 * Emite un evento. Nunca lanza: devuelve { enviado, motivo }.
 * params se filtra a utm_* + entry_angle.
 */
async function emitirEvento({ nombre, clientId, utm, angulo }) {
  try {
    const params = { ...limpiarUtm(utm) };
    const ang = limpiarAngulo(angulo);
    if (ang) params.entry_angle = ang;

    const secreto = process.env.GA4_API_SECRET;
    if (!secreto) {
      console.log(`[evento] ${nombre} (solo log, sin GA4_API_SECRET)`, params);
      return { enviado: false, motivo: "sin_secreto" };
    }
    if (!clientId) {
      console.log(`[evento] ${nombre} (solo log, sin cookie _ga)`, params);
      return { enviado: false, motivo: "sin_client_id" };
    }
    const mid = process.env.GA4_MEASUREMENT_ID || MEASUREMENT_ID_DEFECTO;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secreto)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, events: [{ name: nombre, params }] }),
        signal: ctrl.signal,
      }
    ).finally(() => clearTimeout(timer));
    console.log(`[evento] ${nombre} → GA4 status=${r.status}`, params);
    return { enviado: r.ok, motivo: r.ok ? "ok" : `status_${r.status}` };
  } catch (e) {
    console.warn(`[evento] ${nombre} falló:`, e?.message || e);
    return { enviado: false, motivo: "excepcion" };
  }
}

module.exports = { emitirEvento, clientIdDesdeCookie, limpiarUtm, limpiarAngulo };
