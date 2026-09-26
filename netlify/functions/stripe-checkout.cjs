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
const TRIAL_DAYS = 14; // aplica a todos los planes desde 25-jul-2026
const PRO_FAMILIAR_TRIAL_DAYS = TRIAL_DAYS; // compat: usado por isProFamiliarPrice y logs

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

// 26-sep-2026 (P0) — El usuario sale del token de Supabase (Authorization:
// Bearer), validado contra /auth/v1/user. Antes el endpoint confiaba en el
// userId del navegador y cualquiera podía crear un checkout a nombre de otro.
// Helpers compartidos con stripe-customer-portal en _stripeUsuario.cjs.
const { usuarioDesdeToken, resolverCustomer, suscripcionVigente } = require("./_stripeUsuario.cjs");

const DIA_MS = 86400000;
// Invitados con prueba de 30 días. MISMA lista que INVITADOS_30D en
// src/lib/planEstado.js (cuentaNueva). Si cambias una, cambia la otra.
const INVITADOS_30D = ["andres.isaza@grupogiesas.com", "renatomaestri76@hotmail.com"];

// 26-sep-2026 — Fin de la prueba calculado EN EL SERVIDOR.
// user_data.data.p.trialEnd lo escribe el navegador: no se puede confiar en
// él (bastaba con editarlo para tener meses de trial en Stripe). El tope es
// created_at del usuario (Supabase Auth) + 14 días EXACTOS (30 para
// invitados). Antes se truncaba a las 00:00 UTC y Stripe mostraba "13 días
// gratis" mientras la app decía 14. Ahora es el mismo instante que la app
// (planEstado.js → nuevoFinPrueba / finPruebaDesdeRegistro) y los dos cuentan
// días con ceil. El valor del cliente solo se usa si es MENOR que el tope
// (cuentas viejas con "YYYY-MM-DD": así coincide con lo que ve la app).
function topePruebaServidor(user) {
  const creado = Date.parse(user && user.created_at);
  if (!Number.isFinite(creado)) return null;
  const email = String((user && user.email) || "").trim().toLowerCase();
  const dias = INVITADOS_30D.includes(email) ? 30 : 14;
  return creado + dias * DIA_MS;
}

// trialEnd guardado por la app, solo como valor a la baja. Formatos:
// "YYYY-MM-DD" (cuentas viejas, vence 00:00 UTC) o ISO completo (nuevas).
async function trialEndCliente(userId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/user_data?id=eq.${encodeURIComponent(userId)}&select=te:data->p->>trialEnd`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const te = Array.isArray(rows) && rows[0] ? rows[0].te : null;
    if (!te || !/^\d{4}-\d{2}-\d{2}/.test(te)) return null;
    const ms = te.length === 10 ? Date.parse(te + "T00:00:00Z") : Date.parse(te);
    return Number.isFinite(ms) ? ms : null;
  } catch (e) {
    console.warn("[stripe-checkout] no pude leer trialEnd:", e.message);
    return null;
  }
}

function finPrueba(topeServidor, valorCliente) {
  if (topeServidor == null) return null;
  return valorCliente != null ? Math.min(valorCliente, topeServidor) : topeServidor;
}

// Stripe Checkout exige trial_end al menos 48 h en el futuro. Margen de 10 min
// para que no falle por la latencia entre este cálculo y la creación.
const MIN_TRIAL_MS = 48 * 3600 * 1000 + 10 * 60 * 1000;
// MISMA regla que usa el frontend (src/lib/planEstado.js → fechaPrimerCobro)
// para mostrar "el primer cobro es el {fecha}". Si cambias una, cambia la otra.
function calcularTrialStripe(finMs, ahora) {
  if (finMs == null) return { origen: "sin_created_at" }; // nunca "14 días desde hoy"
  if (finMs <= ahora) return { origen: "prueba_vencida" };
  return { trial_end: Math.ceil(Math.max(finMs, ahora + MIN_TRIAL_MS) / 1000), origen: "prueba_app" };
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const sesion = await usuarioDesdeToken(event);
  if (sesion.error) {
    return { statusCode: sesion.status, headers, body: JSON.stringify({ error: sesion.error }) };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = JSON.parse(event.body || "{}");
    const { priceId, successUrl, cancelUrl } = body;
    // userId y email SIEMPRE del token validado; el body solo es respaldo del email.
    const userId = sesion.user.id;
    const email = sesion.user.email || body.email;

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

    // 26-sep-2026 — Customer ligado al usuario por metadata.userId.
    // El portal (stripe-customer-portal) solo encuentra al customer por IDs que
    // pone el servidor, así que el customer se crea AQUÍ con metadata.userId
    // (antes lo creaba Checkout a partir del email, sin metadata).
    // Si el usuario ya tiene una suscripción vigente (active/trialing/
    // past_due/unpaid), NO se crea otra: se le manda al portal para cambiar de
    // plan o cancelar. Evita cobros dobles.
    const resuelto = await resolverCustomer(stripe, userId);
    const vigente = await suscripcionVigente(stripe, resuelto.id);
    if (vigente) {
      console.log(`[stripe-checkout] user=${userId} ya tiene suscripción ${vigente.id} (${vigente.status}); se manda al portal`);
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: "ya_suscrito",
          portal: true,
          message: "Ya tienes una suscripción activa. Para cambiar de plan o cancelarla, usa «Gestionar / cancelar suscripción» en Mi cuenta.",
        }),
      };
    }
    // Solo se reutiliza un customer con evidencia de ser de este usuario.
    let customerId = resuelto.verificado ? resuelto.id : null;
    if (!customerId) {
      const nuevo = await stripe.customers.create({ email: cleanEmail, metadata: { userId } });
      customerId = nuevo.id;
    }

    // metadata.userId es CRÍTICO — el webhook lo usa para identificar al
    // usuario y activar el plan. client_reference_id lo usa el portal como
    // respaldo para encontrar al customer.
    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      client_reference_id: userId,
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
      // 100% off por 3 meses sobre Pro Familiar, el user ve "$0 today" y
      // se le cobra el monto normal a partir del mes 4.
      // Crear los códigos desde Stripe Dashboard → Coupons → Promotion codes.
      allow_promotion_codes: true,
    };

    // 25-jul-2026 — Trial para TODOS los planes (antes solo Pro Familiar).
    // 26-sep-2026 — El trial de Stripe se ALINEA con la prueba de la app.
    // Antes Stripe sumaba siempre 14 días desde el pago: quien se registraba
    // (prueba de 14 días en la app) y agregaba tarjeta el día 10 recibía 14
    // días MÁS, y el primer cobro caía el día 24, no cuando la app decía que
    // terminaba la prueba. Además, quien ya había agotado su prueba recibía
    // otros 14 días gratis. (Ojo: Stripe NO detecta "misma tarjeta, segundo
    // trial"; eso que decía el comentario anterior no es cierto.)
    // Ahora (fin de prueba = min(trialEnd de la app, created_at + 14/30 días)):
    //   · prueba vigente → trial_end = fin de la prueba (mínimo 48 h, que es
    //     lo que exige Stripe Checkout)
    //   · prueba vencida → sin trial: se cobra al confirmar
    //   · el trialEnd de la app no se pudo leer → se usa created_at + 14/30
    //     días. Nunca "14 días desde hoy".
    const finMs = finPrueba(topePruebaServidor(sesion.user), await trialEndCliente(userId));
    const trial = calcularTrialStripe(finMs, Date.now());
    if (trial.trial_end) {
      sessionParams.subscription_data.trial_end = trial.trial_end;
      // Si el trial expira sin método de pago válido, cancelamos la
      // suscripción en lugar de cobrar a la fuerza. La tarjeta se pide al
      // entrar a Checkout (comportamiento por defecto).
      sessionParams.subscription_data.trial_settings = {
        end_behavior: { missing_payment_method: "cancel" },
      };
    }
    console.log(`[stripe-checkout] trial · origen=${trial.origen} trial_end=${trial.trial_end || "-"}`);

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
    // está OK para la flow de Pioneros (ya tenés el código aplicado).
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
        console.error(`[stripe-checkout] error buscando promo ${promotionCode}:`, promoErr.message);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[stripe-checkout] session creada · priceId=${priceId} userId=${userId} session=${session.id}`);

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
