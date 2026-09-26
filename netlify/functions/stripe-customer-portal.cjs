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
//   el UUID de otra persona podía abrir SU portal (cancelarle la suscripción,
//   ver sus facturas). Ahora el frontend manda "Authorization: Bearer
//   <access_token>" de Supabase, se valida contra /auth/v1/user y el userId
//   sale del token. El userId del body se ignora.
//   Si user_data no tiene stripe_customer_id, se busca el cliente en Stripe
//   por el email VERIFICADO del token (caso: el webhook no guardó el id).
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

// Misma validación que stripe-checkout.cjs (usuarioDesdeToken).
async function usuarioDesdeToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return { error: "Falta el token de sesión", status: 401 };
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "Supabase no configurado en el servidor", status: 500 };
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${m[1]}` },
    });
    if (!r.ok) return { error: "Sesión inválida o vencida", status: 401 };
    const user = await r.json();
    if (!user || !user.id) return { error: "Sesión inválida o vencida", status: 401 };
    return { user };
  } catch (e) {
    return { error: "No se pudo validar la sesión: " + e.message, status: 502 };
  }
}

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
    const emailToken = (sesion.user.email || "").trim().toLowerCase();
    // return_url solo a dominios propios (evita usar el portal como redirector).
    const returnUrl = typeof returnUrlBody === "string"
      && /^https:\/\/((www\.)?finpathia\.com|[a-z0-9-]+--finpathia\.netlify\.app)(\/|$)/i.test(returnUrlBody)
      ? returnUrlBody : null;

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[stripe-customer-portal] STRIPE_SECRET_KEY ausente");
      return { statusCode: 500, headers, body: JSON.stringify({ error: "config" }) };
    }

    // 1. Buscar el stripe_customer_id del user en Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "supabase config" }) };
    }

    const supaRes = await fetch(
      `${supabaseUrl}/rest/v1/user_data?id=eq.${encodeURIComponent(userId)}&select=stripe_customer_id`,
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
      return { statusCode: 500, headers, body: JSON.stringify({ error: "user lookup failed" }) };
    }

    const rows = await supaRes.json();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let stripeCustomerId = (rows && rows[0] && rows[0].stripe_customer_id) || null;

    // Respaldo: buscar el cliente en Stripe por el email verificado del token.
    if (!stripeCustomerId && emailToken) {
      try {
        const lista = await stripe.customers.list({ email: emailToken, limit: 10 });
        const conSub = [];
        for (const c of lista.data) {
          const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 1 });
          if (subs.data.length) conSub.push(c);
        }
        stripeCustomerId = (conSub[0] || lista.data[0] || {}).id || null;
        if (stripeCustomerId) console.log(`[stripe-customer-portal] customer resuelto por email para user=${userId}`);
      } catch (e) {
        console.warn("[stripe-customer-portal] búsqueda por email falló:", e.message);
      }
    }

    if (!stripeCustomerId) {
      // El user nunca compró nada via Stripe — no hay portal posible.
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "no_stripe_customer",
          message: "No tienes una suscripción activa. Ve a Planes para suscribirte.",
        }),
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
