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
