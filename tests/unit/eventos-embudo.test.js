// Eventos de embudo marcados por el navegador: activation y simulator_used.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { resolverEvento, EVENTOS } = require("../../netlify/lib/eventosEmbudo.cjs");
const { limpiarUtm, clientIdDesdeCookie } = require("../../netlify/lib/ga4.cjs");
const { handler } = require("../../netlify/functions/track-activation.cjs");

describe("resolverEvento", () => {
  it("sin event = activation", () => {
    expect(resolverEvento({})).toEqual({ evento: "activation", columna: "activated_at" });
    expect(resolverEvento(null)).toEqual({ evento: "activation", columna: "activated_at" });
  });
  it("simulator_used → simulator_first_used_at", () => {
    expect(resolverEvento({ event: "simulator_used" })).toEqual({ evento: "simulator_used", columna: "simulator_first_used_at" });
  });
  it("rechaza cualquier otro evento o columna inventada", () => {
    for (const e of ["advisor_used", "plan", "activated_at", "__proto__", "toString", ""]) expect(resolverEvento({ event: e })).toBe(null);
    expect(Object.keys(EVENTOS).sort()).toEqual(["activation", "simulator_used"]);
  });
});

describe("ga4: lista blanca", () => {
  it("solo utm_* y el client_id sale de _ga", () => {
    expect(limpiarUtm({ utm_source: "ig", user_id: "x", email: "a@b", monto: 5 })).toEqual({ utm_source: "ig" });
    expect(clientIdDesdeCookie("a=1; _ga=GA1.1.123456.789; b=2")).toBe("123456.789");
    expect(clientIdDesdeCookie("")).toBe(null);
  });
});

describe("track-activation con event=simulator_used", () => {
  const UID = "aaaaaaaa-0000-4000-8000-000000000001";
  let llamadas, filasPatch, fetchOriginal;
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "k";
    delete process.env.GA4_API_SECRET;
    llamadas = []; filasPatch = [{ id: "acc" }];
    fetchOriginal = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      llamadas.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
      if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: UID, email: "ana@example.com" }) };
      return { ok: true, json: async () => filasPatch, text: async () => "" };
    };
  });
  afterEach(() => { globalThis.fetch = fetchOriginal; });
  const ev = (body, auth = "Bearer t") => ({ httpMethod: "POST", headers: { authorization: auth, cookie: "_ga=GA1.1.1.2" }, body: JSON.stringify(body) });

  it("sin sesión → 401 y no toca accounts", async () => {
    const r = await handler(ev({ event: "simulator_used" }, ""));
    expect(r.statusCode).toBe(401);
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
  });
  it("marca solo simulator_first_used_at si está vacío; nada de montos ni ids", async () => {
    const r = await handler(ev({ event: "simulator_used", utm: { utm_source: "email", monto: 9 }, angle: "renta" }));
    expect(JSON.parse(r.body)).toEqual({ ok: true, evento: "simulator_used", primera: true });
    const p = llamadas.find((l) => l.method === "PATCH");
    expect(p.url).toBe(`https://x.supabase.co/rest/v1/accounts?owner_user_id=eq.${UID}&simulator_first_used_at=is.null`);
    expect(Object.keys(p.body)).toEqual(["simulator_first_used_at"]);
  });
  it("idempotente: si ya estaba marcado, primera=false", async () => {
    filasPatch = [];
    const r = await handler(ev({ event: "simulator_used" }));
    expect(JSON.parse(r.body).primera).toBe(false);
  });
  it("activation sigue igual (activated_at + entry_utm/angle)", async () => {
    await handler(ev({ utm: { utm_source: "ig" }, angle: "renta:declaracion" }));
    const p = llamadas.find((l) => l.method === "PATCH");
    expect(p.url).toContain("&activated_at=is.null");
    expect(p.body).toMatchObject({ entry_utm: { utm_source: "ig" }, entry_angle: "renta:declaracion" });
  });
  it("evento no permitido → 400", async () => {
    const r = await handler(ev({ event: "plan" }));
    expect(r.statusCode).toBe(400);
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
  });
});
