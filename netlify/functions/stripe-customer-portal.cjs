// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Customer Portal
//
// Genera una sesión del Customer Portal de Stripe — el portal hosted donde el
// usuario puede:
//   - Cancelar su suscripción
//   - Cambiar de plan (mensual ↔ anual, upgrade/downgrade)
//   - Actualizar tarjeta
//   - Descargar facturas/recibos
//   - Ver historial de pagos
//
// FLUJO:
//   1. Frontend (MiCuenta) hace POST a este endpoint con { userId }
//   2. Endpoint busca el stripe_customer_id del user en Supabase
//   3. Crea una billing portal session con return_url = la página actual
//   4. Retorna { url } → frontend hace window.location.href = url
//
// AUTH (26-sep-2026):
//   Antes bastaba con mandar un userId en el body: cualquiera que conociera
//   el UUID de otra persona podía abrir SU portal. Ahora el userId sale del
//   token de Supabase (Authorization: Bearer) y el customer se resuelve con
//   _stripeUsuario.resolverCustomer: stripe_customer_id guardado → metadata
//   .userId → Checkout Sessions con client_reference_id. NUNCA por email
//   (los emails no están verificados: auth-signup usa email_confirm:true).
//
// CONFIG STRIPE:
//   Antes del primer uso, en Stripe Dashboard → Settings → Customer Portal
//   hay que configurar qué puede hacer el usuario (cancelar, cambiar plan,
//   etc.). Si NO está configurado, Stripe retorna error 500 con mensaje claro.
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");

const JSON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const { usuarioDesdeToken, resolverCustomer } = require("./_stripeUsuario.cjs");

const MSG_NO_ENCONTRADA = "No pudimos abrir tu suscripción. Escríbenos a soporte@finpathia.com y la cancelamos por ti el mismo día.";

exports.handler = async (event) => {
  const headers = JSON_HEADERS;
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const sesion = await usuarioDesdeToken(event);
  if (sesion.error) {
    return { statusCode: sesion.status, headers, body: JSON.stringify({ error: sesion.error }) };
  }

  try {
    const { returnUrl: returnUrlBody } = JSON.parse(event.body || "{}");
    const userId = sesion.user.id;
    // return_url solo a dominios propios (evita usar el portal como redirector).
    const returnUrl = typeof returnUrlBody === "string"
      && /^https:\/\/((www\.)?finpathia\.com|[a-z0-9-]+--finpathia\.netlify\.app)(\/|$)/i.test(returnUrlBody)
      ? returnUrlBody : null;

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[stripe-customer-portal] STRIPE_SECRET_KEY ausente");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "config" }) };
    }

    // 1. Customer del usuario (solo por IDs puestos por el servidor)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { id: stripeCustomerId } = await resolverCustomer(stripe, userId);

    if (!stripeCustomerId) {
      console.warn(`[stripe-customer-portal] sin customer para user=${userId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "no_stripe_customer", message: MSG_NO_ENCONTRADA }),
      };
    }

    // 2. Crear la portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || "https://finpathia.com/?portal_return=1",
    });

    console.log(`[stripe-customer-portal] ✅ portal session creada para user=${userId} customer=${stripeCustomerId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("[stripe-customer-portal] error:", err);

    // Mensaje específico si el portal no está configurado en Stripe
    const isConfigError = err.message && err.message.toLowerCase().includes("configuration");
    if (isConfigError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "portal_not_configured",
          message: "Stripe Customer Portal no configurado. Revisa Stripe Dashboard → Settings → Customer Portal.",
        }),
      };
    }

    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
