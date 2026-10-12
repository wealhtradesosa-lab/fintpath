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
  it("activation con activo en user_data: marca activated_at + entry_utm/angle", async () => {
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

describe("track-activation: activation = primer activo cargado, verificado en el servidor", () => {
  const UID = "aaaaaaaa-0000-4000-8000-000000000002";
  let llamadas, conActivo, cifrado, filasPatch, ga4, fetchOriginal;
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "k";
    process.env.GA4_API_SECRET = "s";
    llamadas = []; conActivo = []; cifrado = []; filasPatch = [{ id: "acc" }]; ga4 = [];
    fetchOriginal = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      const body = opts.body ? JSON.parse(opts.body) : null;
      llamadas.push({ url, method: opts.method || "GET", body });
      const json = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => "" });
      if (url.endsWith("/auth/v1/user")) return json({ id: UID, email: "ana@example.com" });
      if (url.includes("/rest/v1/user_data?select=id&")) return json(conActivo);
      if (url.includes("/rest/v1/user_data?select=enc:")) return json(cifrado);
      if (url.includes("google-analytics.com")) { ga4.push(body); return json({}); }
      return json(filasPatch);
    };
  });
  afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.GA4_API_SECRET; });
  const ev = (body) => ({ httpMethod: "POST", headers: { authorization: "Bearer t", cookie: "_ga=GA1.1.1.2" }, body: JSON.stringify(body) });
  const lecturas = () => llamadas.filter((l) => l.url.includes("/rest/v1/user_data"));

  it("sin activo en user_data: no marca nada aunque el navegador lo diga", async () => {
    cifrado = [{ enc: null }];
    const r = await handler(ev({ utm: { utm_source: "ig" } }));
    expect(JSON.parse(r.body)).toEqual({ ok: true, evento: "activation", primera: false, activo: false });
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
    expect(ga4).toHaveLength(0);
  });
  it("con activo: el servidor lo comprueba sin leer valores y marca una vez", async () => {
    conActivo = [{ id: UID }];
    const r = await handler(ev({ utm: { utm_campaign: "patrimonio" }, angle: "patrimonio" }));
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, evento: "activation", primera: true });
    const l = lecturas();
    expect(l).toHaveLength(1);
    expect(l[0].url).toBe(`https://x.supabase.co/rest/v1/user_data?select=id&id=eq.${UID}&data->inv->0=not.is.null`);
    for (const x of lecturas()) expect(x.url).not.toMatch(/select=[^&]*(data(,|&|$)|inv)/);
    const p = llamadas.find((x) => x.method === "PATCH");
    expect(p.url).toContain("&activated_at=is.null");
  });
  it("blob cifrado: acepta la señal del navegador (una vez, con sesión)", async () => {
    cifrado = [{ enc: "true" }];
    const r = await handler(ev({}));
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, primera: true });
    expect(lecturas()[1].url).toBe(`https://x.supabase.co/rest/v1/user_data?select=enc:data->>_encrypted&id=eq.${UID}`);
  });
  it("ya activada: primera=false y no se emite GA4 de nuevo", async () => {
    conActivo = [{ id: UID }]; filasPatch = [];
    const r = await handler(ev({}));
    expect(JSON.parse(r.body).primera).toBe(false);
    expect(ga4).toHaveLength(0);
  });
  it("GA4 MP: solo UTM y ángulo; nada de user_id, correo, montos ni conteos", async () => {
    conActivo = [{ id: UID }];
    await handler(ev({ utm: { utm_source: "meta", utm_content: "patrimonio_a", monto: 5000000 }, angle: "patrimonio", valor: 1, user_id: UID }));
    const envios = llamadas.filter((l) => l.url.includes("google-analytics.com"));
    expect(envios).toHaveLength(1);
    const s = JSON.stringify(envios[0].body);
    expect(s).not.toContain(UID);
    expect(s).not.toContain("ana@example.com");
    expect(s).not.toMatch(/monto|valor|5000000|user_id/);
    expect(envios[0].body.events[0]).toEqual({ name: "activation", params: { utm_source: "meta", utm_content: "patrimonio_a", entry_angle: "patrimonio" } });
  });
  it("si falla la lectura de user_data no marca", async () => {
    globalThis.fetch = async (url) => {
      if (url.endsWith("/auth/v1/user")) return { ok: true, json: async () => ({ id: UID }) };
      if (url.includes("/rest/v1/user_data")) return { ok: false, status: 500, json: async () => ({}) };
      llamadas.push({ url, method: "PATCH" }); return { ok: true, json: async () => [{}] };
    };
    const r = await handler(ev({}));
    expect(JSON.parse(r.body).ok).toBe(false);
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
  });
});
