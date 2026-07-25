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
// AUTH:
//   Por simplicidad, autenticamos por userId + email pasado desde el frontend.
//   Stripe no permite generar portal sessions sin customer_id, así que el
//   endpoint solo funciona si el user tiene un stripe_customer_id válido.
//
// CONFIG STRIPE:
//   Antes del primer uso, en Stripe Dashboard → Settings → Customer Portal
//   hay que configurar qué puede hacer el usuario (cancelar, cambiar plan,
//   etc.). Si NO está configurado, Stripe retorna error 500 con mensaje claro.
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { userId, returnUrl } = JSON.parse(event.body || "{}");

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId requerido" }) };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[stripe-customer-portal] STRIPE_SECRET_KEY ausente");
      return { statusCode: 500, body: JSON.stringify({ error: "config" }) };
    }

    // 1. Buscar el stripe_customer_id del user en Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "supabase config" }) };
    }

    const supaRes = await fetch(
      `${supabaseUrl}/rest/v1/user_data?id=eq.${userId}&select=stripe_customer_id,email`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!supaRes.ok) {
      const text = await supaRes.text();
      console.error("[stripe-customer-portal] supabase error:", text);
      return { statusCode: 500, body: JSON.stringify({ error: "user lookup failed" }) };
    }

    const rows = await supaRes.json();
    if (!rows || rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "user not found" }) };
    }

    const { stripe_customer_id: stripeCustomerId, email } = rows[0];

    if (!stripeCustomerId) {
      // El user nunca compró nada via Stripe — no hay portal posible.
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "no_stripe_customer",
          message: "No tienes una suscripción activa. Andá a /precios para suscribirte.",
        }),
      };
    }

    // 2. Crear la portal session
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || "https://finpathia.com/?portal_return=1",
    });

    console.log(`[stripe-customer-portal] ✅ portal session creada para user=${userId} customer=${stripeCustomerId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("[stripe-customer-portal] error:", err);

    // Mensaje específico si el portal no está configurado en Stripe
    const isConfigError = err.message && err.message.toLowerCase().includes("configuration");
    if (isConfigError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "portal_not_configured",
          message: "Stripe Customer Portal no configurado. Revisá Stripe Dashboard → Settings → Customer Portal.",
        }),
      };
    }

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
