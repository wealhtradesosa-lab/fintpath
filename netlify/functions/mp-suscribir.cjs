// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Mercado Pago — crear suscripción (cobro automático en pesos)
//
// 25-oct-2026 (Santiago: "hagamos que todo funcione automático… ¿no es mejor
// cobro automático?"). Crea una suscripción (preapproval) de Mercado Pago a
// nombre del usuario con sesión y devuelve el link donde la autoriza con su
// tarjeta. Mercado Pago cobra solo cada mes. El aviso de pago llega a
// mp-webhook, que activa el plan.
//
// ENV (Netlify):
//   MP_ACCESS_TOKEN   (obligatoria) token de producción de Mercado Pago
//   MP_PRECIO_BASICO / MP_PRECIO_BASICO_ANUAL  (opcional) 14900 / 149000 COP
//   MP_PRECIO_PRO    / MP_PRECIO_PRO_ANUAL     (opcional) 24900 / 249000 COP
//   Body: { plan: "basico"|"pro", ciclo: "mensual"|"anual" }
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers, "Inicia sesión para suscribirte.");
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: "mp_no_configurado" }) };
  if (!quien.email) return { statusCode: 400, headers, body: JSON.stringify({ error: "Tu cuenta no tiene correo." }) };

  let ciclo = "mensual", planPedido = "pro";
  try {
    const q = JSON.parse(event.body || "{}");
    ciclo = q.ciclo === "anual" ? "anual" : "mensual";
    planPedido = q.plan === "basico" ? "basico" : "pro";
  } catch { /* por defecto Pro mensual */ }
  // Precios en COP. Deben coincidir con src/lib/plans.js (PRECIOS_COP).
  const PRECIOS_COP = {
    basico: { mensual: Number(process.env.MP_PRECIO_BASICO) || 14900, anual: Number(process.env.MP_PRECIO_BASICO_ANUAL) || 149000 },
    pro: { mensual: Number(process.env.MP_PRECIO_PRO) || 24900, anual: Number(process.env.MP_PRECIO_PRO_ANUAL) || 249000 },
  };
  const precio = PRECIOS_COP[planPedido][ciclo];
  const nombre = planPedido === "basico" ? "Básico" : "Pro";
  const body = {
    reason: `FINPATHIA ${nombre} — ${ciclo === "anual" ? "anual (un cobro al año)" : "mensual"}`,
    // "userId|plan": el webhook lee de aquí qué plan activar.
    external_reference: `${quien.id}|${planPedido}`,
    payer_email: quien.email,
    // Anual = un solo cobro cada 12 meses.
    auto_recurring: { frequency: ciclo === "anual" ? 12 : 1, frequency_type: "months", transaction_amount: precio, currency_id: "COP" },
    back_url: "https://finpathia.com/?mp=ok",
    status: "pending",
  };
  try {
    const r = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || !d.init_point) {
      console.error("[mp-suscribir] error", r.status, JSON.stringify(d).slice(0, 500));
      return { statusCode: 502, headers, body: JSON.stringify({ error: d.message || "No se pudo crear la suscripción" }) };
    }
    console.log(`[mp-suscribir] preapproval ${d.id} para ${quien.id}`);
    return { statusCode: 200, headers, body: JSON.stringify({ url: d.init_point, id: d.id }) };
  } catch (e) {
    console.error("[mp-suscribir] excepción", e?.message || e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Error creando la suscripción" }) };
  }
};
