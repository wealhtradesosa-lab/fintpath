// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Recover Activation
//
// Endpoint de fallback: si el webhook de Stripe falla o se demora, el usuario
// (o la app al volver del checkout) llama a este endpoint para forzar la
// activación de su plan después de un pago exitoso. Desde el 2-nov-2026
// (#36 rehecho) recupera Pro Familiar, Pro y Básico; antes solo Pro Familiar,
// y un Pro que pagaba volvía a la app con «not_pro_familiar» y sin plan.
//
// SEGURIDAD:
//   1. Verificamos en Stripe que el customer tiene una suscripción viva
//      (active/trialing) con un precio conocido (netlify/lib/stripePrecios.cjs).
//   2. Si viene sessionId, la sesión debe ser del mismo usuario
//      (metadata.userId), para que nadie use el pago de otra persona.
//   3. Pro Familiar → recover_pending_activation. Pro/Básico →
//      update_user_plan_after_stripe (que también sincroniza accounts).
//
// FLUJO:
//   POST { sessionId? }   ← sessionId opcional del checkout
//   Respuesta: { ok, plan, result, compra }
//
// COMPRA PARA ANALÍTICA (11-oct-2026):
//   Si llega sessionId y la sesión es de este usuario, está completa y
//   pagada, toda respuesta incluye `compra: { purchaseId, amountTotal,
//   currency, priceId }` (sin PII). El cliente la usa para disparar Purchase
//   (Pixel) y purchase (GA4) una sola vez.
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");
const { errorParaLog } = require("../lib/logSeguro.cjs");
const { buildPriceMap, resolvePlanFromLineItems } = require("../lib/stripePrecios.cjs");

const VALID_STATUSES = ["active", "trialing"];
// Si hay varias suscripciones vivas, gana la de plan más alto.
const PRIORIDAD = { pro_familiar: 3, pro: 2, basico: 1 };

const respuesta = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

async function rpc(supabaseUrl, supabaseKey, nombre, payload) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${nombre} failed (${res.status})`);
  try { return JSON.parse(text); } catch { return text; }
}

/** Suscripción viva de plan más alto, o null. */
function elegirSuscripcion(subs, priceMap) {
  const candidatas = (subs || [])
    .filter((sub) => VALID_STATUSES.includes(sub.status))
    .map((sub) => ({ sub, plan: resolvePlanFromLineItems(sub, priceMap) }))
    .filter((x) => x.plan)
    .sort((a, b) => (PRIORIDAD[b.plan] || 0) - (PRIORIDAD[a.plan] || 0));
  return candidatas[0] || null;
}

// Extrae de una Checkout Session solo lo que la analítica necesita, sin PII.
// Devuelve null si la sesión no es de este usuario o no está pagada.
// metadata.userId lo pone stripe-checkout.cjs al crear la sesión.
const crypto = require("crypto");

// Id opaco de la compra para analítica: el id de la sesión de Stripe (cs_…)
// no debe llegar a GA4 ni a Meta. SHA-256 truncado, estable por sesión.
function purchaseIdDe(sessionId) {
  return "fp_" + crypto.createHash("sha256").update(String(sessionId)).digest("hex").slice(0, 24);
}

function compraParaAnalitica(session, userId) {
  if (!session || !userId) return null;
  if (session.metadata?.userId !== userId) return null;
  if (session.status !== "complete" || session.payment_status !== "paid") return null;
  if (typeof session.amount_total !== "number") return null;
  return {
    purchaseId: purchaseIdDe(session.id),
    amountTotal: session.amount_total, // centavos
    currency: session.currency || "usd",
    priceId: session.line_items?.data?.[0]?.price?.id || null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  if (event.httpMethod !== "POST") return respuesta(405, { error: "Method not allowed" });

  try {
    const { sessionId } = JSON.parse(event.body || "{}");
    // 28-sep-2026: el userId venía en el body; ahora sale del token verificado.
    const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    if (!quien) return sinSesion({}, "Inicia sesión para recuperar la activación.");
    const userId = quien.id;

    if (!process.env.STRIPE_SECRET_KEY) return respuesta(500, { error: "stripe config" });
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return respuesta(500, { error: "supabase config" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceMap = buildPriceMap();

    // 1. stripe_customer_id: de la sesión (si es de este usuario) o de user_data
    let stripeCustomerId = null;
    let compra = null; // datos de la compra para analítica (sin PII)
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
      if (session.metadata?.userId && session.metadata.userId !== userId) {
        return respuesta(403, { error: "session_ajena", message: "Esta sesión de pago no es tuya." });
      }
      compra = compraParaAnalitica(session, userId);
      if (!resolvePlanFromLineItems(session, priceMap)) {
        return respuesta(400, { error: "unknown_price", message: "Esta sesión no corresponde a un plan de Finpathia.", compra });
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
        compra,
      });
    }

    // 2. Suscripción viva con precio conocido
    const subscriptions = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 10 });
    const elegida = elegirSuscripcion(subscriptions.data, priceMap);
    if (!elegida) {
      return respuesta(400, { error: "no_active_subscription", message: "No encontramos una suscripción activa para tu cuenta.", compra });
    }
    const { sub, plan } = elegida;
    console.log(`[stripe-recover-activation] suscripción verificada · plan=${plan} status=${sub.status}`);

    // 3. Activar
    let result;
    if (plan === "pro_familiar") {
      const r = await rpc(supabaseUrl, supabaseKey, "recover_pending_activation", { p_user_id: userId, p_stripe_customer_id: stripeCustomerId });
      result = Array.isArray(r) ? r[0] : r;
    } else {
      const ok = await rpc(supabaseUrl, supabaseKey, "update_user_plan_after_stripe", { p_user_id: userId, p_plan: plan, p_stripe_customer_id: stripeCustomerId });
      result = { recovered: ok === true, message: ok === true ? "recovered" : "user_not_found" };
    }
    console.log(`[stripe-recover-activation] ✅ plan=${plan} recovered=${result?.recovered}`);
    return respuesta(200, { ok: true, plan, result, compra });
  } catch (err) {
    console.error("[stripe-recover-activation] error:", errorParaLog(err));
    return respuesta(500, { error: "recover_failed" });
  }
};

exports.compraParaAnalitica = compraParaAnalitica;
exports.purchaseIdDe = purchaseIdDe;
exports.elegirSuscripcion = elegirSuscripcion;
