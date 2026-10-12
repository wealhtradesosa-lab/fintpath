// Handler de ai-chat con fetch simulado: sesión obligatoria, cuota en el
// servidor (429), contador sin consumir y recorte por max_tokens.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { handler } = require("../../netlify/functions/ai-chat.cjs");

let llamadas, usos, plan, anthropic;
const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });

beforeEach(() => {
  process.env.SUPABASE_URL = "https://supa.test";
  process.env.SUPABASE_SERVICE_KEY = "service";
  process.env.ANTHROPIC_API_KEY = "sk-test";
  llamadas = []; usos = 0; plan = "pro";
  anthropic = { content: [{ type: "text", text: "Respuesta corta." }], stop_reason: "end_turn" };
  vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
    llamadas.push(url);
    if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer ok" ? json({ id: "u1", email: "a@example.com" }) : json({}, 401);
    if (url.includes("/rest/v1/accounts")) return json([{ plan }]);
    if (url.includes("/rest/v1/user_data")) return json([{ trial_end: null }]);
    if (url.endsWith("/rpc/incrementar_uso_ia")) return json(++usos);
    if (url.endsWith("/rpc/consultar_uso_ia")) return json(usos);
    if (url.startsWith("https://api.anthropic.com")) { llamadas.body = JSON.parse(opts.body); return json(anthropic); }
    throw new Error("url inesperada " + url);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const pedir = (body, token = "ok") => handler({
  httpMethod: "POST",
  headers: token ? { authorization: "Bearer " + token } : {},
  body: JSON.stringify(body),
});
const pregunta = { messages: [{ role: "user", content: "¿Qué deuda pago primero?" }], financialContext: "datos" };

describe("ai-chat handler", () => {
  it("sin sesión responde 401 en tuteo y no llama a Anthropic", async () => {
    const r = await pedir(pregunta, null);
    expect(r.statusCode).toBe(401);
    expect(JSON.parse(r.body).mensaje).toBe("Inicia sesión para usar el Asesor IA.");
    expect(llamadas.some((u) => u.includes("anthropic"))).toBe(false);
    const r2 = await pedir(pregunta, "falso");
    expect(r2.statusCode).toBe(401);
  });

  it("responde con restantes del servidor y max_tokens 1500", async () => {
    const r = await pedir(pregunta);
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ reply: "Respuesta corta.", recortada: false, restantes: 149, tope: 150 });
    expect(llamadas.body.max_tokens).toBe(1500);
    expect(llamadas.body.system).toContain("tutea siempre");
  });

  it("al pasar el tope responde 429 sin llamar a Anthropic", async () => {
    plan = "free"; usos = 10;
    const r = await pedir(pregunta);
    expect(r.statusCode).toBe(429);
    const b = JSON.parse(r.body);
    expect(b).toMatchObject({ error: "cuota_ia_agotada", restantes: 0, tope: 10 });
    expect(b.mensaje).toContain("Ya usaste tus 10 consultas con IA de este mes");
    expect(llamadas.some((u) => u.includes("anthropic"))).toBe(false);
  });

  it("accion=cuota lee sin consumir", async () => {
    usos = 4;
    const r = await pedir({ accion: "cuota" });
    expect(JSON.parse(r.body)).toEqual({ restantes: 146, tope: 150 });
    expect(usos).toBe(4);
    expect(llamadas.some((u) => u.includes("incrementar") || u.includes("anthropic"))).toBe(false);
  });

  it("si Anthropic corta por max_tokens termina en frase completa", async () => {
    anthropic = { content: [{ type: "text", text: "Primero la tarjeta.\nRESPUESTA DIRECTA:\nEl g" }], stop_reason: "max_tokens" };
    const b = JSON.parse((await pedir(pregunta)).body);
    expect(b.recortada).toBe(true);
    expect(b.reply.startsWith("Primero la tarjeta.\n\n(Resumí")).toBe(true);
  });

  it("sin pregunta válida responde 400 y no consume cuota", async () => {
    const r = await pedir({ messages: [{ role: "assistant", content: "hola" }] });
    expect(r.statusCode).toBe(400);
    expect(usos).toBe(0);
  });

  it("GET responde 405", async () => {
    expect((await handler({ httpMethod: "GET", headers: {} })).statusCode).toBe(405);
  });
});

describe("ai-chat: reintento de formato (QA #35 e)", () => {
  const MAL = "La tarjeta primero.\n- Pagando solo la cuota terminas en 14 meses.\n- Un abono extra baja el saldo.";
  const BIEN = "La tarjeta primero.\n- **Opción A: solo la cuota**: x. Pro: a. Contra: b.\n- **Opción B: cuota + abono extra**: y. Pro: a. Contra: b.\nLa decisión es tuya.";
  const preguntaDeuda = { messages: [{ role: "user", content: "¿Qué deuda me conviene pagar primero?" }], financialContext: "datos" };

  it("si no cumple, reintenta una vez con la corrección y descuenta un solo uso", async () => {
    const respuestas = [MAL, BIEN];
    const cuerpos = [];
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      if (url.startsWith("https://api.anthropic.com")) {
        cuerpos.push(JSON.parse(opts.body));
        return json({ content: [{ type: "text", text: respuestas.shift() }], stop_reason: "end_turn" });
      }
      return base(url, opts);
    }));
    const b = JSON.parse((await pedir(preguntaDeuda)).body);
    expect(cuerpos).toHaveLength(2);
    expect(cuerpos[1].messages.at(-2)).toEqual({ role: "assistant", content: MAL });
    expect(cuerpos[1].messages.at(-1).content).toContain("Corrección de formato");
    expect(b).toMatchObject({ reply: BIEN, reintentada: true, restantes: 149 });
    expect(usos).toBe(1);
  });

  it("si cumple a la primera, no reintenta", async () => {
    anthropic = { content: [{ type: "text", text: BIEN }], stop_reason: "end_turn" };
    const b = JSON.parse((await pedir(preguntaDeuda)).body);
    expect(b.reintentada).toBe(false);
    expect(llamadas.filter((u) => u.includes("anthropic"))).toHaveLength(1);
  });

  it("si el reintento sale peor o falla, queda la primera", async () => {
    const respuestas = [{ ok: true, text: MAL }, { ok: false }];
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      if (url.startsWith("https://api.anthropic.com")) {
        const r = respuestas.shift();
        return r.ok ? json({ content: [{ type: "text", text: r.text }], stop_reason: "end_turn" }) : json({ error: { message: "x" } }, 500);
      }
      return base(url, opts);
    }));
    const r = await pedir(preguntaDeuda);
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ reply: MAL, reintentada: true });
  });

  it("si la primera tardó demasiado, no reintenta (límite de 10 s de Netlify)", async () => {
    const base = globalThis.fetch;
    let n = 0;
    const ahora = Date.now;
    let desfase = 0;
    vi.spyOn(Date, "now").mockImplementation(() => ahora() + desfase);
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      if (url.startsWith("https://api.anthropic.com")) {
        n++; desfase = 7000; // la primera "tardó" 7 s
        return json({ content: [{ type: "text", text: MAL }], stop_reason: "end_turn" });
      }
      return base(url, opts);
    }));
    const b = JSON.parse((await pedir(preguntaDeuda)).body);
    vi.restoreAllMocks();
    expect(n).toBe(1);
    expect(b).toMatchObject({ reply: MAL, reintentada: false });
  });
});
