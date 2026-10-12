// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · track-activation — evento "activation" (una vez por persona)
//
// Activación = la persona cargó al menos un ingreso Y un egreso, o sea, ya
// hay un nivel de libertad calculado. Lo detecta el NAVEGADOR (App.jsx),
// porque el servidor no puede leer los datos cifrados. El navegador manda
// SOLO la bandera, con las UTM y el ángulo de entrada: ningún dato, monto
// ni nivel.
//
// El servidor:
//   1. Verifica la sesión (Authorization: Bearer <token de Supabase>).
//   2. Marca accounts.activated_at SOLO si estaba vacío (idempotente: una
//      vez por persona en toda su vida), y guarda entry_utm / entry_angle.
//   3. Si esta llamada fue la que lo marcó, emite "activation" por GA4
//      Measurement Protocol (si hay GA4_API_SECRET) o lo deja en el log.
//
// Como el cliente es el que dice "ya activé", alguien podría marcarse a sí
// mismo antes de tiempo. El único efecto es recibir la variante d2_activado
// en vez de d2_sin_activar y un evento de más en GA4: riesgo aceptable.
//
// ENV: SUPABASE_URL / VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY · GA4_API_SECRET (opcional)
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
const { emitirEvento, clientIdDesdeCookie, limpiarUtm, limpiarAngulo } = require("../lib/ga4.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) };

  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers);

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const utm = limpiarUtm(body.utm);
  const angulo = limpiarAngulo(body.angle);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "config" }) };

  try {
    // PATCH condicional: solo filas con activated_at vacío. Si devuelve filas,
    // esta llamada fue la primera.
    const r = await fetch(
      `${url}/rest/v1/accounts?owner_user_id=eq.${encodeURIComponent(quien.id)}&activated_at=is.null`,
      {
        method: "PATCH",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json", Prefer: "return=representation",
        },
        body: JSON.stringify({
          activated_at: new Date().toISOString(),
          entry_utm: Object.keys(utm).length ? utm : null,
          entry_angle: angulo,
        }),
      }
    );
    if (!r.ok) {
      console.error("[track-activation] PATCH accounts falló:", r.status, await r.text());
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
    }
    const filas = await r.json();
    const primera = Array.isArray(filas) && filas.length > 0;
    if (primera) {
      await emitirEvento({
        nombre: "activation",
        clientId: clientIdDesdeCookie(event.headers?.cookie || event.headers?.Cookie),
        utm, angulo,
      });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, primera }) };
  } catch (e) {
    console.error("[track-activation] error:", e?.message || e);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
  }
};
