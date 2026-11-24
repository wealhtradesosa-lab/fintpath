// 24-nov-2026 — Indexación de «Mi futuro a 10 años» (Finanzas, modelo de dos tasas).
//  · Todo monto que escribes va en pesos de hoy; el plan lo lleva a su año con la
//    inflación del escenario. Año 1 = año en curso, sin indexar; año t × (1+i)^(t−1).
//  · «Pesos de hoy» usa una sola tasa en todos los escenarios (la de Normales, 4 %).
import { describe, it, expect } from "vitest";
import { proyectarFuturo10, patrimonioFinalHoy, inflacionDe, indexarAlAnio, resolverEscenario, cuentaPorAnio } from "../../src/lib/futuro10.js";

const U = () => ({ inv: [{ id: "c", n: "Apartamento", tp: "Real Estate", va: 400e6 }, { id: "a", n: "Cuenta", tp: "Cash", va: 30e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "Gastos", m: 6e6 }] }, deu: [] });
const FUT = { activos: [{ clase: "vivienda", nombre: "Casa", valor: 300e6, entrega: 4 }], gastos: [{ nombre: "Maestría", anual: 60e6, desde: 2, anios: 2 }] };
const REF = { decisiones: { c: { accion: "vende" } }, futuros: FUT };

describe("indexación · montos en pesos de hoy", () => {
  it("el factor: año 1 sin indexar, año t × (1+i)^(t−1)", () => {
    expect(indexarAlAnio(4, 1)).toBe(1);
    expect(indexarAlAnio(4, 2)).toBeCloseTo(1.04, 10);
    expect(indexarAlAnio(4, 4)).toBeCloseTo(1.04 ** 3, 10);
  });
  it("la casa de 300 M de hoy se paga en 2029 a pesos de ese año", () => {
    const r = proyectarFuturo10(U(), REF);
    expect(r.pagosFuturos[0].monto).toBeCloseTo(300e6, 0); // lo que escribiste
    expect(r.pagosFuturos[0].montoAnio).toBeCloseTo(300e6 * 1.04 ** 3, 0); // lo que sale en 2029
    expect(r.filas[4].porActivo.find((x) => x.nombre === "Casa").valor).toBeCloseTo(300e6 * 1.04 ** 3, -3);
    const g4 = cuentaPorAnio(r, REF).find((g) => g.anio === 4);
    expect(g4.salen.find((s) => s.tipo === "F").monto).toBeCloseTo(300e6 * 1.04 ** 3, 0);
  });
  it("un gasto futuro sigue la regla del sueldo: 60 M en 2027 son 62,4 M (antes 64,9 M)", () => {
    const sin = proyectarFuturo10(U(), { decisiones: { c: { accion: "vende" } } });
    const r = proyectarFuturo10(U(), REF);
    expect(r.filas[2].gastos - sin.filas[2].gastos).toBeCloseTo(60e6 * 1.04, 0);
    expect(r.filas[3].gastos - sin.filas[3].gastos).toBeCloseTo(60e6 * 1.04 ** 2, 0);
  });
  it("lo del año 1 va tal cual: el año 1 no cambia", () => {
    const r = proyectarFuturo10(U(), REF);
    expect(r.filas[1].patrimonio).toBeCloseTo(515599600, 0);
  });
  it("un plan sin montos futuros no se mueve (Normales)", () => {
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), {}))).toBeCloseTo(1074718206, -1);
  });
  it("caso de referencia (barra en prod 1.096.083.951): ahora 1.094.631.146", () => {
    expect(patrimonioFinalHoy(proyectarFuturo10(U(), REF))).toBeCloseTo(1094631146, -1);
  });
});

describe("indexación · dos tasas", () => {
  it("cada escenario proyecta con su inflación y todos pasan a pesos de hoy con la misma (4 %)", () => {
    const prud = proyectarFuturo10(U(), { ...REF, escenario: "pesimista" });
    const fav = proyectarFuturo10(U(), { ...REF, escenario: "optimista" });
    expect(prud.escenario.inflacionPct).toBe(6);
    expect(fav.escenario.inflacionPct).toBe(3);
    [prud, fav, proyectarFuturo10(U(), REF)].forEach((r) => {
      expect(inflacionDe(r)).toBe(4);
      expect(r.filas[10].deflactor).toBeCloseTo(1.04 ** 10, 10);
      expect(patrimonioFinalHoy(r)).toBeCloseTo(r.filas[10].patrimonio / 1.04 ** 10, 0);
    });
    // Prudentes lleva la casa a 2029 con su propia inflación (6 %).
    expect(prud.pagosFuturos[0].montoAnio).toBeCloseTo(300e6 * 1.06 ** 3, 0);
  });
  it("si escribiste tu inflación, esa es la de pesos de hoy", () => {
    const e = resolverEscenario("pesimista", { inflacionPct: 5 });
    expect(e.inflacionPct).toBe(6);
    expect(e.inflacionHoyPct).toBe(5);
  });
  it("resultados guardados sin la tasa de hoy siguen leyendo la del escenario", () => {
    expect(inflacionDe({ escenario: { inflacionPct: 6 } })).toBe(6);
  });
});
