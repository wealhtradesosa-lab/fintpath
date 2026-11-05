// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Mi suscripción: ver cómo pago y cancelar en un toque
//
// 5-nov-2026 (Santiago: "me gustan las páginas que le permiten a uno salir de
// las suscripciones fácilmente"). Quien paga por Mercado Pago no tenía cómo
// cancelar desde la app: el botón solo abría el portal de Stripe.
//
//   POST { accion: "ver" }      → { via: "mercado_pago" | "pago_unico" | "stripe" | null, hasta }
//   POST { accion: "cancelar" } → Mercado Pago: cancela la suscripción (no se
//                                 vuelve a cobrar) y deja acceso hasta el fin
//                                 del periodo de gracia. Stripe: { via: "stripe" }
//                                 para que la app abra su portal.
//
// La identidad sale del token de sesión; el id de la suscripción, de la base.
// ENV: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY.
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
const { errorParaLog } = require("../lib/logSeguro.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  const res = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });
  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers, "Inicia sesión para administrar tu suscripción.");
  let accion = "ver";
  try { accion = JSON.parse(event.body || "{}").accion === "cancelar" ? "cancelar" : "ver"; } catch { /* ver */ }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    const r = await fetch(`${url}/rest/v1/user_data?id=eq.${quien.id}&select=stripe_customer_id,account_id`, { headers: h });
    const fila = r.ok ? (await r.json())[0] : null;
    const cid = String(fila?.stripe_customer_id || "");
    let cuenta = null;
    if (fila?.account_id) {
      const ra = await fetch(`${url}/rest/v1/accounts?id=eq.${fila.account_id}&select=subscription_status,grace_until`, { headers: h });
      cuenta = ra.ok ? (await ra.json())[0] : null;
    }
    const via = cid.startsWith("mp_pago_") ? "pago_unico" : cid.startsWith("mp_") ? "mercado_pago" : cid.startsWith("cus_") ? "stripe" : null;
    const cancelada = cuenta?.subscription_status === "canceled";
    // 5-nov-2026: con Mercado Pago, "ver" trae también el monto y el próximo cobro, para que
    // Mi cuenta diga exactamente qué se va a cobrar y cuándo.
    let detalle = null;
    if (via === "mercado_pago" && accion === "ver" && process.env.MP_ACCESS_TOKEN) {
      try {
        const rp = await fetch(`https://api.mercadopago.com/preapproval/${cid.slice(3)}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
        if (rp.ok) {
          const p = await rp.json();
          detalle = { estadoMP: p.status, monto: p?.auto_recurring?.transaction_amount || null, frecuencia: p?.auto_recurring?.frequency || 1, proximoCobro: p.status === "authorized" ? p.next_payment_date || null : null };
        }
      } catch { /* sin detalle */ }
    }
    if (accion === "ver" || via !== "mercado_pago") return res(200, { via, cancelada, hasta: cuenta?.grace_until || null, ...(detalle || {}) });

    // Cancelar en Mercado Pago: no se vuelve a cobrar. El aviso de MP también
    // llega a mp-webhook; handle_subscription_canceled es idempotente.
    const preId = cid.slice(3);
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res(503, { error: "mp_no_configurado" });
    const rm = await fetch(`https://api.mercadopago.com/preapproval/${preId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!rm.ok) {
      const d = await rm.text();
      // Si ya estaba cancelada en MP, se sigue: lo importante es que no cobre.
      if (!/cancel/i.test(d)) {
        console.error("[mi-suscripcion] MP cancelar", rm.status, d.slice(0, 300));
        return res(502, { error: "No pudimos cancelar en Mercado Pago. Escríbenos a soporte@finpathia.com y lo hacemos de inmediato." });
      }
    }
    await fetch(`${url}/rest/v1/rpc/handle_subscription_canceled`, { method: "POST", headers: h, body: JSON.stringify({ p_stripe_customer_id: cid, p_canceled_at: new Date().toISOString() }) });
    const ra = await fetch(`${url}/rest/v1/accounts?id=eq.${fila.account_id}&select=grace_until`, { headers: h });
    const hasta = ra.ok ? (await ra.json())[0]?.grace_until || null : null;
    console.log(`[mi-suscripcion] suscripción MP ${preId} cancelada por el usuario`);
    return res(200, { via, cancelada: true, hasta });
  } catch (e) {
    console.error("[mi-suscripcion] error", errorParaLog(e));
    return res(500, { error: "Error consultando tu suscripción" });
  }
};
