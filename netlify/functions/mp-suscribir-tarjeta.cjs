// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Mercado Pago — cobro automático con tarjeta, sin cuenta de MP
//
// 5-nov-2026 (Santiago: "¿cómo hacemos lo del cobro automático?", "casi nadie
// tiene cuenta en Mercado Pago"). La suscripción vieja (mp-suscribir) manda a
// la persona a Mercado Pago, que le pide iniciar sesión con el mismo correo.
// Esta usa una "suscripción con plan asociado": la tarjeta se escribe dentro
// de FINPATHIA (Card Payment Brick de Mercado Pago, la tarjeta nunca pasa por
// nuestro servidor; llega solo un token) y aquí se crea la suscripción ya
// autorizada. Mercado Pago cobra solo cada mes; mp-webhook sigue los cambios.
//
// Planes creados en Mercado Pago el 5-nov-2026 (app 1763939586954342):
//   Pro mensual $24.900 → b1afa88ce4d34d47a62e62dfa98473ca
//   Pro anual  $249.000 → 04a2146d6c7c4dc6b0b2884db2be787b
// ENV: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
//      (opcional MP_PLAN_PRO_MENSUAL / MP_PLAN_PRO_ANUAL para cambiar de plan)
// Body: { token, ciclo: "mensual"|"anual" }
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
const { errorParaLog } = require("../lib/logSeguro.cjs");

const PLANES = {
  mensual: { id: process.env.MP_PLAN_PRO_MENSUAL || "b1afa88ce4d34d47a62e62dfa98473ca", monto: 24900, frecuencia: 1 },
  anual: { id: process.env.MP_PLAN_PRO_ANUAL || "04a2146d6c7c4dc6b0b2884db2be787b", monto: 249000, frecuencia: 12 },
};

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  const res = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });
  if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });
  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers, "Inicia sesión para suscribirte.");
  if (!quien.email) return res(400, { error: "Tu cuenta no tiene correo." });
  const tokenMp = process.env.MP_ACCESS_TOKEN;
  if (!tokenMp) return res(503, { error: "mp_no_configurado" });
  let token = "", ciclo = "mensual";
  try { const q = JSON.parse(event.body || "{}"); token = String(q.token || ""); ciclo = q.ciclo === "anual" ? "anual" : "mensual"; } catch { /* sin cuerpo */ }
  if (!token) return res(400, { error: "Faltan los datos de la tarjeta." });
  const plan = PLANES[ciclo];

  try {
    const r = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenMp}`, "X-Idempotency-Key": `fp-${quien.id}-${token.slice(0, 24)}` },
      body: JSON.stringify({
        preapproval_plan_id: plan.id,
        reason: `FINPATHIA Pro — ${ciclo} (cobro automático)`,
        external_reference: `${quien.id}|pro`,
        payer_email: quien.email,
        card_token_id: token,
        auto_recurring: { frequency: plan.frecuencia, frequency_type: "months", transaction_amount: plan.monto, currency_id: "COP" },
        back_url: "https://finpathia.com/?mp=ok",
        status: "authorized",
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.id) {
      console.error("[mp-suscribir-tarjeta] error", r.status, JSON.stringify(d).slice(0, 500));
      const msg = String(d.message || "");
      const humano = /card|token|cc_rejected|rejected/i.test(msg)
        ? "Tu banco no aprobó la tarjeta. Revisa los datos o intenta con otra tarjeta, o paga con PSE."
        : "No pudimos activar el cobro automático. Intenta de nuevo o paga con PSE.";
      return res(402, { error: humano, detalle: msg.slice(0, 160) });
    }
    console.log(`[mp-suscribir-tarjeta] preapproval ${d.id} status=${d.status} para ${quien.id}`);
    // Si quedó autorizada, se activa ya (el aviso de mp-webhook hace lo mismo; la RPC es idempotente).
    if (d.status === "authorized") {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY;
      try {
        await fetch(`${url}/rest/v1/rpc/update_user_plan_after_stripe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
          body: JSON.stringify({ p_user_id: quien.id, p_plan: "pro", p_stripe_customer_id: `mp_${d.id}` }),
        });
      } catch (e) { console.error("[mp-suscribir-tarjeta] activar", errorParaLog(e)); }
    }
    return res(200, { ok: true, status: d.status, id: d.id });
  } catch (e) {
    console.error("[mp-suscribir-tarjeta] excepción", errorParaLog(e));
    return res(500, { error: "Error activando el cobro automático." });
  }
};
