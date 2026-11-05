// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Borrar mi cuenta y mis datos
//
// 5-nov-2026 (Santiago: proceso para cuando dejan de pagar; derecho de
// supresión de la Ley 1581 de 2012). La persona borra su cuenta desde Mi
// cuenta, sin escribirle a nadie.
//
// Orden: 1) cancela cualquier cobro automático (Mercado Pago o Stripe) para
// que nada se vuelva a cobrar; 2) suelta referencias sin borrado en cascada;
// 3) borra el usuario de Supabase Auth, que borra en cascada user_data, la
// cuenta que es suya, sus miembros, invitaciones y bitácora; 4) correo de
// constancia. Si el paso 1 falla, no se borra nada.
//
// Body: { confirmacion: "BORRAR" }. La identidad sale del token de sesión.
// ENV: SUPABASE_URL, SUPABASE_SERVICE_KEY, MP_ACCESS_TOKEN, STRIPE_SECRET_KEY.
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion, esAdmin } = require("./_auth.cjs");
const { errorParaLog, uidCorto } = require("../lib/logSeguro.cjs");
const { sendRendered, emailShell } = require("./send-email.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  const res = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });
  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers, "Inicia sesión para borrar tu cuenta.");
  let conf = "";
  try { conf = String(JSON.parse(event.body || "{}").confirmacion || ""); } catch { /* vacío */ }
  if (conf.trim().toUpperCase() !== "BORRAR") return res(400, { error: "Escribe BORRAR para confirmar." });
  if (esAdmin(quien)) return res(403, { error: "La cuenta administradora no se borra desde aquí." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const uid = quien.id;
  try {
    const r = await fetch(`${url}/rest/v1/user_data?id=eq.${uid}&select=stripe_customer_id`, { headers: h });
    const cid = String((r.ok ? (await r.json())[0]?.stripe_customer_id : "") || "");

    // 1. Ningún cobro más.
    if (cid.startsWith("mp_") && !cid.startsWith("mp_pago_")) {
      const rm = await fetch(`https://api.mercadopago.com/preapproval/${cid.slice(3)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!rm.ok && !/cancel/i.test(await rm.text())) return res(502, { error: "No pudimos cancelar tu suscripción de Mercado Pago. No borramos nada. Escríbenos a soporte@finpathia.com." });
    } else if (cid.startsWith("cus_") && process.env.STRIPE_SECRET_KEY) {
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subs = await stripe.subscriptions.list({ customer: cid, status: "all", limit: 20 });
      for (const s of subs.data) {
        if (!["canceled", "incomplete_expired"].includes(s.status)) await stripe.subscriptions.cancel(s.id);
      }
    }

    // 2. Referencias sin cascada.
    await fetch(`${url}/rest/v1/advisor_invitations?used_by=eq.${uid}`, { method: "PATCH", headers: h, body: JSON.stringify({ used_by: null }) });
    await fetch(`${url}/rest/v1/ai_usage?user_id=eq.${uid}`, { method: "DELETE", headers: h });

    // 3. Borrar el usuario (cascada: user_data, cuenta propia, miembros, invitaciones, bitácora).
    const rd = await fetch(`${url}/auth/v1/admin/users/${uid}`, { method: "DELETE", headers: h });
    if (!rd.ok) {
      console.error("[borrar-cuenta] auth delete", rd.status, (await rd.text()).slice(0, 300));
      return res(500, { error: "Cancelamos los cobros pero no pudimos terminar de borrar tus datos. Escríbenos a soporte@finpathia.com y lo terminamos hoy." });
    }
    console.log(`[borrar-cuenta] ✅ cuenta ${uidCorto(uid)} borrada por su dueño`);

    // 4. Constancia por correo (no bloquea).
    if (quien.email) {
      try {
        const html = emailShell(
          `<h1 style="font-size:24px;font-weight:800;margin:0 0 16px;color:#fafafa;">Tu cuenta fue borrada</h1>
           <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">Borramos tu cuenta de FINPATHIA y toda la información que tenías guardada. No queda ningún cobro automático activo.</p>
           <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0;">Si no fuiste tú, responde este correo de inmediato.</p>`,
          { preheader: "Borramos tu cuenta y tus datos. No queda ningún cobro activo." });
        await sendRendered({ to: quien.email, subject: "Tu cuenta de FINPATHIA fue borrada", html, etiqueta: "cuenta_borrada", idempotencyKey: `borrada_${uid}` });
      } catch (e) { console.error("[borrar-cuenta] correo", errorParaLog(e)); }
    }
    return res(200, { ok: true });
  } catch (e) {
    console.error("[borrar-cuenta] error", errorParaLog(e));
    return res(500, { error: "No pudimos borrar tu cuenta. Escríbenos a soporte@finpathia.com." });
  }
};
