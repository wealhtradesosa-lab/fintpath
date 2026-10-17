// invoice.paid en stripe-webhook y stripe-recover-activation para Pro/Básico.
// Stripe se reemplaza en el caché de require (las funciones son CJS) y la
// red (Supabase) con un fetch falso que registra las llamadas.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const PRO = "price_1TIGRXKEnhNr9wQdC8eKj2xS";
const BASICO = "price_1TIGRWKEnhNr9wQd2oEgNin9";
const FAMILIAR = "price_1TRC9mKEnhNr9wQdQr9gsRot";
const UID = "11111111-2222-4333-8444-555555555555";

let fakeStripe;
function instalarStripe() {
  const ruta = require.resolve("stripe");
  function StripeFalso() { return fakeStripe; }
  require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: StripeFalso };
}
function cargar(nombre) {
  const ruta = require.resolve(`../../netlify/functions/${nombre}`);
  delete require.cache[ruta];
  return require(ruta);
}
let llamadas;
function instalarFetch({ customer = "cus_1" } = {}) {
  llamadas = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    llamadas.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    const u = String(url);
    if (u.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: UID, email: "a@x.co" }), { status: 200 });
    if (u.includes("/rest/v1/user_data")) return new Response(JSON.stringify([{ stripe_customer_id: customer }]), { status: 200 });
    if (u.includes("/rpc/handle_subscription_updated")) return new Response(JSON.stringify([{ account_id: "a", user_id: UID, action: "synced" }]), { status: 200 });
    if (u.includes("/rpc/update_user_plan_after_stripe")) return new Response("true", { status: 200 });
    if (u.includes("/rpc/recover_pending_activation")) return new Response(JSON.stringify([{ recovered: true, account_id: "a", message: "recovered" }]), { status: 200 });
    return new Response("{}", { status: 404 });
  });
}
const sub = (price, status = "active", customer = "cus_1") => ({ id: "sub_1", customer, status, items: { data: [{ price: { id: price } }] } });

const fetchOriginal = globalThis.fetch;
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec";
  process.env.SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_KEY = "service";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { globalThis.fetch = fetchOriginal; vi.restoreAllMocks(); });

describe("stripe-webhook · invoice.paid", () => {
  async function enviar(invoice, suscripcion) {
    fakeStripe = {
      webhooks: { constructEvent: () => ({ id: "evt_1", type: "invoice.paid", data: { object: invoice } }) },
      subscriptions: { retrieve: vi.fn(async () => suscripcion) },
    };
    instalarStripe();
    instalarFetch();
    const { handler } = cargar("stripe-webhook.cjs");
    const r = await handler({ httpMethod: "POST", headers: { "stripe-signature": "x" }, body: "{}" });
    return { r, retrieve: fakeStripe.subscriptions.retrieve };
  }
  const rpcs = () => llamadas.filter((l) => l.url.includes("/rpc/"));

  it("renovación de Pro re-sincroniza con el plan y estado de la suscripción", async () => {
    const { r, retrieve } = await enviar({ subscription: "sub_1" }, sub(PRO));
    expect(r.statusCode).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("sub_1");
    expect(rpcs()).toEqual([{ url: "https://db.test/rest/v1/rpc/handle_subscription_updated", body: { p_stripe_customer_id: "cus_1", p_new_plan: "pro", p_status: "active" } }]);
  });
  it("API nueva de Stripe: la suscripción viene en parent.subscription_details", async () => {
    await enviar({ parent: { subscription_details: { subscription: "sub_9" } } }, sub(BASICO, "trialing"));
    expect(fakeStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_9");
    expect(rpcs()[0].body).toEqual({ p_stripe_customer_id: "cus_1", p_new_plan: "basico", p_status: "trialing" });
  });
  it("pago sin suscripción o precio desconocido: 200 y no toca Supabase", async () => {
    let x = await enviar({}, null);
    expect(x.r.statusCode).toBe(200);
    expect(rpcs()).toHaveLength(0);
    x = await enviar({ subscription: "sub_1" }, sub("price_otro"));
    expect(x.r.statusCode).toBe(200);
    expect(rpcs()).toHaveLength(0);
  });
  it("reintentos de Stripe mandan la misma llamada idempotente", async () => {
    await enviar({ subscription: "sub_1" }, sub(PRO, "past_due"));
    const a = rpcs();
    await enviar({ subscription: "sub_1" }, sub(PRO, "past_due"));
    expect(rpcs()).toEqual(a);
  });
});

describe("stripe-recover-activation · Pro y Básico", () => {
  async function recuperar({ body = {}, subs = [], session = null } = {}) {
    fakeStripe = {
      checkout: { sessions: { retrieve: vi.fn(async () => session) } },
      subscriptions: { list: vi.fn(async () => ({ data: subs })) },
    };
    instalarStripe();
    instalarFetch();
    const { handler } = cargar("stripe-recover-activation.cjs");
    const r = await handler({ httpMethod: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(body) });
    return { status: r.statusCode, data: JSON.parse(r.body) };
  }
  const rpc = () => llamadas.filter((l) => l.url.includes("/rpc/"));

  it("Pro activo → update_user_plan_after_stripe con el usuario del token", async () => {
    const r = await recuperar({ subs: [sub(PRO)] });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ ok: true, plan: "pro", result: { recovered: true } });
    expect(rpc()).toEqual([{ url: "https://db.test/rest/v1/rpc/update_user_plan_after_stripe", body: { p_user_id: UID, p_plan: "pro", p_stripe_customer_id: "cus_1" } }]);
  });
  it("Básico en trialing también se recupera", async () => {
    const r = await recuperar({ subs: [sub(BASICO, "trialing")] });
    expect(r.data).toMatchObject({ ok: true, plan: "basico" });
  });
  it("Pro Familiar sigue usando recover_pending_activation y gana si hay varias", async () => {
    const r = await recuperar({ subs: [sub(PRO), sub(FAMILIAR)] });
    expect(r.data.plan).toBe("pro_familiar");
    expect(rpc()[0].url).toMatch(/recover_pending_activation$/);
  });
  it("sin suscripción viva (past_due, canceled) → 400 sin tocar Supabase", async () => {
    const r = await recuperar({ subs: [sub(PRO, "past_due"), sub(PRO, "canceled")] });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("no_active_subscription");
    expect(rpc()).toHaveLength(0);
  });
  it("una checkout session de otro usuario → 403", async () => {
    const r = await recuperar({ body: { sessionId: "cs_1" }, session: { customer: "cus_2", metadata: { userId: "otro" }, line_items: { data: [{ price: { id: PRO } }] } } });
    expect(r.status).toBe(403);
    expect(rpc()).toHaveLength(0);
  });
  it("checkout session propia de Pro → recupera Pro", async () => {
    const r = await recuperar({ body: { sessionId: "cs_1" }, session: { customer: "cus_1", metadata: { userId: UID }, line_items: { data: [{ price: { id: PRO } }] } }, subs: [sub(PRO)] });
    expect(r.data).toMatchObject({ ok: true, plan: "pro" });
  });
});
