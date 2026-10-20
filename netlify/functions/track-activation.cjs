// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · track-activation — eventos de embudo marcados por el navegador
// (una vez por persona cada uno). body.event elige el evento
// (netlify/lib/eventosEmbudo.cjs):
//   · "activation" (por defecto) → accounts.activated_at
//     = «primer activo cargado» (campaña Patrimonio, copy v3; reemplaza a la
//     activación por nivel, ingreso + egreso, que se eliminó).
//   · "simulator_used" → accounts.simulator_first_used_at. Primera vez que
//     abre el simulador ("sim" o "simf"). Se sigue registrando; ninguna
//     variante de la v3 depende de él.
//
// El servidor:
//   1. Verifica la sesión (Authorization: Bearer <token de Supabase>).
//   2. Solo para activation: comprueba él mismo, con la service key, que la
//      persona tiene al menos un activo en user_data (data.inv no vacío),
//      SIN leer su valor (netlify/lib/activoCargado.cjs). Si el blob está
//      cifrado no puede mirar la lista y acepta la señal del navegador.
//      Si no hay activo, no marca nada (activo:false) y el navegador
//      reintenta en la próxima carga o al siguiente guardado.
//   3. Marca la columna SOLO si estaba vacía (una vez por persona en toda su
//      vida). activation guarda también entry_utm / entry_angle.
//   4. Si esta llamada fue la que la marcó, emite el evento por GA4
//      Measurement Protocol (si hay GA4_API_SECRET) o lo deja en el log.
//      Parámetros: solo utm_* y entry_angle. Nada de user_id, correo,
//      montos ni conteos.
//
// Por qué un endpoint y no un trigger en user_data: el trigger correría en
// cada guardado del blob completo (cada 2 s de edición) y no puede emitir
// el evento de GA4 sin pg_net; el endpoint hace una sola consulta indexada
// por id cuando el navegador ve el primer activo, y deja la marca y el
// evento en el mismo sitio.
//
// ENV: SUPABASE_URL / VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY · GA4_API_SECRET (opcional)
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
const { emitirEvento, clientIdDesdeCookie, limpiarUtm, limpiarAngulo } = require("../lib/ga4.cjs");
const { resolverEvento } = require("../lib/eventosEmbudo.cjs");
const { activoCargado } = require("../lib/activoCargado.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) };

  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers);

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const ev = resolverEvento(body);
  if (!ev) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "evento_no_permitido" }) };
  const utm = limpiarUtm(body.utm);
  const angulo = limpiarAngulo(body.angle);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "config" }) };

  try {
    if (ev.evento === "activation") {
      const estado = await activoCargado({ url, key, userId: quien.id });
      if (estado === "error") return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
      if (estado === "no") return { statusCode: 200, headers, body: JSON.stringify({ ok: true, evento: ev.evento, primera: false, activo: false }) };
    }
    // PATCH condicional: solo filas con activated_at vacío. Si devuelve filas,
    // esta llamada fue la primera.
    const r = await fetch(
      `${url}/rest/v1/accounts?owner_user_id=eq.${encodeURIComponent(quien.id)}&${ev.columna}=is.null`,
      {
        method: "PATCH",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json", Prefer: "return=representation",
        },
        // entry_utm / entry_angle se guardan con la activación (la primera
        // vez que se conocen). simulator_used solo marca su columna.
        body: JSON.stringify(ev.evento === "activation"
          ? { activated_at: new Date().toISOString(), entry_utm: Object.keys(utm).length ? utm : null, entry_angle: angulo }
          : { [ev.columna]: new Date().toISOString() }),
      }
    );
    if (!r.ok) {
      console.error(`[track-activation] ${ev.evento}: PATCH accounts falló:`, r.status, await r.text());
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
    }
    const filas = await r.json();
    const primera = Array.isArray(filas) && filas.length > 0;
    if (primera) {
      await emitirEvento({
        nombre: ev.evento,
        clientId: clientIdDesdeCookie(event.headers?.cookie || event.headers?.Cookie),
        utm, angulo,
      });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, evento: ev.evento, primera }) };
  } catch (e) {
    console.error("[track-activation] error:", e?.message || e);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
  }
};
