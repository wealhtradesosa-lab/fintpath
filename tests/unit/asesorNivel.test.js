import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calcularMetricas, saludFinanciera } from "../../src/lib/metrics.js";
import { bloqueNivelLibertad, escalaNiveles } from "../../src/lib/asesorNivel.js";

const qa = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_patrimonio_completo.json", import.meta.url), "utf8"));
const met = calcularMetricas({ ingresos: qa.ingresos, gastos: qa.gas, deudas: qa.deu, inv: qa.inv, trm: qa.trm });

describe("contexto del Asesor IA: nivel de libertad", () => {
  it("la escala se dicta anclada a plata real, sin porcentajes inventados", () => {
    expect(escalaNiveles()).toBe("N1 Déficit (flujo libre negativo) · N2 Estabilidad (flujo positivo, sin cubrir lo esencial) · N3 Seguridad (ingreso pasivo ≥ gastos esenciales + cuotas) · N4 Independencia (ingreso pasivo ≥ gastos + cuotas) · N5 Abundancia (ingreso pasivo ≥ 1.3× (gastos + cuotas))");
    expect(escalaNiveles()).not.toMatch(/25–50|50–100|Libertad parcial/);
  });
  it("QA Pro: cobertura precalculada 17,4%, N2 Estabilidad, siguiente Seguridad; sin umbrales inventados", () => {
    const txt = bloqueNivelLibertad({ met, salud: saludFinanciera(met) });
    expect(txt).toContain("= 17,4%");
    expect(txt).toContain("Nivel actual: 2/5 Estabilidad");
    // Seguridad ya no es el 25% ($2.157.500): es lo esencial del mes ($8.170.000).
    expect(txt).toContain("Siguiente nivel: Seguridad — faltan $6.672.500/mes");
    expect(txt).toContain("Colchón de liquidez: 3,1 meses");
    expect(txt).not.toMatch(/10–30|30–60|Pre-Seguridad|Vitalidad|Libertad Absoluta/);
    expect(txt).not.toContain("16,3");
  });
  it("sin gastos ni cuotas: no inventa nivel", () => {
    expect(bloqueNivelLibertad({ met: calcularMetricas({}) })).toMatch(/sin datos suficientes/);
  });
});
