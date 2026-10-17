// FINPATHIA · priceId de Stripe → plan. Compartido por stripe-webhook y
// stripe-recover-activation (antes cada uno tenía su copia y recover solo
// conocía Pro Familiar). Fuente de verdad: STRIPE_PRICE_IDS en
// src/lib/plans.js; las variables de entorno, si existen, sobrescriben.
const PRICE_FALLBACK = {
  // Basico
  "price_1TIGRWKEnhNr9wQd2oEgNin9": "basico",       // mensual
  "price_1TIGRWKEnhNr9wQdJTMTGfYa": "basico",       // anual
  // Pro
  "price_1TIGRXKEnhNr9wQdC8eKj2xS": "pro",          // mensual
  "price_1TIGRYKEnhNr9wQd7QTFxT6z": "pro",          // anual
  // Pro Familiar
  "price_1TRC9mKEnhNr9wQdQr9gsRot": "pro_familiar", // mensual
  "price_1TRCCaKEnhNr9wQdpWlaXP0r": "pro_familiar", // anual
};

function buildPriceMap(env = process.env) {
  const map = { ...PRICE_FALLBACK };
  const add = (envVar, plan) => {
    const id = env[envVar];
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

// Plan de una checkout session (line_items) o de una subscription (items).
function resolvePlanFromLineItems(stripeObject, priceMap) {
  for (const li of stripeObject?.line_items?.data || []) {
    const priceId = li.price?.id;
    if (priceId && priceMap[priceId]) return priceMap[priceId];
  }
  for (const it of stripeObject?.items?.data || []) {
    const priceId = it.price?.id;
    if (priceId && priceMap[priceId]) return priceMap[priceId];
  }
  return null;
}

// Id de la suscripción de una invoice. Según la versión del API de Stripe
// viene en invoice.subscription (antes de 2025-03) o en
// invoice.parent.subscription_details.subscription (después), o en las líneas.
function subscriptionIdDeInvoice(inv) {
  const pick = (v) => (typeof v === "string" ? v : v?.id) || null;
  return (
    pick(inv?.subscription) ||
    pick(inv?.parent?.subscription_details?.subscription) ||
    pick((inv?.lines?.data || []).map((l) => l.subscription || l.parent?.subscription_item_details?.subscription).find(Boolean)) ||
    null
  );
}

module.exports = { PRICE_FALLBACK, buildPriceMap, resolvePlanFromLineItems, subscriptionIdDeInvoice };
