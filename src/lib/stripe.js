/* ═══════════════════════════════════════════════════
   STRIPE CHECKOUT — FINPATH Plans
   
   Setup required in Stripe Dashboard:
   1. Create Product "FINPATH Pro" → Price $29/year (recurring)
   2. Create Product "FINPATH Family" → Price $49/year (recurring)
   3. Copy the Price IDs and set them below
   4. Set up Webhook endpoint for subscription events
   ═══════════════════════════════════════════════════ */

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const isStripeConfigured = !!(stripeKey && stripeKey.startsWith("pk_"));

// ── Price IDs from Stripe Dashboard ──
// Replace these with your actual Stripe Price IDs after creating products
const PRICES = {
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || "price_pro_placeholder",
  family: import.meta.env.VITE_STRIPE_PRICE_FAMILY || "price_family_placeholder",
};

let stripePromise = null;

async function getStripe() {
  if (!isStripeConfigured) return null;
  if (!stripePromise) {
    const { loadStripe } = await import("@stripe/stripe-js");
    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
}

export async function redirectToCheckout(plan, userEmail, userId) {
  if (!isStripeConfigured) {
    alert("Stripe no está configurado. Contacta al administrador.");
    return;
  }

  const stripe = await getStripe();
  if (!stripe) return;

  const priceId = PRICES[plan];
  if (!priceId || priceId.includes("placeholder")) {
    alert("Plan no disponible aún. Pronto estará listo.");
    return;
  }

  const { error } = await stripe.redirectToCheckout({
    lineItems: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    successUrl: `${window.location.origin}?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
    cancelUrl: `${window.location.origin}?canceled=true`,
    customerEmail: userEmail,
    clientReferenceId: userId,
  });

  if (error) {
    console.error("Stripe error:", error);
    alert("Error al procesar el pago: " + error.message);
  }
}

// Check if user just completed checkout
export function checkCheckoutResult() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const plan = params.get("plan");
  const canceled = params.get("canceled");

  if (sessionId && plan) {
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    return { success: true, plan, sessionId };
  }
  if (canceled) {
    window.history.replaceState({}, "", window.location.pathname);
    return { canceled: true };
  }
  return null;
}

// Customer portal for managing subscription
export async function redirectToPortal(customerId) {
  // This requires a server-side API endpoint
  // For now, redirect to Stripe dashboard
  window.open("https://billing.stripe.com/p/login/test", "_blank");
}
