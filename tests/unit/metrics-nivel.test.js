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
    // IP cubre lo esencial (8M ≥ 6M) → sería N3, pero el patrimonio negativo lo topa en N2.
    const r = nivelLibertad({ ip: 8000000, ob: 10000000, obEsencial: 6000000, fl: 1000000, patrimonioNeto: -1 });
    expect(r.nivel).toBe(2);
    expect(r.candado).toBe("patrimonio_negativo");
  });
  it("FL < 0 → N1 Déficit", () => {
    expect(nivelLibertad({ ip: 1, ob: 10, fl: -5, patrimonioNeto: 1e6 }).nivel).toBe(1);
  });
  // 21-oct-2026 — Los escalones ya no son fracciones inventadas (25%/50%): se
  // anclan a lo esencial y al total. Con esencial = 60 de un total de 100:
  // bajo 60 es Estabilidad, 60 da Seguridad, 100 Independencia, 130 Abundancia.
  it("umbrales: esencial / total / 1,3× total", () => {
    const n = (c) => nivelLibertad({ ip: c, ob: 100, obEsencial: 60, fl: 1, patrimonioNeto: 1 }).nivel;
    expect([n(59.9), n(60), n(99.9), n(100), n(129.9), n(130)]).toEqual([2, 3, 3, 4, 4, 5]);
  });
  it("sin gastos clasificados, Seguridad es tan exigente como Independencia", () => {
    const n = (c) => nivelLibertad({ ip: c, ob: 100, fl: 1, patrimonioNeto: 1 }).nivel;
    expect([n(99.9), n(100)]).toEqual([2, 4]);
  });
  it("caso independiente: IP ≥ 1,3× OB → N5 Abundancia", () => {
    const m = calcularMetricas({
      ingresos: [{ nombre: "Arriendo", categoria: "Arriendo", mensual: 12000000 }],
      gastos: { Vida: [{ m: 5000000, frecuencia: "mensual" }] },
      deudas: [],
      inv: [{ n: "Local", tp: "Real Estate", va: 2e9, vc: 2e9, id: "l" }],
    });
    expect(m.coberturaPasiva).toBeCloseTo(240, 0);
    expect(m.nivel.nivel).toBe(5);
    expect(m.nivel.nombre).toBe("Abundancia");
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

describe("sin doble conteo de gastos del inmueble arrendado", () => {
  const m = qaMetricas();
  it("administración y predial (en u.gas) restan del IP y NO están en G/OB", () => {
    const gastosVidaSinInmueble = Object.entries(qa.gas)
      .filter(([c]) => c !== "Inmueble arrendado")
      .flatMap(([, it]) => it).reduce((s, g) => s + g.m, 0);
    expect(m.g).toBe(gastosVidaSinInmueble);        // 4.910.000
    expect(m.ob).toBe(m.g + m.sd);                  // 8.630.000
    expect(m.ip + m.costosNeteados).toBe(m.ipBruto);
  });
  it("si el costo supera la renta, solo el exceso vuelve a G (una vez)", () => {
    const r = calcularMetricas({
      ingresos: [{ categoria: "Rentas de capital", mensual: 100000, activoId: "x" }],
      gastos: { "Inmueble arrendado": [{ m: 250000, frecuencia: "mensual", activoId: "x" }] },
    });
    expect(r.ip).toBe(0);
    expect(r.g).toBe(150000);
  });
});

describe("casos de QA del simulador (misma fuente que el Dashboard)", () => {
  const cm = (ingresos, gastos, extra = {}) => calcularMetricas({ ingresos, gastos: { Vida: [{ m: gastos, frecuencia: "mensual" }] }, ...extra });
  it("salario 5M y gastos 3M: N2 con cobertura 0% (no «Nivel 4 · 166,7%»)", () => {
    const m = cm([{ categoria: "Salario", mensual: 5e6 }], 3e6);
    expect(m.coberturaPasiva).toBe(0);
    expect(m.nivel.nivel).toBe(2);
  });
  it("flujo −2M → Nivel 1", () => {
    const m = cm([{ categoria: "Salario", mensual: 3e6 }], 5e6);
    expect(m.fl).toBe(-2e6);
    expect(m.nivel.nivel).toBe(1);
  });
  it("patrimonio −100M con cobertura alta → N2 con candado", () => {
    const m = cm([{ categoria: "Dividendos", mensual: 5e6 }], 2e6, {
      deudas: [{ mt: 150e6, pg: 0 }], inv: [{ id: "a", tp: "Acciones", va: 50e6, vc: 50e6 }],
    });
    expect(m.patrimonioNeto).toBe(-100e6);
    expect(m.nivel.nivel).toBe(2);
    expect(m.nivel.candado).toBe("patrimonio_negativo");
  });
  it("dividendos 5M y gastos 2M → N5", () => {
    const m = cm([{ categoria: "Dividendos", mensual: 5e6 }], 2e6);
    expect(m.nivel.nivel).toBe(5);
  });
  it("QA Pro → N2 con 17,35%", () => {
    const m = qaMetricas();
    expect(m.nivel.nivel).toBe(2);
    expect(m.coberturaPasiva).toBeCloseTo(17.35, 2);
  });
});
