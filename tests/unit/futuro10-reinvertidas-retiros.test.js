import { describe, it, expect } from "vitest";
import { proyectarFuturo10, cuentaPorAnio, leerRetirosActivos } from "../../src/lib/futuro10.js";

// 26-nov-2026 (Santiago: "¿y si uno quiere disponer de esa renta en algún año o hacer un retiro?"): una inversión que
// se reinvierte (IBKR) puede empezar a pagarte desde un año, o darte una parte en un año. Esa plata sale de la inversión.
const user = { inflacionPct: 4,
  inv: [{ id: "ib", n: "Portafolio IBKR", tp: "Stocks", va: 1000e6 }, { id: "ap", n: "Apto", tp: "Real Estate", va: 800e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 100e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 30e6 }, { nombre: "Arriendo", categoria: "Arriendo", mensual: 4e6, activoId: "ap" }],
  gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [] };
const de = (r, t, id = "ib") => r.filas[t].porActivo.find((x) => x.id === id) || { valor: 0, renta: 0 };

describe("recibir lo que rinde una inversión que se reinvierte", () => {
  const base = proyectarFuturo10(user, {});
  it("la inversión se reconoce como una que se reinvierte; el inmueble no", () => {
    expect(base.reinvierten).toContain("ib");
    expect(base.reinvierten).not.toContain("ap");
  });
  it("lo que te paga sale de la inversión: su valor baja en eso mismo cada año", () => {
    const r = proyectarFuturo10(user, { rentasAnio: { ib: { 3: 5e6 } } });
    expect(de(r, 2).valor).toBeCloseTo(de(base, 2).valor, 0);              // antes, igual
    const paga3 = 5e6 * 12 * Math.pow(1.05, 2);
    expect(de(r, 3).renta).toBeCloseTo(paga3, 0);
    expect(de(base, 3).valor - de(r, 3).valor).toBeCloseTo(paga3, 0);      // el valor baja en lo que te pagó
    expect(de(r, 10).valor).toBeLessThan(de(base, 10).valor - paga3 * 7);  // y sigue bajando frente a no retirar
    expect(r.filas[3].ingresos - base.filas[3].ingresos).toBeCloseTo(paga3, 0);
  });
  it("la plata no se cuenta dos veces: el año en que empiezas a recibir, tu patrimonio es el mismo", () => {
    const r = proyectarFuturo10(user, { rentasAnio: { ib: { 3: 5e6 } } });
    expect(r.filas[3].patrimonio).toBeCloseTo(base.filas[3].patrimonio, 0);
  });
  it("si pides más de lo que queda, paga hasta donde alcance y deja de pagar", () => {
    const r = proyectarFuturo10(user, { rentasAnio: { ib: { 2: 60e6 } } });
    expect(de(r, 10).valor).toBeLessThan(1);
    expect(de(r, 10).renta).toBeLessThan(1);
    expect(r.alertas.some((a) => /se acaba/.test(a.texto))).toBe(true);
    r.filas.slice(1).forEach((f) => expect(de(r, f.anio).valor).toBeGreaterThanOrEqual(-0.5));
  });
  it("el arriendo de un inmueble sigue igual: cambiarlo no le quita valor", () => {
    const r = proyectarFuturo10(user, { rentasAnio: { ap: { 3: 9e6 } } });
    expect(de(r, 6, "ap").valor).toBeCloseTo(de(base, 6, "ap").valor, 0);
  });
});

describe("retirar una parte de una inversión de hoy (cfg.retirosActivos)", () => {
  const base = proyectarFuturo10(user, {});
  it("ese año la plata llega como capital disponible y la inversión baja en lo mismo", () => {
    const cfg = { retirosActivos: { ib: { 4: 200e6 } } }, r = proyectarFuturo10(user, cfg);
    const m = 200e6 * Math.pow(1.04, 3);
    const lib = r.liberados.find((l) => l.id === "ib_retiro");
    expect(lib.anio).toBe(4); expect(lib.monto).toBeCloseTo(m, 0); expect(lib.parcial).toBe(true);
    expect(de(r, 3).valor).toBeCloseTo(de(base, 3).valor, 0);
    expect(de(r, 4).valor).toBeLessThan(de(base, 4).valor - m + 1);
    const c = cuentaPorAnio(r, cfg);
    expect(c[3].llegan.some((x) => x.tipo === "retiro" && Math.abs(x.monto - m) < 1)).toBe(true);
  });
  it("no saca más de lo que hay y no revive una inversión vendida", () => {
    const r = proyectarFuturo10(user, { retirosActivos: { ib: { 3: 9e12 } } });
    expect(de(r, 3).valor).toBeLessThan(1);
    const v = proyectarFuturo10(user, { decisiones: { ib: { accion: "termina", desde: 3 } }, retirosActivos: { ib: { 5: 100e6 } } });
    expect(v.liberados.some((l) => l.id === "ib_retiro")).toBe(false);
  });
  it("lee solo años siguientes y montos válidos", () => {
    expect(leerRetirosActivos({ retirosActivos: { ib: { 1: 5, 3: "2000000", 11: 5, 4: "", 6: 0 } } })).toEqual([{ id: "ib", anio: 3, monto: 2000000 }]);
  });
});
