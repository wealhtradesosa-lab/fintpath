/**
 * _auth — Identidad verificada del usuario que llama a una función.
 *
 * 28-sep-2026. Hasta hoy las funciones creían lo que el navegador les decía:
 * admin-metrics y admin-fix-plans autorizaban por un correo en el cuerpo de
 * la petición (el de Santiago es público); ai-chat, agente-tributario-ia y
 * analyze-excel no pedían nada; analyze-image y parse-declaration tomaban el
 * userId del cuerpo y lo usaban para descontar cuota.
 *
 * Ahora el navegador manda el access token de Supabase en Authorization y
 * esta función le pregunta a Supabase Auth de quién es. Un token falso o
 * vencido devuelve null. Lo que viene en el cuerpo (userId, email) ya no
 * decide nada.
 */
async function usuarioDesdeToken(event) {
  const raw = event.headers?.authorization || event.headers?.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("[_auth] SUPABASE_URL/SUPABASE_SERVICE_KEY faltantes");
    return null;
  }
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    return { id: u.id, email: String(u.email || "").toLowerCase() };
  } catch (e) {
    console.error("[_auth] error verificando token:", e?.message || e);
    return null;
  }
}

const ADMINS = ["santiagososa1@me.com", "ajimenez001@gmail.com"];
const esAdmin = (u) => !!u && ADMINS.includes(u.email);

const sinSesion = (headers, mensaje = "Iniciá sesión para usar esta función.") => ({
  statusCode: 401, headers,
  body: JSON.stringify({ error: "sesion_requerida", mensaje }),
});

module.exports = { usuarioDesdeToken, esAdmin, sinSesion, ADMINS };
