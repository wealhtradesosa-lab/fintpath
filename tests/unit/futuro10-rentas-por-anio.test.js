import { describe, it, expect } from "vitest";
import { proyectarFuturo10, leerRentasAnio } from "../../src/lib/futuro10.js";

// 25-nov-2026 (Santiago: "una propiedad que renta una plata un año y otra el otro"): la renta de un activo por tramos.
const user = { inflacionPct: 4,
  inv: [{ id: "ap", n: "Apto", tp: "Real Estate", va: 1000e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 100e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 30e6 }, { nombre: "Arriendo", categoria: "Arriendo", mensual: 5e6, activoId: "ap" }],
  gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [] };
const renta = (r, t) => (r.filas[t].porActivo.find((x) => x.id === "ap") || {}).renta || 0;

describe("renta de un activo por tramos (cfg.rentasAnio)", () => {
  it("sin tramos no cambia nada", () => {
    const a = proyectarFuturo10(user, {}), b = proyectarFuturo10(user, { rentasAnio: {} });
    expect(b.filas[10].patrimonio).toBe(a.filas[10].patrimonio);
    expect(renta(b, 5)).toBe(renta(a, 5));
  });
  it("desde el año del tramo paga lo nuevo, con la indexación, hasta el siguiente tramo", () => {
    const base = proyectarFuturo10(user, {});
    const r = proyectarFuturo10(user, { rentasAnio: { ap: { 3: 2e6, 5: 8e6 } } });
    const idx = (t) => Math.pow(1.05, t - 1);
    expect(renta(r, 2)).toBeCloseTo(renta(base, 2), 0);          // antes del primer tramo, igual
    expect(renta(r, 3)).toBeCloseTo(2e6 * 12 * idx(3), 0);        // baja en el año 3
    expect(renta(r, 4)).toBeCloseTo(2e6 * 12 * idx(4), 0);        // sigue el tramo
    expect(renta(r, 5)).toBeCloseTo(8e6 * 12 * idx(5), 0);        // sube en el año 5
    expect(renta(r, 10)).toBeCloseTo(8e6 * 12 * idx(10), 0);
    // El ingreso del año cambia en lo mismo que cambió la renta.
    expect(r.filas[3].ingresos - base.filas[3].ingresos).toBeCloseTo(renta(r, 3) - renta(base, 3), 0);
    expect(r.filas[5].ingresos - base.filas[5].ingresos).toBeCloseTo(renta(r, 5) - renta(base, 5), 0);
  });
  it("un tramo en 0 deja de pagar ese año; un activo vendido no revive su renta", () => {
    const r = proyectarFuturo10(user, { rentasAnio: { ap: { 4: 0 } } });
    expect(renta(r, 4)).toBe(0);
    const v = proyectarFuturo10(user, { decisiones: { ap: { accion: "termina", desde: 3 } }, rentasAnio: { ap: { 5: 9e6 } } });
    expect(renta(v, 5)).toBe(0);
  });
  it("lee solo años y valores válidos", () => {
    expect(leerRentasAnio({ rentasAnio: { ap: { 0: 1, 3: "2000000", 11: 5, 4: "", 6: "x" } } })).toEqual({ ap: { 3: 2000000 } });
  });
});
