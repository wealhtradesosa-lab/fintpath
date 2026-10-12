// 11-oct-2026 — Checkout sin segunda prueba + precio real en analítica.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import { precioCobroUSD, planDesdePriceId, STRIPE_PRICE_IDS } from "../../src/lib/plans.js";
import { trackPurchase, trackCheckoutStarted } from "../../src/lib/analytics.js";

const require = createRequire(import.meta.url);
const { buildSessionParams } = require("../../netlify/functions/stripe-checkout.cjs");
const { compraParaAnalitica } = require("../../netlify/functions/stripe-recover-activation.cjs");

describe("stripe-checkout: sin prueba en Checkout", () => {
  it("la sesión no lleva trial_period_days, trial_end, trial_settings ni trial_from_plan", () => {
    for (const ids of Object.values(STRIPE_PRICE_IDS)) {
      for (const priceId of [ids.mensual, ids.anual]) {
        const p = buildSessionParams({ priceId, email: "a@b.co", userId: "u1" });
        expect(p.mode).toBe("subscription");
        expect(p.subscription_data).toEqual({ metadata: { userId: "u1", priceId } });
        const json = JSON.stringify(p);
        expect(json).not.toMatch(/trial/);
      }
    }
  });
  it("mantiene el campo de códigos promocionales", () => {
    const p = buildSessionParams({ priceId: "price_x", email: "a@b.co", userId: "u1" });
    expect(p.allow_promotion_codes).toBe(true);
  });
});

describe("plans: precio real del cobro", () => {
  it("mensual = precio del mes", () => {
    expect(precioCobroUSD("Básico", "mensual")).toBe(8);
    expect(precioCobroUSD("Pro", "mensual")).toBe(16);
    expect(precioCobroUSD("Pro Familiar", "mensual")).toBe(27);
  });
  it("anual = 12 × el mensual del plan anual", () => {
    expect(precioCobroUSD("Básico", "anual")).toBe(72);
    expect(precioCobroUSD("Pro", "anual")).toBe(144);
    expect(precioCobroUSD("Pro Familiar", "anual")).toBe(240);
  });
  it("gratis o desconocido → null", () => {
    expect(precioCobroUSD("Free", "mensual")).toBeNull();
    expect(precioCobroUSD("Nada", "mensual")).toBeNull();
    expect(precioCobroUSD(undefined, "anual")).toBeNull();
  });
  it("planDesdePriceId mapea los 6 precios", () => {
    expect(planDesdePriceId(STRIPE_PRICE_IDS.Pro.anual)).toEqual({ plan: "Pro", billingCycle: "anual" });
    expect(planDesdePriceId(STRIPE_PRICE_IDS["Pro Familiar"].mensual)).toEqual({ plan: "Pro Familiar", billingCycle: "mensual" });
    expect(planDesdePriceId("price_desconocido")).toBeNull();
    expect(planDesdePriceId(null)).toBeNull();
  });
});

describe("recover-activation: compra para analítica", () => {
  const base = {
    id: "cs_test_1", status: "complete", payment_status: "paid",
    amount_total: 1600, currency: "usd", customer: "cus_1",
    customer_details: { email: "x@y.co" },
    metadata: { userId: "u1" },
    line_items: { data: [{ price: { id: STRIPE_PRICE_IDS.Pro.mensual } }] },
  };
  it("devuelve solo session, monto, moneda y priceId (sin PII)", () => {
    expect(compraParaAnalitica(base, "u1")).toEqual({
      sessionId: "cs_test_1", amountTotal: 1600, currency: "usd", priceId: STRIPE_PRICE_IDS.Pro.mensual,
    });
  });
  it("null si la sesión es de otro usuario o no está pagada", () => {
    expect(compraParaAnalitica(base, "otro")).toBeNull();
    expect(compraParaAnalitica({ ...base, payment_status: "unpaid" }, "u1")).toBeNull();
    expect(compraParaAnalitica({ ...base, status: "open" }, "u1")).toBeNull();
  });
});

describe("analytics: Purchase e InitiateCheckout", () => {
  let store;
  beforeEach(() => {
    store = {};
    globalThis.window = {
      fbq: vi.fn(), gtag: vi.fn(), console: { info() {}, warn() {} },
      sessionStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
      localStorage: { getItem: () => null, setItem() {} },
    };
  });
  afterEach(() => { delete globalThis.window; });

  it("dispara Purchase y purchase una sola vez por sesión", () => {
    const args = { sessionId: "cs_1", amountTotal: 14400, currency: "usd", plan: "Pro", billingCycle: "anual" };
    expect(trackPurchase(args)).toBe(true);
    expect(trackPurchase(args)).toBe(false);
    expect(window.fbq).toHaveBeenCalledTimes(1);
    expect(window.fbq).toHaveBeenCalledWith("track", "Purchase", { value: 144, currency: "USD", content_name: "Pro" }, { eventID: "cs_1" });
    expect(window.gtag).toHaveBeenCalledTimes(1);
    const [, name, payload] = window.gtag.mock.calls[0];
    expect(name).toBe("purchase");
    expect(payload).toMatchObject({ transaction_id: "cs_1", value: 144, currency: "USD" });
  });
  it("no dispara con total 0 (cupón 100%) ni sin session id", () => {
    expect(trackPurchase({ sessionId: "cs_2", amountTotal: 0, currency: "usd", plan: "Pro" })).toBe(false);
    expect(trackPurchase({ amountTotal: 1600, currency: "usd", plan: "Pro" })).toBe(false);
    expect(window.fbq).not.toHaveBeenCalled();
    expect(window.gtag).not.toHaveBeenCalled();
  });
  it("InitiateCheckout usa el precio real del plan, no 27/243 fijo", () => {
    trackCheckoutStarted({ plan: "Pro", billingCycle: "mensual", priceId: "p" });
    const call = window.fbq.mock.calls.find((c) => c[1] === "InitiateCheckout");
    expect(call[2]).toMatchObject({ content_name: "Pro", currency: "USD", value: 16 });
    window.fbq.mockClear();
    trackCheckoutStarted({ plan: "Básico", billingCycle: "anual", priceId: "p" });
    expect(window.fbq.mock.calls.find((c) => c[1] === "InitiateCheckout")[2].value).toBe(72);
  });
});
