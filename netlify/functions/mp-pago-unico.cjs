// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Mercado Pago — pago único (PSE, Efecty, tarjeta, saldo MP)
//
// 5-nov-2026 (Santiago: "¿podemos crear un pago único anual que puedan pagar
// por PSE?"). Las suscripciones automáticas (mp-suscribir) solo aceptan
// tarjeta. Esta función crea un pago de una sola vez con Checkout Pro, que en
// Colombia acepta PSE, Efecty, tarjeta y saldo de Mercado Pago. No se renueva
// solo: el aviso del pago llega a mp-webhook, que activa el plan por 1 o 12
// meses (activar_pago_unico) y la app avisa antes de vencer.
//
// ENV: MP_ACCESS_TOKEN y los MP_PRECIO_* de mp-suscribir (mismos precios).
// Body: { plan: "basico"|"pro"|"pro_familiar", meses: 1|12 }
// ═══════════════════════════════════════════════════════════════════════════
const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
const { errorParaLog } = require("../lib/logSeguro.cjs");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  const quien = await usuarioDesdeToken(event);
  if (!quien) return sinSesion(headers, "Inicia sesión para pagar.");
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: "mp_no_configurado" }) };

  let meses = 12, plan = "pro";
  try {
    const q = JSON.parse(event.body || "{}");
    meses = Number(q.meses) === 1 ? 1 : 12;
    plan = ["basico", "pro", "pro_familiar"].includes(q.plan) ? q.plan : "pro";
  } catch { /* por defecto Pro anual */ }
  // Mismos precios que la suscripción (src/lib/plans.js · PRECIOS_COP).
  const PRECIOS_COP = {
    basico: { 1: Number(process.env.MP_PRECIO_BASICO) || 14900, 12: Number(process.env.MP_PRECIO_BASICO_ANUAL) || 149000 },
    pro: { 1: Number(process.env.MP_PRECIO_PRO) || 24900, 12: Number(process.env.MP_PRECIO_PRO_ANUAL) || 249000 },
    pro_familiar: { 1: Number(process.env.MP_PRECIO_FAMILIAR) || 44900, 12: Number(process.env.MP_PRECIO_FAMILIAR_ANUAL) || 449000 },
  };
  const precio = PRECIOS_COP[plan][meses];
  const nombre = { basico: "Básico", pro: "Pro", pro_familiar: "Pro Familiar" }[plan];
  const titulo = `FINPATHIA ${nombre} — ${meses === 12 ? "1 año" : "1 mes"} (pago único)`;
  const body = {
    items: [{ id: `${plan}_${meses}m`, title: titulo, quantity: 1, unit_price: precio, currency_id: "COP" }],
    // "userId|plan|unico|meses": el webhook lee de aquí qué activar y por cuánto.
    external_reference: `${quien.id}|${plan}|unico|${meses}`,
    ...(quien.email ? { payer: { email: quien.email } } : {}),
    back_urls: { success: "https://finpathia.com/?mp=ok", pending: "https://finpathia.com/?mp=pendiente", failure: "https://finpathia.com/?mp=error" },
    auto_return: "approved",
    notification_url: "https://finpathia.com/api/mp-webhook",
    statement_descriptor: "FINPATHIA",
    // Un solo pago, sin cuotas: lo que se cobra es lo que se ve.
    payment_methods: { installments: 1 },
    // El link vence en 2 días (Efecty da tiempo para pagar en efectivo).
    expires: true,
    expiration_date_to: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
  };
  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || !d.init_point) {
      console.error("[mp-pago-unico] error", r.status, JSON.stringify(d).slice(0, 500));
      return { statusCode: 502, headers, body: JSON.stringify({ error: d.message || "No se pudo crear el pago" }) };
    }
    console.log(`[mp-pago-unico] preferencia ${d.id} ${plan} ${meses}m para ${quien.id}`);
    return { statusCode: 200, headers, body: JSON.stringify({ url: d.init_point, id: d.id }) };
  } catch (e) {
    console.error("[mp-pago-unico] excepción", errorParaLog(e));
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Error creando el pago" }) };
  }
};
