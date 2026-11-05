// El chat del asesor descuenta de la cuota real del plan, no de un contador en
// memoria. Hasta oct-2026 `ai-chat.cjs` limitaba con un objeto de módulo
// (`rateLimits`), que en serverless se reinicia en cada arranque en frío y es
// propio de cada instancia: el "límite de 15 diarias" no limitaba.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { mensajeCuota, TOPES, topeDe } = require("../../netlify/functions/_cuotaIA.cjs");

const FUNCIONES_IA = ["ai-chat.cjs", "analyze-image.cjs", "parse-declaration.cjs"];
const leer = (f) => readFileSync(new URL(`../../netlify/functions/${f}`, import.meta.url), "utf8");

describe("cuota de IA", () => {
  it("todas las funciones de IA descuentan de la cuota real", () => {
    for (const f of FUNCIONES_IA) {
      expect(leer(f), f).toContain("consumirCuota");
    }
  });

  // 2-nov-2026 (#35 rehecho): la llamada a Anthropic vive en llamarAnthropic()
  // y la cuota pasa por leerPlanIA (prueba de 14 días); el orden se mide dentro
  // del handler. El comportamiento con fetch simulado está en aiChatHandler.test.js.
  const handlerDe = (s) => s.slice(s.indexOf("exports.handler"));

  it("el chat exige sesión antes de gastar la clave de Anthropic", () => {
    const s = handlerDe(leer("ai-chat.cjs"));
    expect(s).toContain("usuarioDesdeToken");
    // El cobro de cuota va DESPUÉS de identificar y ANTES de llamar a Anthropic.
    expect(s.indexOf("usuarioDesdeToken")).toBeLessThan(s.indexOf("consumirCuota"));
    expect(s.indexOf("consumirCuota")).toBeLessThan(s.indexOf("await llamarAnthropic"));
  });

  it("el contador en memoria quedó solo como respaldo sin Supabase", () => {
    const s = handlerDe(leer("ai-chat.cjs"));
    const iCuota = s.indexOf("if (conSupabase) {");
    const iMem = s.indexOf("rateLimits[userId].count++");
    expect(iCuota).toBeGreaterThan(-1);
    // El incremento en memoria vive dentro del `else`, o sea después del if.
    expect(iMem).toBeGreaterThan(iCuota);
  });

  it("sigue devolviendo `remaining` (y ahora `restantes` y `tope`)", () => {
    const s = handlerDe(leer("ai-chat.cjs"));
    expect(s).toMatch(/reply, recortada, reintentada, restantes, remaining: restantes, tope/);
  });

  it("el mensaje nombra lo que se consumió, sin romper a los otros llamadores", () => {
    expect(mensajeCuota({ usos: 31, tope: 30, plan: "basico" }).mensaje).toContain("30 lecturas con IA");
    expect(mensajeCuota({ usos: 151, tope: 150, plan: "pro" }, "consultas al asesor").mensaje)
      .toContain("150 consultas al asesor");
    // Quien paga no recibe la invitación a mejorar el plan.
    expect(mensajeCuota({ usos: 151, tope: 150, plan: "pro" }).mensaje).not.toContain("mejorar tu plan");
    // 5-nov-2026: sin pago no hay IA; en la prueba, invitación a suscribirse.
    expect(mensajeCuota({ usos: 1, tope: 0, plan: "free" }).mensaje).toContain("Suscríbete");
    expect(mensajeCuota({ usos: 21, tope: 20, plan: "prueba" }).mensaje).toContain("prueba gratis");
  });

  it("los topes por plan son los del catálogo", () => {
    expect(TOPES.free).toBe(0);
    expect(TOPES.prueba).toBe(20);
    expect(topeDe("pro")).toBe(150);
    expect(topeDe("plan_que_no_existe")).toBe(TOPES.free);
  });
});
