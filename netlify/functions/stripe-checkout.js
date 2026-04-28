// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Checkout (universal — multi-plan)
//
// Crea una checkout session para cualquier plan. Recibe priceId del frontend
// y el resto lo resuelve en el server. Soporta trial 14 días para Pro Familiar
// vía detección por priceId.
//
// PAYLOAD ESPERADO (POST JSON):
//   { priceId, email, userId, successUrl, cancelUrl }
//
// RESPUESTA:
//   { url: "https://checkout.stripe.com/..." }   ← redirect del frontend
//   { error: "..." }                             ← caso error
//
// ENV VARS:
//   STRIPE_SECRET_KEY              (requerida — sin ella nada funciona)
//   STRIPE_PRICE_PRO_FAMILIAR_*    (opcional — si están seteadas, esos
//                                    priceIds reciben trial 14 días auto)
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");

// Trial period en días para Pro Familiar. Si querés cambiarlo (ej: 7 días),
// modificá esta constante. Si querés desactivar trial, ponela en 0.
const PRO_FAMILIAR_TRIAL_DAYS = 14;

// Detecta si un priceId pertenece a Pro Familiar comparando contra las env vars.
// Si las env vars no están seteadas (deploy nuevo), detecta por hardcoded
// fallback de los priceIds conocidos.
function isProFamiliarPrice(priceId) {
  // Fallback hardcoded — los priceIds reales de Live mode
  const fallbackProFamiliar = [
    "price_1TRC9mKEnhNr9wQdQr9gsRot",  // mensual
    "price_1TRCCaKEnhNr9wQdpWlaXP0r",  // anual
  ];
  if (fallbackProFamiliar.includes(priceId)) return true;
  // Comprobación dinámica vía env vars (preferido para test/live switch)
  if (process.env.STRIPE_PRICE_PRO_FAMILIAR_MENSUAL === priceId) return true;
  if (process.env.STRIPE_PRICE_PRO_FAMILIAR_ANUAL === priceId) return true;
  return false;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "STRIPE_SECRET_KEY no configurada" }) };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { priceId, email, userId, successUrl, cancelUrl } = JSON.parse(event.body);

    if (!priceId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "priceId requerido" }) };
    }

    // Validación email: Stripe requiere email válido o NO incluir el campo.
    // Si llega vacío del frontend (caso típico: user recién signup sin email
    // en su perfil aún), retornamos mensaje claro en lugar de propagar el
    // "Invalid email address" de Stripe.
    const cleanEmail = (email || "").trim();
    if (!cleanEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "email requerido — completá tu perfil antes de suscribirte",
        }),
      };
    }
    if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `email inválido: ${cleanEmail}` }),
      };
    }

    // Construcción de la session. Trial period solo para Pro Familiar.
    // metadata.userId es CRÍTICO — el webhook lo usa para identificar al
    // usuario y crear la account correcta.
    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: cleanEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || "https://finpathia.com/?success=true",
      cancel_url: cancelUrl || "https://finpathia.com/?canceled=true",
      metadata: { userId: userId || "" },
      // Permite a Stripe enviar el priceId también en el subscription metadata,
      // útil para el webhook al reintentar / debugging.
      subscription_data: {
        metadata: { userId: userId || "", priceId },
      },
    };

    // Trial de 14 días solo para Pro Familiar (los otros planes son cobro
    // directo, sin trial). Si el usuario ya tuvo trial antes con la misma
    // tarjeta, Stripe lo detecta y NO da trial doble.
    if (isProFamiliarPrice(priceId) && PRO_FAMILIAR_TRIAL_DAYS > 0) {
      sessionParams.subscription_data.trial_period_days = PRO_FAMILIAR_TRIAL_DAYS;
      // Importante: si el trial expira sin método de pago válido, cancelamos
      // la subscription en lugar de cobrarle a la fuerza al usuario.
      sessionParams.subscription_data.trial_settings = {
        end_behavior: { missing_payment_method: "cancel" },
      };
      // Si pedimos tarjeta opcional durante el trial, payment_method_collection
      // = "if_required" evita pedir tarjeta hasta que el trial termine. Pero
      // ESO requiere un default payment method al final, complicado. Por ahora
      // pedimos tarjeta upfront (default behavior), que es más simple.
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[stripe-checkout] session creada · priceId=${priceId} userId=${userId} session=${session.id}`);

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
