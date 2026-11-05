// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Mercado Pago — avisos de suscripción (webhook)
//
// 25-oct-2026. Mercado Pago avisa aquí cuando una suscripción se autoriza, se
// pausa o se cancela, y cuando se cobra cada mes. No se confía en el cuerpo
// del aviso: siempre se consulta la suscripción a la API de Mercado Pago con
// nuestro token (un aviso falso no puede activar un plan).
//
//   authorized            → plan "basico" o "pro" según external_reference
//                           "userId|plan" (update_user_plan_after_stripe)
//   cancelled / paused    → cancelación con periodo de gracia
//                           (handle_subscription_canceled; el cron diario baja el plan)
//   payment (pago único)  → activar_pago_unico: plan por 1 o 12 meses
//                           (referencia "userId|plan|unico|meses")
//
// El id del cliente se guarda como "mp_<preapproval_id>" en la columna de
// cliente de pago (la misma que usa Stripe), así las RPC existentes sirven.
//
// ENV: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Configurar en Mercado Pago → Tus integraciones → Webhooks:
//   URL https://finpathia.com/api/mp-webhook · eventos «Planes y suscripciones».
// ═══════════════════════════════════════════════════════════════════════════
async function rpc(nombre, payload) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`RPC ${nombre} ${r.status}: ${t}`);
  return t;
}

async function mp(path) {
  const r = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`MP ${path} ${r.status}`);
  return r.json();
}

const { errorParaLog } = require("../lib/logSeguro.cjs");
const { sendRendered } = require("./send-email.cjs");
const { correoPagoUnico } = require("../lib/correoPagoUnico.cjs");

// Correo de confirmación del pago único. Nunca tumba el webhook.
async function avisarPagoUnico({ uid, plan, meses, hasta, paymentId, email }) {
  try {
    let to = null;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    const r = await fetch(`${url}/auth/v1/admin/users/${uid}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) to = (await r.json()).email || null;
    to = to || email;
    if (!to) return;
    const m = correoPagoUnico({ tipo: "confirmacion", plan, meses, hasta });
    await sendRendered({ to, ...m, etiqueta: "pago_unico_confirmacion", idempotencyKey: `pago_unico_${paymentId}` });
  } catch (e) { console.error("[mp-webhook] correo de confirmación", errorParaLog(e)); }
}

exports.handler = async (event) => {
  const ok = { statusCode: 200, body: JSON.stringify({ received: true }) };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!process.env.MP_ACCESS_TOKEN) return { statusCode: 503, body: "mp_no_configurado" };
  let aviso = {};
  try { aviso = JSON.parse(event.body || "{}"); } catch { /* cuerpo vacío */ }
  const q = event.queryStringParameters || {};
  const tipo = aviso.type || aviso.topic || q.type || q.topic || "";
  const id = aviso?.data?.id || q["data.id"] || q.id;
  if (!id) return ok;
  try {
    // 5-nov-2026 · Pago único (mp-pago-unico: PSE, Efecty, tarjeta). Llega como
    // aviso "payment". Se consulta el pago a la API (nunca se confía en el
    // aviso) y solo se activa si está aprobado y su referencia dice "unico".
    // Los cobros mensuales de una suscripción también llegan como "payment",
    // pero su referencia no trae "unico" y se ignoran aquí.
    if (/^payment$/.test(tipo) || (tipo === "" && q.topic === "payment")) {
      const pago = await mp(`/v1/payments/${id}`);
      const [uid, planRef, marca, mesesRef] = String(pago.external_reference || "").split("|");
      if (marca !== "unico" || !uid) { console.log(`[mp-webhook] pago ${id} sin marca de pago único: ignorado`); return ok; }
      console.log(`[mp-webhook] pago único ${pago.id} status=${pago.status} user=${uid}`);
      if (pago.status !== "approved") return ok;
      const planU = ["basico", "pro", "pro_familiar"].includes(planRef) ? planRef : "pro";
      const meses = Number(mesesRef) === 1 ? 1 : 12;
      const hasta = JSON.parse(await rpc("activar_pago_unico", { p_user_id: uid, p_plan: planU, p_payment_id: String(pago.id), p_meses: meses }));
      console.log(`[mp-webhook] ✅ ${planU} pagado hasta ${hasta} para ${uid}`);
      await avisarPagoUnico({ uid, plan: planU, meses, hasta, paymentId: pago.id, email: pago?.payer?.email });
      return ok;
    }
    let preId = null;
    if (/preapproval/.test(tipo) && !/authorized_payment/.test(tipo)) preId = id;
    else if (/authorized_payment/.test(tipo)) { const pago = await mp(`/authorized_payments/${id}`); preId = pago.preapproval_id; }
    if (!preId) { console.log(`[mp-webhook] aviso ${tipo} ignorado`); return ok; }
    const s = await mp(`/preapproval/${preId}`);
    const [userId, planRef] = String(s.external_reference || "").split("|");
    const planMp = ["basico", "pro", "pro_familiar"].includes(planRef) ? planRef : "pro";
    const cliente = `mp_${s.id}`;
    console.log(`[mp-webhook] preapproval ${s.id} status=${s.status} user=${userId}`);
    if (!userId) return ok;
    if (s.status === "authorized") {
      // Pro Familiar crea la cuenta familiar (idempotente), igual que en Stripe.
      if (planMp === "pro_familiar") await rpc("activate_pro_familiar", { p_user_id: userId, p_stripe_customer_id: cliente, p_display_name: "Mi cuenta" });
      else await rpc("update_user_plan_after_stripe", { p_user_id: userId, p_plan: planMp, p_stripe_customer_id: cliente });
      console.log(`[mp-webhook] ✅ plan ${planMp} activo para ${userId}`);
    } else if (s.status === "cancelled" || s.status === "paused") {
      await rpc("handle_subscription_canceled", { p_stripe_customer_id: cliente, p_canceled_at: new Date().toISOString() });
      console.log(`[mp-webhook] suscripción ${s.status} para ${userId}`);
    }
    return ok;
  } catch (e) {
    console.error("[mp-webhook] error", errorParaLog(e));
    // 500 para que Mercado Pago reintente.
    return { statusCode: 500, body: "error" };
  }
};
