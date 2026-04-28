// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Recover Activation
//
// Endpoint de fallback: si el webhook de Stripe falla/se demora, el usuario
// puede llamar a este endpoint manualmente para forzar la activación de su
// Pro Familiar después de un pago exitoso.
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
//      activa Y el priceId corresponde a Pro Familiar.
//   2. Solo si todo eso es true, llamamos a la RPC recover_pending_activation.
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

const PRO_FAMILIAR_PLANS = ["pro_familiar"];
const VALID_STATUSES = ["active", "trialing"];

function buildPriceMap() {
  const map = {};
  const add = (envVar, plan) => {
    const id = process.env[envVar];
    if (id) map[id] = plan;
  };
  add("STRIPE_PRICE_PRO_FAMILIAR_MENSUAL", "pro_familiar");
  add("STRIPE_PRICE_PRO_FAMILIAR_ANUAL", "pro_familiar");
  // También aceptamos los hardcoded por si las env vars no están
  map["price_1TRC9mKEnhNr9wQdQr9gsRot"] = "pro_familiar"; // mensual
  map["price_1TRCCaKEnhNr9wQdpWlaXP0r"] = "pro_familiar"; // anual
  return map;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { userId, sessionId } = JSON.parse(event.body || "{}");

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId requerido" }) };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "stripe config" }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "supabase config" }) };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceMap = buildPriceMap();

    // 1. Obtener stripe_customer_id (de la session si la pasaron, o del user_data)
    let stripeCustomerId = null;

    if (sessionId) {
      // Usamos session.id para obtener customer_id (más confiable, recién creado)
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items", "subscription"],
      });
      stripeCustomerId = session.customer;

      // Verificar que el plan es Pro Familiar desde line_items
      let isProFamiliar = false;
      if (session.line_items?.data?.length) {
        for (const li of session.line_items.data) {
          const priceId = li.price?.id;
          if (priceId && PRO_FAMILIAR_PLANS.includes(priceMap[priceId])) {
            isProFamiliar = true;
            break;
          }
        }
      }

      if (!isProFamiliar) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "not_pro_familiar",
            message: "Esta sesión no corresponde a Pro Familiar.",
          }),
        };
      }
    } else {
      // Fallback: leer stripe_customer_id de user_data
      const supaRes = await fetch(
        `${supabaseUrl}/rest/v1/user_data?id=eq.${userId}&select=stripe_customer_id`,
        {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
        }
      );
      if (!supaRes.ok) {
        return { statusCode: 500, body: JSON.stringify({ error: "user lookup failed" }) };
      }
      const rows = await supaRes.json();
      stripeCustomerId = rows?.[0]?.stripe_customer_id;
      if (!stripeCustomerId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "no_stripe_customer",
            message: "No encontramos un customer asociado. Si pagaste recién, esperá unos minutos y volvé a intentar.",
          }),
        };
      }
    }

    // 2. Verificar en Stripe que el customer tiene subscription activa de Pro Familiar
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 5,
    });

    const validSub = subscriptions.data.find((sub) => {
      if (!VALID_STATUSES.includes(sub.status)) return false;
      const priceId = sub.items?.data?.[0]?.price?.id;
      return priceId && PRO_FAMILIAR_PLANS.includes(priceMap[priceId]);
    });

    if (!validSub) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "no_active_subscription",
          message: "No encontramos una suscripción activa de Pro Familiar para este usuario.",
        }),
      };
    }

    console.log(`[stripe-recover-activation] subscription verificada: ${validSub.id} status=${validSub.status} customer=${stripeCustomerId}`);

    // 3. Llamar a la RPC de recovery
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/recover_pending_activation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_stripe_customer_id: stripeCustomerId,
      }),
    });

    const rpcText = await rpcRes.text();
    if (!rpcRes.ok) {
      console.error(`[stripe-recover-activation] RPC failed: ${rpcText}`);
      return { statusCode: 500, body: JSON.stringify({ error: "rpc failed", detail: rpcText }) };
    }

    const result = JSON.parse(rpcText);
    console.log(`[stripe-recover-activation] ✅ resultado:`, result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        result: Array.isArray(result) ? result[0] : result,
      }),
    };
  } catch (err) {
    console.error("[stripe-recover-activation] error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
