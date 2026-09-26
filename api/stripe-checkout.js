// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Stripe Checkout — versión Vercel (api/stripe-checkout)
//
// 26-sep-2026 (P0). En Vercel no existen las Netlify Functions: el frontend
// llamaba a /.netlify/functions/stripe-checkout y Vercel respondía 405. Este
// archivo es el equivalente de netlify/functions/stripe-checkout.cjs para
// Vercel. El frontend ahora llama a /api/stripe-checkout, que en Netlify se
// redirige a la función (netlify.toml) y en Vercel cae aquí.
//
// Seguridad: exige "Authorization: Bearer <access_token de Supabase>" y lo
// valida contra Supabase Auth. userId/email salen del token, no del body.
//
// ENV VARS (Vercel): STRIPE_SECRET_KEY, VITE_SUPABASE_URL (o SUPABASE_URL),
//   VITE_SUPABASE_ANON_KEY (o SUPABASE_ANON_KEY / service key como respaldo).
// ═══════════════════════════════════════════════════════════════════════════
import Stripe from "stripe";

const TRIAL_DAYS = 14; // igual que la función de Netlify (25-jul-2026)

async function usuarioDesdeToken(req) {
  const auth = String(req.headers?.authorization || "");
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY no configurada" });
  }

  const sesion = await usuarioDesdeToken(req);
  if (sesion.error) return res.status(sesion.status).json({ error: sesion.error });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { priceId, successUrl, cancelUrl } = body;
    if (!priceId) return res.status(400).json({ error: "priceId requerido" });

    const userId = sesion.user.id;
    const cleanEmail = String(sesion.user.email || body.email || "").trim();
    if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.length < 5) {
      return res.status(400).json({ error: "email requerido — completa tu perfil antes de suscribirte" });
    }

    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: cleanEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || "https://finpathia.com/?success=true",
      cancel_url: cancelUrl || "https://finpathia.com/?canceled=true",
      metadata: { userId },
      subscription_data: { metadata: { userId, priceId } },
      allow_promotion_codes: true,
    };
    if (TRIAL_DAYS > 0) {
      sessionParams.subscription_data.trial_period_days = TRIAL_DAYS;
      sessionParams.subscription_data.trial_settings = {
        end_behavior: { missing_payment_method: "cancel" },
      };
    }

    // Promo pre-aplicado (campaña Pioneros). Si falla, no bloquea el checkout.
    const promotionCode = String(body.promotionCode || "").trim().toUpperCase();
    if (promotionCode) {
      try {
        const promos = await stripe.promotionCodes.list({ code: promotionCode, active: true, limit: 1 });
        const promo = promos.data[0];
        if (promo && promo.active && (!promo.max_redemptions || promo.times_redeemed < promo.max_redemptions)) {
          sessionParams.discounts = [{ promotion_code: promo.id }];
          delete sessionParams.allow_promotion_codes;
        }
      } catch (promoErr) {
        console.error(`[stripe-checkout] error buscando promo ${promotionCode}:`, promoErr.message);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[stripe-checkout] session creada · priceId=${priceId} userId=${userId} session=${session.id}`);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[stripe-checkout] error:", err);
    return res.status(500).json({ error: err.message });
  }
}
