// 24-nov-2026 — Indexación de «Mi futuro a 10 años» (Finanzas + Luis). Dos tasas:
//  · Indexación (editable; CO 5 %, EE. UU. 3 %): sueldo, gastos, ingresos, gastos y rentas futuras.
//  · Inflación del escenario (6/4/3 %): lleva a su año los montos únicos que escribes para
//    años futuros (compras, anticipos, aportes) y pasa a pesos de hoy, cada escenario con la suya.
//  · Año 1 = año en curso, tal cual; año t × (1+tasa)^(t−1). Los flujos del año t se deflactan
//    ÷ (1+inflación)^(t−1); el patrimonio al cierre del año t, ÷ (1+inflación)^t.
//  · Las cuotas fijas de los créditos no se indexan.
import { describe, it, expect } from "vitest";
import { proyectarFuturo10, patrimonioFinalHoy, inflacionDe, indexarAlAnio, indexacionDe, indexacionDefaultPct, INDEXACION_DEFAULT_PCT, cuentaPorAnio, SUPUESTOS_F10, SUPUESTOS_F10_US } from "../../src/lib/futuro10.js";

const U = () => ({ inv: [{ id: "c", n: "Apartamento", tp: "Real Estate", va: 400e6 }, { id: "a", n: "Cuenta", tp: "Cash", va: 30e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "Gastos", m: 6e6 }] }, deu: [] });
const FUT = { activos: [{ clase: "vivienda", nombre: "Casa", valor: 300e6, entrega: 4 }], gastos: [{ nombre: "Maestría", anual: 60e6, desde: 2, anios: 2 }] };
const REF = { decisiones: { c: { accion: "vende" } }, futuros: FUT };

describe("indexación · la tasa", () => {
  it("por defecto 5 % en Colombia y 3 % en EE. UU.; la que escribes manda", () => {
    expect(INDEXACION_DEFAULT_PCT).toEqual({ CO: 5, US: 3 });
    expect(indexacionDefaultPct(SUPUESTOS_F10)).toBe(5);
    expect(indexacionDefaultPct(SUPUESTOS_F10_US)).toBe(3);
    expect(indexacionDe({}, SUPUESTOS_F10)).toBe(5);
    expect(indexacionDe({ indexacionPct: "" }, SUPUESTOS_F10)).toBe(5);
    expect(indexacionDe({ indexacionPct: 0 }, SUPUESTOS_F10)).toBe(0);
    expect(indexacionDe({ indexacionPct: "7" }, SUPUESTOS_F10)).toBe(7);
    expect(indexacionDe({ indexacionPct: 2 }, SUPUESTOS_F10_US)).toBe(2);
  });
  it("el resultado la trae en el escenario (para el rótulo)", () => {
    const r = proyectarFuturo10(U(), { indexacionPct: 6 });
    expect(r.escenario.indexacionPct).toBe(6);
    expect(r.escenario.indexacionDefault).toBe(false);
    expect(proyectarFuturo10(U(), {}).escenario.indexacionDefault).toBe(true);
  });
  it("sueldo y gastos suben con la indexación, no con la inflación", () => {
    const r = proyectarFuturo10(U(), { escenario: "pesimista" });
    expect(r.filas[10].ingresos / r.filas[1].ingresos).toBeCloseTo(1.05 ** 9, 6);
    expect(r.filas[10].gastos / r.filas[1].gastos).toBeCloseTo(1.05 ** 9, 6);
  });
  it("indexación 0 %: sueldo y gastos quedan quietos en pesos de cada año", () => {
    const r = proyectarFuturo10(U(), { indexacionPct: 0 });
    r.filas.slice(1).forEach((f) => { expect(f.ingresos).toBeCloseTo(120e6, 0); expect(f.gastos).toBeCloseTo(72e6, 0); });
  });
  it("indexación = inflación: sueldo y gastos planos en pesos de hoy todos los años", () => {
    ["base", "pesimista", "optimista"].forEach((escenario) => {
      const inf = proyectarFuturo10(U(), { escenario }).escenario.inflacionPct;
      const r = proyectarFuturo10(U(), { escenario, indexacionPct: inf });
      r.filas.slice(1).forEach((f) => { expect(f.ingresosReal).toBeCloseTo(120e6, 0); expect(f.gastosReal).toBeCloseTo(72e6, 0); });
    });
  });
  it("las cuotas fijas de un crédito no se indexan", () => {
    const u = { ...U(), deu: [{ id: "d", n: "Crédito", mt: 500e6, pg: 3e6, tp: "Hipoteca" }] };
    const r = proyectarFuturo10(u, { indexacionPct: 10 });
    const sinIdx = proyectarFuturo10(u, { indexacionPct: 0 });
    // La diferencia de gastos entre 10 % y 0 % es solo la de los gastos (72 M), no la de la cuota.
    expect(r.filas[3].gastos - sinIdx.filas[3].gastos).toBeCloseTo(72e6 * (1.1 ** 2 - 1), 0);
    expect(sinIdx.filas[3].gastos - 72e6).toBeCloseTo(36e6, 0); // la cuota (3 M al mes) sí está y no sube
    expect(r.filas[3].gastos - 72e6 * 1.1 ** 2).toBeCloseTo(36e6, 0);
  });
});

describe("indexación · montos únicos en pesos de hoy, con la inflación del escenario", () => {
  it("el factor: año 1 sin indexar, año t × (1+i)^(t−1)", () => {
    expect(indexarAlAnio(4, 1)).toBe(1);
    expect(indexarAlAnio(4, 2)).toBeCloseTo(1.04, 10);
    expect(indexarAlAnio(4, 4)).toBeCloseTo(1.04 ** 3, 10);
  });
  it("la casa de 300 M de hoy se paga en 2029 a pesos de ese año, con la inflación del escenario (no la indexación)", () => {
    [["base", 1.04], ["pesimista", 1.06], ["optimista", 1.03]].forEach(([escenario, k]) => {
      const r = proyectarFuturo10(U(), { ...REF, escenario, indexacionPct: 9 });
      expect(r.pagosFuturos[0].monto).toBeCloseTo(300e6, 0);
      expect(r.pagosFuturos[0].montoAnio).toBeCloseTo(300e6 * k ** 3, 0);
      expect(r.filas[4].porActivo.find((x) => x.nombre === "Casa").valor).toBeCloseTo(300e6 * k ** 3, -3);
      expect(cuentaPorAnio(r, REF).find((g) => g.anio === 4).salen.find((s) => s.tipo === "F").monto).toBeCloseTo(300e6 * k ** 3, 0);
    });
  });
  it("un gasto futuro sube con la indexación: 60 M de hoy en 2027 son 63 M (5 %)", () => {
    const sin = proyectarFuturo10(U(), { decisiones: { c: { accion: "vende" } } });
    const r = proyectarFuturo10(U(), REF);
    expect(r.filas[2].gastos - sin.filas[2].gastos).toBeCloseTo(60e6 * 1.05, 0);
    expect(r.filas[3].gastos - sin.filas[3].gastos).toBeCloseTo(60e6 * 1.05 ** 2, 0);
  });
  it("lo del año 1 va tal cual: el patrimonio de 2026 no cambia", () => {
    expect(proyectarFuturo10(U(), REF).filas[1].patrimonio).toBeCloseTo(515599600, 0);
    expect(proyectarFuturo10(U(), { ...REF, indexacionPct: 0 }).filas[1].patrimonio).toBeCloseTo(515599600, 0);
  });
});

describe("indexación · pesos de hoy con la inflación de cada escenario", () => {
  it("cada escenario deflacta con su inflación (6 / 4 / 3 %)", () => {
    [["pesimista", 6], ["base", 4], ["optimista", 3]].forEach(([escenario, i]) => {
      const r = proyectarFuturo10(U(), { ...REF, escenario });
      expect(inflacionDe(r)).toBe(i);
      expect(r.filas[10].deflactor).toBeCloseTo((1 + i / 100) ** 10, 10);
      expect(r.filas[10].deflactorFlujo).toBeCloseTo((1 + i / 100) ** 9, 10);
      expect(patrimonioFinalHoy(r)).toBeCloseTo(r.filas[10].patrimonio / (1 + i / 100) ** 10, 0);
    });
  });
  it("caso de referencia (barra de prod 1.096.083.951 en 2035): cifras con indexación 5 %", () => {
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), REF))).toBeCloseTo(1055431843, -1);
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), { ...REF, escenario: "pesimista" }))).toBeCloseTo(875134580, -1);
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), { ...REF, escenario: "optimista" }))).toBeCloseTo(1167818840, -1);
  });
  it("con indexación 0 % el caso de referencia da 960.838.660", () => {
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), { ...REF, indexacionPct: 0 }))).toBeCloseTo(960838660, -1);
  });
});

describe("indexación · el campo en Supuestos", () => {
  it("se ve en cada paso, con 5 % por defecto, y guarda lo que escribes", async () => {
    const { renderToString } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { default: MiFuturo10 } = await import("../../src/components/MiFuturo10.jsx");
    const html = renderToString(createElement(MiFuturo10, { user: U(), guardado: { borrador: { escenario: "base" } }, pasoInicial: 0 }));
    expect(html).toContain('data-testid="f10-indexacion"');
    expect(html).toContain("¿Cuánto suben al año tus ingresos y gastos? (%)");
    expect(html).toMatch(/Ingresos y gastos \(suben al año\)/);
    const html2 = renderToString(createElement(MiFuturo10, { user: U(), guardado: { borrador: { escenario: "base", indexacionPct: 7 } }, pasoInicial: 0 }));
    expect(html2).toMatch(/7(,0)?\s?%\s?al año/);
  });
});
