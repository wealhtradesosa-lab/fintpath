// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Recover Activation
//
// Endpoint de fallback: si el webhook de Stripe falla/se demora, el usuario
// puede llamar a este endpoint manualmente para forzar la activación de su
// plan después de un pago exitoso. Desde el 12-oct-2026 recupera Pro
// Familiar, Pro y Básico (antes solo Pro Familiar).
//
// CASOS DE USO:
//   1. Webhook falló (env var faltante, downtime de Supabase, error temporal)
//      y Stripe agotó sus retries (3 días). El user paga pero no ve Pro
//      Familiar activado.
//   2. El user vuelve al success_url del checkout pero el webhook todavía no
//      llegó (timing race). Frontend puede llamar este endpoint para forzar
//      la activación.
//
// SEGURIDAD:
//   Para evitar abuso (un user que NO pagó intenta activarse Pro Familiar):
//   1. Verificamos vía Stripe que el customer existe Y tiene una subscription
//      activa (active/trialing) con un precio conocido.
//   2. Si viene sessionId, la session debe ser del mismo usuario
//      (metadata.userId), para que nadie use el pago de otra persona.
//   3. Pro Familiar → recover_pending_activation. Pro/Básico →
//      update_user_plan_after_stripe (también sincroniza accounts).
//
// FLUJO:
//   POST { userId, sessionId? }   ← sessionId opcional del checkout
//   - Si sessionId presente: lo usamos para sacar el customer_id directo
//   - Si NO: usamos el stripe_customer_id ya guardado en user_data
//   - Verificamos en Stripe que la subscription es activa + plan correcto
//   - Llamamos a recover_pending_activation()
//   - Retornamos { recovered: true|false, account_id, message }
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");
const { buildPriceMap, resolvePlanFromLineItems } = require("../lib/stripePrecios.cjs");

const VALID_STATUSES = ["active", "trialing"];
// Si hay varias suscripciones vivas, gana la de plan más alto.
const PRIORIDAD = { pro_familiar: 3, pro: 2, basico: 1 };

function respuesta(statusCode, obj) {
  return { statusCode, body: JSON.stringify(obj) };
}

async function rpc(supabaseUrl, supabaseKey, nombre, payload) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${nombre} failed (${res.status})`);
  try { return JSON.parse(text); } catch { return text; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return respuesta(405, { error: "Method not allowed" });
  }

  try {
    const { sessionId } = JSON.parse(event.body || "{}");
    // 28-sep-2026: el userId venia en el body; ahora sale del token verificado.
    const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    if (!quien) return sinSesion({}, "Inicia sesion para recuperar la activacion.");
    const userId = quien.id;

    if (!process.env.STRIPE_SECRET_KEY) return respuesta(500, { error: "stripe config" });
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return respuesta(500, { error: "supabase config" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceMap = buildPriceMap();

    // 1. stripe_customer_id: de la session (si es de este usuario) o de user_data
    let stripeCustomerId = null;
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
      if (session.metadata?.userId && session.metadata.userId !== userId) {
        return respuesta(403, { error: "session_ajena", message: "Esta sesión de pago no es tuya." });
      }
      if (!resolvePlanFromLineItems(session, priceMap)) {
        return respuesta(400, { error: "unknown_price", message: "Esta sesión no corresponde a un plan de Finpathia." });
      }
      stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    } else {
      const supaRes = await fetch(
        `${supabaseUrl}/rest/v1/user_data?id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`,
        { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
      );
      if (!supaRes.ok) return respuesta(500, { error: "user lookup failed" });
      const rows = await supaRes.json();
      stripeCustomerId = rows?.[0]?.stripe_customer_id;
    }
    if (!stripeCustomerId) {
      return respuesta(400, {
        error: "no_stripe_customer",
        message: "No encontramos un pago asociado. Si pagaste recién, espera unos minutos y vuelve a intentar.",
      });
    }

    // 2. Suscripción viva con precio conocido
    const subscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 10 });
    const candidatas = subscriptions.data
      .filter((sub) => VALID_STATUSES.includes(sub.status))
      .map((sub) => ({ sub, plan: resolvePlanFromLineItems(sub, priceMap) }))
      .filter((x) => x.plan)
      .sort((a, b) => PRIORIDAD[b.plan] - PRIORIDAD[a.plan]);
    if (!candidatas.length) {
      return respuesta(400, {
        error: "no_active_subscription",
        message: "No encontramos una suscripción activa para tu cuenta.",
      });
    }
    const { sub, plan } = candidatas[0];
    console.log(`[stripe-recover-activation] suscripción verificada · plan=${plan} status=${sub.status}`);

    // 3. Activar
    let result;
    if (plan === "pro_familiar") {
      const r = await rpc(supabaseUrl, supabaseKey, "recover_pending_activation", {
        p_user_id: userId,
        p_stripe_customer_id: stripeCustomerId,
      });
      result = Array.isArray(r) ? r[0] : r;
    } else {
      const ok = await rpc(supabaseUrl, supabaseKey, "update_user_plan_after_stripe", {
        p_user_id: userId,
        p_plan: plan,
        p_stripe_customer_id: stripeCustomerId,
      });
      result = { recovered: ok === true, message: ok === true ? "recovered" : "user_not_found" };
    }
    console.log(`[stripe-recover-activation] ✅ plan=${plan} recovered=${result?.recovered}`);
    return respuesta(200, { ok: true, plan, result });
  } catch (err) {
    console.error("[stripe-recover-activation] error:", err?.message);
    return respuesta(500, { error: "recover_failed" });
  }
};
