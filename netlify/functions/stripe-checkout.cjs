// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Checkout (universal — multi-plan)
//
// Crea una checkout session para cualquier plan. Recibe priceId del frontend
// y el resto lo resuelve en el server.
//
// SIN PRUEBA EN CHECKOUT (11-oct-2026): la prueba de 14 días Pro la da la
// app al registrarse. Checkout cobra de inmediato el primer periodo.
//
// PAYLOAD ESPERADO (POST JSON):
//   { priceId, email, userId, successUrl, cancelUrl, promotionCode? }
//
// RESPUESTA:
//   { url: "https://checkout.stripe.com/..." }   ← redirect del frontend
//   { error: "..." }                             ← caso error
//
// ENV VARS:
//   STRIPE_SECRET_KEY              (requerida — sin ella nada funciona)
// ═══════════════════════════════════════════════════════════════════════════

const { uidCorto, errorParaLog } = require("../lib/logSeguro.cjs");
const Stripe = require("stripe");

// 11-oct-2026 — Sin segunda prueba en Checkout.
// Todo el que llega a Checkout ya tuvo los 14 días Pro de la app (el trial
// se da al registrarse; un usuario anónimo no puede abrir Checkout). Antes
// Checkout sumaba otros 14 días con trial_period_days, así que quien pagaba
// el día 13 recién se cobraba hacia el día 27. Ahora el primer cobro es
// inmediato. No se envía trial_period_days, trial_end, trial_settings ni
// trial_from_plan: sin trial_from_plan, Checkout ignora cualquier prueba
// configurada a nivel de precio en Stripe.
//
// El bloque de trial se agregó el 25-jul-2026 con un comentario que decía
// que Stripe no da una segunda prueba a la misma tarjeta. Es falso: Stripe
// no hace esa verificación por defecto. isProFamiliarPrice() solo servía
// para ese trial y nadie más la usaba, así que también se quitó.

// Arma los parámetros de la sesión de Checkout. Función pura (sin llamadas
// a Stripe) para poder testear que nunca lleva prueba.
function buildSessionParams({ priceId, email, userId, successUrl, cancelUrl }) {
  // Construcción de la session (sin prueba: el primer cobro es inmediato).
  // metadata.userId es CRÍTICO — el webhook lo usa para identificar al
  // usuario y crear la account correcta.
  return {
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || "https://finpathia.com/?success=true",
    cancel_url: cancelUrl || "https://finpathia.com/?canceled=true",
    metadata: { userId: userId || "" },
    // Permite a Stripe enviar el priceId también en el subscription metadata,
    // útil para el webhook al reintentar / debugging.
    subscription_data: {
      metadata: { userId: userId || "", priceId },
    },
    // Activa el campo "Add promotion code" en la página de Stripe Checkout.
    // Cuando un user tiene un código (ej: 10AMPRO-ALPHAS para community),
    // lo ingresa ahí y Stripe valida automáticamente. Si el código aplica
    // 100% off por 3 meses, la primera factura es de $0 (no por prueba,
    // por el descuento) y se le cobra el monto normal a partir del mes 4.
    // Crear los códigos desde Stripe Dashboard → Coupons → Promotion codes.
    allow_promotion_codes: true,
  };
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
    const body = JSON.parse(event.body || "{}");
    const { priceId, email, userId, successUrl, cancelUrl } = body;

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
          error: "email requerido — completa tu perfil antes de suscribirte",
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

    const sessionParams = buildSessionParams({ priceId, email: cleanEmail, userId, successUrl, cancelUrl });

    // ─────────────────────────────────────────────────────────────────────
    // Sesión 2-may-2026: campaña Pioneros 2026
    // Si el frontend pasa promotionCode (ej: "PIONEROS2026"), lo buscamos
    // en Stripe y lo pre-aplicamos al checkout. Esto evita que el user
    // tenga que escribir el código manualmente.
    //
    // IMPORTANTE: si el código no existe o ya alcanzó max redemptions,
    // NO bloqueamos el checkout — solo loggeamos el error y procedemos sin
    // discount. El user aún puede pagar precio normal o ingresar otro código.
    //
    // allow_promotion_codes: true Y discounts son MUTUAMENTE EXCLUYENTES en
    // Stripe — si pre-aplicamos un código, el campo input desaparece. Esto
    // está OK para la flow de Pioneros (ya tienes el código aplicado).
    // ─────────────────────────────────────────────────────────────────────
    const promotionCode = (body.promotionCode || "").trim().toUpperCase();
    if (promotionCode) {
      try {
        const promos = await stripe.promotionCodes.list({
          code: promotionCode,
          active: true,
          limit: 1,
        });
        if (promos.data.length > 0) {
          const promo = promos.data[0];
          // Verificamos que no haya expirado ni alcanzado max redemptions
          if (promo.active && (!promo.max_redemptions || promo.times_redeemed < promo.max_redemptions)) {
            sessionParams.discounts = [{ promotion_code: promo.id }];
            // Cuando hay discount pre-aplicado, NO podemos tener allow_promotion_codes
            delete sessionParams.allow_promotion_codes;
            console.log(`[stripe-checkout] promo aplicado: ${promotionCode} (id=${promo.id}, redeemed=${promo.times_redeemed}/${promo.max_redemptions || "∞"})`);
          } else {
            console.warn(`[stripe-checkout] promo ${promotionCode} ya alcanzó límite o está inactivo`);
          }
        } else {
          console.warn(`[stripe-checkout] promo ${promotionCode} no encontrado en Stripe — el user puede ingresar uno manual`);
        }
      } catch (promoErr) {
        // Si falla la búsqueda, no bloqueamos el checkout
        console.error(`[stripe-checkout] error buscando promo ${promotionCode}:`, errorParaLog(promoErr));
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[stripe-checkout] session creada · priceId=${priceId} userId=${uidCorto(userId)} session=${session.id}`);

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

exports.buildSessionParams = buildSessionParams;
