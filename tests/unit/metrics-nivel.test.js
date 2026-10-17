// Spec Finanzas 2026-10-11 — metrics.js: base común, nivel por cobertura pasiva y candados.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calcularMetricas, nivelLibertad, esLiquido } from "../../src/lib/metrics.js";

const qa = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_patrimonio_completo.json", import.meta.url), "utf8"));
const qaMetricas = () => calcularMetricas({ ingresos: qa.ingresos, gastos: qa.gas, deudas: qa.deu, inv: qa.inv, trm: qa.trm });

describe("caso QA Pro completo", () => {
  const m = qaMetricas();
  it("IP neto: arriendo bruto − administración − predial/12, más CDT y fondo", () => {
    expect(m.ipBruto).toBe(2047500);
    expect(m.costosNeteados).toBe(350000 + 200000);
    expect(m.ip).toBe(1497500);
  });
  it("G, SD, OB, FL", () => {
    expect(m.g).toBe(4910000);
    expect(m.sd).toBe(3720000);
    expect(m.ob).toBe(8630000);
    expect(m.fl).toBe(567500);
  });
  it("cobertura pasiva ~17% (no 0,0%) → N2 Estabilidad", () => {
    expect(m.coberturaPasiva).toBeCloseTo(17.35, 1);
    expect(m.pctIngresoPasivo).toBeCloseTo(21.0, 1);
    expect(m.nivel.nivel).toBe(2);
    expect(m.nivel.nombre).toBe("Estabilidad");
  });
  it("liquidez única: caja + CDT + fondo, sobre OB", () => {
    expect(m.liquidos).toBe(26500000);
    expect(m.colchonMeses).toBeCloseTo(3.07, 2);
  });
  it("invertibles excluyen vehículo", () => {
    expect(m.invertibles).toBe(406500000);
  });
});

describe("candados y umbrales", () => {
  it("patrimonio negativo −11,2M e IP 0 → nivel 1 o 2, nunca 3", () => {
    const m = calcularMetricas({
      ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 6000000 }],
      gastos: { Vida: [{ m: 3000000, frecuencia: "mensual" }] },
      deudas: [{ mt: 61200000, pg: 1000000 }],
      inv: [{ n: "Cuenta", tp: "Cash", va: 50000000, vc: 50000000, id: "a" }],
    });
    expect(m.patrimonioNeto).toBe(-11200000);
    expect(m.ip).toBe(0);
    expect([1, 2]).toContain(m.nivel.nivel);
  });
  it("cobertura alta con patrimonio negativo se topa en N2", () => {
    const r = nivelLibertad({ ip: 8000000, ob: 10000000, fl: 1000000, patrimonioNeto: -1 });
    expect(r.nivel).toBe(2);
    expect(r.candado).toBe("patrimonio_negativo");
  });
  it("FL < 0 → N1 Déficit", () => {
    expect(nivelLibertad({ ip: 1, ob: 10, fl: -5, patrimonioNeto: 1e6 }).nivel).toBe(1);
  });
  it("umbrales 24,9 / 25 / 50 / 99,9 / 100", () => {
    const n = (c) => nivelLibertad({ ip: c, ob: 100, fl: 1, patrimonioNeto: 1 }).nivel;
    expect([n(24.9), n(25), n(50), n(99.9), n(100)]).toEqual([2, 3, 4, 4, 5]);
  });
  it("caso independiente: IP ≥ OB → N5 Independencia", () => {
    const m = calcularMetricas({
      ingresos: [{ nombre: "Arriendo", categoria: "Arriendo", mensual: 12000000 }],
      gastos: { Vida: [{ m: 5000000, frecuencia: "mensual" }] },
      deudas: [],
      inv: [{ n: "Local", tp: "Real Estate", va: 2e9, vc: 2e9, id: "l" }],
    });
    expect(m.coberturaPasiva).toBeCloseTo(240, 0);
    expect(m.nivel.nivel).toBe(5);
    expect(m.nivel.nombre).toBe("Independencia");
  });
  it("asalariado sin activos no es Independencia aunque su sueldo cubra los gastos", () => {
    const m = calcularMetricas({
      ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 5000000 }],
      gastos: { Vida: [{ m: 1000000, frecuencia: "mensual" }] },
    });
    expect(m.nivel.nivel).toBe(2);
  });
});

describe("liquidez", () => {
  it("pacto de permanencia y no líquidos quedan fuera", () => {
    expect(esLiquido({ tp: "CDT", permanencia: true })).toBe(false);
    expect(esLiquido({ tp: "Real Estate" })).toBe(false);
    expect(esLiquido({ tp: "Acciones" })).toBe(false);
    expect(esLiquido({ tp: "Cash" })).toBe(true);
  });
});
