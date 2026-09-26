// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Helpers compartidos Stripe ↔ usuario (no es un endpoint).
//
// 26-sep-2026 — Seguridad de pagos. Reglas:
//   · El usuario SIEMPRE sale del token de Supabase (usuarioDesdeToken).
//   · Un customer de Stripe solo se asocia a un usuario por IDs que pone el
//     SERVIDOR: metadata.userId del customer o de la suscripción, o
//     client_reference_id / metadata.userId de una Checkout Session completa.
//     NUNCA por email: auth-signup crea usuarios con email_confirm:true, así
//     que el email no está verificado y cualquiera podría registrarse con el
//     correo de otra persona.
//   · user_data.stripe_customer_id (lo escribe el webhook) se usa primero,
//     pero se descarta si Stripe dice que ese customer es de OTRO usuario
//     (la RLS actual deja al usuario editar su fila; ver la migración
//     supabase/migrations/20260926_protect_plan.sql).
// ═══════════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS_VIGENTES = new Set(["active", "trialing", "past_due", "unpaid"]);

async function usuarioDesdeToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return { error: "Falta el token de sesión", status: 401 };
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "Supabase no configurado en el servidor", status: 500 };
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${m[1]}` },
    });
    if (!r.ok) return { error: "Sesión inválida o vencida", status: 401 };
    const user = await r.json();
    if (!user || !user.id || !UUID_RE.test(user.id)) return { error: "Sesión inválida o vencida", status: 401 };
    return { user, token: m[1] };
  } catch (e) {
    return { error: "No se pudo validar la sesión: " + e.message, status: 502 };
  }
}

// stripe_customer_id guardado por el webhook (puede no existir).
async function customerIdGuardado(userId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !UUID_RE.test(userId)) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/user_data?id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] && rows[0].stripe_customer_id) || null;
  } catch {
    return null;
  }
}

// ¿El customer guardado es del usuario? "si" | "no" | "sin_evidencia".
//   si  → customer.metadata.userId o alguna suscripción lleva ese userId.
//   no  → lleva el userId de OTRA persona (se rechaza).
//   sin_evidencia → customer viejo sin metadata (anterior a #25).
async function pertenenciaCustomer(stripe, customerId, userId) {
  try {
    const c = await stripe.customers.retrieve(customerId);
    if (!c || c.deleted) return "no";
    const metaC = c.metadata && c.metadata.userId;
    if (metaC) return metaC === userId ? "si" : "no";
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    const ids = subs.data.map((s) => s.metadata && s.metadata.userId).filter(Boolean);
    if (ids.includes(userId)) return "si";
    if (ids.length) return "no";
    return "sin_evidencia";
  } catch {
    return "no";
  }
}

// Sesiones de Checkout completas cuyo client_reference_id (o metadata.userId,
// que también pone el servidor) es userId. Stripe no tiene búsqueda de
// sesiones: se recorren las más recientes (hasta `maxPaginas` × 100).
async function customerDesdeSesiones(stripe, userId, maxPaginas = 5) {
  let starting_after;
  for (let i = 0; i < maxPaginas; i++) {
    const ses = await stripe.checkout.sessions.list({ status: "complete", limit: 100, ...(starting_after ? { starting_after } : {}) });
    const s = ses.data.find((x) => x.customer && (x.client_reference_id === userId || (x.metadata && x.metadata.userId === userId)));
    if (s) return typeof s.customer === "string" ? s.customer : s.customer.id;
    if (!ses.has_more || !ses.data.length) break;
    starting_after = ses.data[ses.data.length - 1].id;
  }
  return null;
}

// Busca el customer de userId SOLO por IDs puestos por el servidor.
async function buscarCustomerPorUserId(stripe, userId) {
  if (!UUID_RE.test(userId)) return null; // también evita inyección en la query
  const q = `metadata['userId']:'${userId}'`;
  try {
    const cs = await stripe.customers.search({ query: q, limit: 1 });
    if (cs.data[0]) return cs.data[0].id;
  } catch (e) { console.warn("[stripeUsuario] customers.search:", e.message); }
  try {
    const ss = await stripe.subscriptions.search({ query: q, limit: 1 });
    if (ss.data[0]) return typeof ss.data[0].customer === "string" ? ss.data[0].customer : ss.data[0].customer?.id;
  } catch (e) { console.warn("[stripeUsuario] subscriptions.search:", e.message); }
  try {
    return await customerDesdeSesiones(stripe, userId);
  } catch (e) { console.warn("[stripeUsuario] sessions.list:", e.message); }
  return null;
}

// Escribe metadata.userId en el customer si le falta (backfill perezoso).
async function asegurarMetadataUserId(stripe, customerId, userId) {
  try {
    const c = await stripe.customers.retrieve(customerId);
    if (c && !c.deleted && !(c.metadata && c.metadata.userId)) {
      await stripe.customers.update(customerId, { metadata: { userId } });
      console.log(`[stripeUsuario] backfill metadata.userId en ${customerId}`);
    }
  } catch (e) {
    console.warn("[stripeUsuario] backfill metadata falló:", e.message);
  }
}

// Customer del usuario. Devuelve { id, verificado } o { id: null }.
// Orden:
//   1. stripe_customer_id guardado (lo escribe el webhook con service role),
//      salvo que Stripe diga que es de OTRA persona.
//   2. metadata.userId en customers / suscripciones.
//   3. Checkout Sessions completas con client_reference_id = userId.
// verificado = hay evidencia en Stripe (metadata o sesión) de que el customer
// es de este usuario; solo entonces se completa metadata.userId (backfill).
// Un id guardado SIN evidencia (customer viejo sin metadata) se devuelve con
// verificado=false: sirve para abrir el portal (compatibilidad), pero no se
// le escribe metadata ni se reutiliza para cobrar.
async function resolverCustomer(stripe, userId) {
  if (!UUID_RE.test(userId)) return { id: null };
  const guardado = await customerIdGuardado(userId);
  let sinEvidencia = null;
  if (guardado) {
    const p = await pertenenciaCustomer(stripe, guardado, userId);
    if (p === "si") { await asegurarMetadataUserId(stripe, guardado, userId); return { id: guardado, verificado: true }; }
    if (p === "no") console.warn(`[stripeUsuario] stripe_customer_id guardado de user=${userId} pertenece a otro usuario; se ignora`);
    if (p === "sin_evidencia") sinEvidencia = guardado;
  }
  const encontrado = await buscarCustomerPorUserId(stripe, userId);
  if (encontrado) {
    await asegurarMetadataUserId(stripe, encontrado, userId);
    return { id: encontrado, verificado: true };
  }
  if (sinEvidencia) {
    console.warn(`[stripeUsuario] user=${userId} usa stripe_customer_id guardado sin metadata (${sinEvidencia}); correr scripts/backfill-stripe-userid.cjs`);
    return { id: sinEvidencia, verificado: false };
  }
  return { id: null };
}

// Suscripción vigente (active/trialing/past_due/unpaid) del customer, o null.
async function suscripcionVigente(stripe, customerId) {
  if (!customerId) return null;
  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    return subs.data.find((s) => ESTADOS_VIGENTES.has(s.status)) || null;
  } catch {
    return null;
  }
}

module.exports = {
  UUID_RE,
  usuarioDesdeToken,
  customerIdGuardado,
  pertenenciaCustomer,
  customerDesdeSesiones,
  buscarCustomerPorUserId,
  asegurarMetadataUserId,
  resolverCustomer,
  suscripcionVigente,
};
