// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Webhook (multi-plan, con soporte Pro Familiar)
//
// Maneja eventos de Stripe después de checkout. Mapea priceId → plan y llama
// a la RPC apropiada en Supabase para activar la suscripción.
//
// FLUJO:
//   1. Verifica signature de Stripe (rechaza requests no auténticos)
//   2. Lee env var STRIPE_PRICE_TO_PLAN_MAP (JSON con mapeo) — fallback a
//      vars individuales (STRIPE_PRICE_PRO_MENSUAL, etc.)
//   3. Identifica el plan según el priceId pagado
//   4. Llama a la RPC correcta:
//        - 'basico' o 'pro'         → update_user_plan_after_stripe()
//        - 'pro_familiar'           → activate_pro_familiar() (crea accounts)
//
// EVENTOS MANEJADOS:
//   - checkout.session.completed      → activación inicial
//   - customer.subscription.updated   → cambio de plan o status
//   - customer.subscription.deleted   → cancelación (downgrade a free)
//
// ENV VARS REQUERIDAS:
//   STRIPE_SECRET_KEY              (test o live)
//   STRIPE_WEBHOOK_SECRET          (signing secret del endpoint)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY           (service_role key, NO anon)
//
// ENV VARS OPCIONALES (mapeo priceId → plan):
//   STRIPE_PRICE_BASICO_MENSUAL
//   STRIPE_PRICE_BASICO_ANUAL
//   STRIPE_PRICE_PRO_MENSUAL
//   STRIPE_PRICE_PRO_ANUAL
//   STRIPE_PRICE_PRO_FAMILIAR_MENSUAL
//   STRIPE_PRICE_PRO_FAMILIAR_ANUAL
//
// IDEMPOTENCIA: las RPCs son idempotentes — si Stripe reenvía el mismo
// evento, el resultado es el mismo (no duplica accounts ni members).
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");

// ── Mapeo priceId → plan name ─────────────────────────────────────────────
function buildPriceMap() {
  const map = {};
  const add = (envVar, plan) => {
    const id = process.env[envVar];
    if (id) map[id] = plan;
  };
  add("STRIPE_PRICE_BASICO_MENSUAL", "basico");
  add("STRIPE_PRICE_BASICO_ANUAL", "basico");
  add("STRIPE_PRICE_PRO_MENSUAL", "pro");
  add("STRIPE_PRICE_PRO_ANUAL", "pro");
  add("STRIPE_PRICE_PRO_FAMILIAR_MENSUAL", "pro_familiar");
  add("STRIPE_PRICE_PRO_FAMILIAR_ANUAL", "pro_familiar");
  return map;
}

// ── Llamada genérica a Supabase REST (con service_role) ───────────────────
async function callSupabaseRpc(rpcName, payload) {
  // Fallback: si SUPABASE_URL no está configurada (caso típico cuando solo
  // existe VITE_SUPABASE_URL del frontend), usamos esa. Ambas apuntan al
  // mismo proyecto Supabase, solo cambia el prefijo según el contexto.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL ni VITE_SUPABASE_URL configuradas en Netlify");
  }
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_KEY no configurada en Netlify");
  }
  const url = `${supabaseUrl}/rest/v1/rpc/${rpcName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${rpcName} failed (${res.status}): ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

// ── Resolver el plan a partir de un objeto subscription/session ────────────
function resolvePlanFromLineItems(stripeObject, priceMap) {
  // Para checkout.session.completed
  if (stripeObject.line_items?.data?.length) {
    for (const li of stripeObject.line_items.data) {
      const priceId = li.price?.id;
      if (priceId && priceMap[priceId]) return priceMap[priceId];
    }
  }
  // Para subscription objects (subscription.updated/deleted)
  if (stripeObject.items?.data?.length) {
    for (const it of stripeObject.items.data) {
      const priceId = it.price?.id;
      if (priceId && priceMap[priceId]) return priceMap[priceId];
    }
  }
  return null;
}

exports.handler = async (event) => {
  // CORS / method guard
  const cors = { "Content-Type": "application/json" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Verificación de env vars críticas
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY ausente");
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "config" }) };
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET ausente — no puedo verificar signature");
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "config" }) };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

  // 1. Verificar signature
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe-webhook] signature inválida:", err.message);
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Webhook signature: ${err.message}` }) };
  }

  console.log(`[stripe-webhook] event.type=${stripeEvent.type} event.id=${stripeEvent.id}`);

  // 2. Construir mapeo priceId → plan
  const priceMap = buildPriceMap();
  if (Object.keys(priceMap).length === 0) {
    console.warn("[stripe-webhook] priceMap vacío — ninguna env var STRIPE_PRICE_* configurada");
  }

  // 3. Manejar eventos
  try {
    switch (stripeEvent.type) {

      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        const userId = session.metadata?.userId;
        const stripeCustomerId = session.customer;

        if (!userId) {
          console.error("[stripe-webhook] checkout.session.completed sin userId en metadata");
          return { statusCode: 200, headers: cors, body: JSON.stringify({ received: true, ignored: "no_user_id" }) };
        }

        // Necesitamos line_items para conocer el priceId. session por default
        // no incluye line_items expandidos — los pedimos explícitamente.
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["line_items"],
        });
        const plan = resolvePlanFromLineItems(fullSession, priceMap);

        if (!plan) {
          console.error(`[stripe-webhook] no pude resolver plan para session ${session.id}. priceMap keys: ${Object.keys(priceMap).join(",")}`);
          return { statusCode: 200, headers: cors, body: JSON.stringify({ received: true, ignored: "unknown_price" }) };
        }

        console.log(`[stripe-webhook] activando plan=${plan} para userId=${userId} customer=${stripeCustomerId}`);

        if (plan === "pro_familiar") {
          const accountId = await callSupabaseRpc("activate_pro_familiar", {
            p_user_id: userId,
            p_stripe_customer_id: stripeCustomerId,
            p_display_name: "Mi cuenta",
          });
          console.log(`[stripe-webhook] ✅ pro_familiar activado · account_id=${accountId}`);
        } else {
          const ok = await callSupabaseRpc("update_user_plan_after_stripe", {
            p_user_id: userId,
            p_plan: plan,
            p_stripe_customer_id: stripeCustomerId,
          });
          console.log(`[stripe-webhook] ✅ plan ${plan} activado · ok=${ok}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        // Cambios de plan (upgrade/downgrade desde Customer Portal), fin de
        // trial → active, reactivación después de cancelación, etc.
        const sub = stripeEvent.data.object;
        const stripeCustomerId = sub.customer;
        const status = sub.status; // 'active' | 'trialing' | 'past_due' | etc.

        // Resolver el plan del subscription actual (puede haber cambiado)
        const newPlan = resolvePlanFromLineItems(sub, priceMap);

        if (!newPlan) {
          console.warn(`[stripe-webhook] subscription.updated · no pude resolver plan para customer=${stripeCustomerId}, status=${status}. Loggeo pero no actualizo.`);
          break;
        }

        console.log(`[stripe-webhook] subscription.updated · customer=${stripeCustomerId} status=${status} plan=${newPlan}`);

        const result = await callSupabaseRpc("handle_subscription_updated", {
          p_stripe_customer_id: stripeCustomerId,
          p_new_plan: newPlan,
          p_status: status,
        });
        console.log(`[stripe-webhook] ✅ subscription.updated procesado:`, result);
        break;
      }

      case "customer.subscription.deleted": {
        // Cancelación. Marcamos account como 'canceled' con grace_until 30 días.
        // NO downgrade inmediato — el usuario sigue teniendo acceso durante el
        // grace period. El job expire_canceled_accounts() (cron diario) hace
        // el downgrade automático cuando grace expira.
        const sub = stripeEvent.data.object;
        const stripeCustomerId = sub.customer;

        console.log(`[stripe-webhook] subscription.deleted · customer=${stripeCustomerId}`);

        const result = await callSupabaseRpc("handle_subscription_canceled", {
          p_stripe_customer_id: stripeCustomerId,
          p_canceled_at: new Date().toISOString(),
        });
        console.log(`[stripe-webhook] ✅ subscription.canceled procesado:`, result);
        break;
      }

      default:
        console.log(`[stripe-webhook] event.type=${stripeEvent.type} no manejado, ignorando`);
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error("[stripe-webhook] error procesando evento:", err);
    // Retornar 500 hace que Stripe reintente el webhook (lo cual es deseable
    // para errores transitorios). Solo retornar 200 si el error es por datos
    // inválidos que NO van a mejorar con un retry.
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
