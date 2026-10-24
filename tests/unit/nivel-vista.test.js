import { describe, it, expect } from "vitest";
import { nivelLibertad, umbralNivel, NIVELES } from "../../src/lib/metrics.js";
import { vistaNivel, estadoNivel } from "../../src/lib/nivelVista.js";

// Caso de la captura de Luis (24-oct-2026): metas Independencia $123.512.386/mes
// y Abundancia $160.566.101/mes (= 1,3×). Ingreso pasivo al 136%.
const ob = 123512386;
const ip = Math.round(ob * 1.36);

describe("nivel de libertad: una sola regla para badge, barra, tarjetas y titular", () => {
  it("las metas de las tarjetas salen de umbralNivel", () => {
    expect(umbralNivel(NIVELES[3], { ob })).toBe(ob);
    expect(Math.round(umbralNivel(NIVELES[4], { ob }))).toBe(160566102);
  });
  it("136% con meta de Abundancia en 130% → Abundancia 5/5 en todos lados", () => {
    const nv = nivelLibertad({ ip, ob, fl: 1 });
    expect(nv.nivel).toBe(5);
    const v = vistaNivel({ ip, ob, nivel: nv });
    expect(v.titular).toMatch(/^Estás en Abundancia \(nivel 5\/5\)\. Tu ingreso pasivo cubre el 136\s?% de tus gastos y cuotas: te sobra un 36\s?% cada mes\.$/);
    expect(v.desborde).toMatch(/^\+36\s?% por encima$/);
    expect(v.siguiente).toBeNull();
  });
  it("120% → Independencia y dice cuánto falta para Abundancia", () => {
    const ip2 = Math.round(ob * 1.2);
    const nv = nivelLibertad({ ip: ip2, ob, fl: 1 });
    const v = vistaNivel({ ip: ip2, ob, nivel: nv });
    expect(v.nombre).toBe("Independencia");
    expect(v.siguiente).toBe("Abundancia");
    expect(Math.round(v.faltaSiguiente)).toBe(Math.round(ob * 1.3 - ip2));
    expect(v.titular).not.toMatch(/antes de impuestos/);
  });
  it("debajo de 100% no hay desborde ni «te sobra»", () => {
    const nv = nivelLibertad({ ip: ob * 0.8, ob, obEsencial: ob * 0.5, fl: 1 });
    const v = vistaNivel({ ip: ob * 0.8, ob, nivel: nv });
    expect(v.desborde).toBeNull();
    expect(v.titular).not.toMatch(/te sobra/);
  });
  it("solo una tarjeta es la actual; las de abajo quedan pasadas", () => {
    const est = [1, 2, 3, 4, 5].map((id) => estadoNivel(id, 4));
    expect(est).toEqual(["pasado", "pasado", "pasado", "actual", "pendiente"]);
    expect(est.filter((e) => e === "actual")).toHaveLength(1);
  });
  it("sin datos no hay titular", () => {
    expect(vistaNivel({ ip: 0, ob: 0, nivel: nivelLibertad({}) })).toBeNull();
  });
});

describe("auditoría ingreso pasivo", () => {
  it("salario y venta de activos no cuentan como pasivo", async () => {
    const { tipoIngreso } = await import("../../src/lib/metrics.js");
    expect(tipoIngreso({ categoria: "Salario" })).toBe("activo");
    expect(tipoIngreso({ fiscalCode: "LAB_SALARIO" })).toBe("activo");
    expect(tipoIngreso({ fiscalCode: "CAP_VENTA_ACTIVOS" })).toBe("activo");
    expect(tipoIngreso({ categoria: "Arriendo" })).toBe("pasivo");
    expect(tipoIngreso({ categoria: "Pensión" })).toBe("pasivo");
  });
});

import { posEnBarra, metaNivel, ingresosOcultos, TOPE_BARRA } from "../../src/lib/nivelVista.js";
describe("escala de la barra y metas", () => {
  it("0–150%: 136% queda pasado de la marca de Abundancia y nada se corta", () => {
    expect(TOPE_BARRA).toBe(1.5);
    expect(posEnBarra(1.36)).toBeGreaterThan(posEnBarra(1.3));
    expect(posEnBarra(1.3)).toBeLessThan(100);
    expect(posEnBarra(1)).toBeCloseTo(66.67, 1);
  });
  it("Estabilidad: meta de flujo ≥ $0; Déficit sin meta; las demás en ingreso pasivo", () => {
    expect(metaNivel(NIVELES[0])).toBeNull();
    expect(metaNivel(NIVELES[1])).toEqual({ tipo: "flujo", monto: 0 });
    expect(metaNivel(NIVELES[4], { ob })).toEqual({ tipo: "pasivo", monto: ob * 1.3 });
  });
  it("lista los ingresos ocultos con nombre y monto mensual (USD a COP)", () => {
    expect(ingresosOcultos([
      { nombre: "Arriendo X", sim: false, mensual: 5000000 },
      { nombre: "Salario", mensual: 9 },
      { categoria: "Dividendos", sim: false, mensual: 100, moneda: "USD" },
    ], 4000)).toEqual([{ nombre: "Arriendo X", mensual: 5000000 }, { nombre: "Dividendos", mensual: 400000 }]);
  });
});
