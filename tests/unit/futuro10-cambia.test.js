import { describe, it, expect } from "vitest";
import { proyectarFuturo10, inversionesHoy, leerCambios } from "../../src/lib/futuro10.js";

// 22-nov-2026 (Santiago): dejar Puerto Madero para uso propio en el plan.
const user = () => ({
  trm: 4000, inflacionPct: 4,
  inv: [{ id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 3000e6 }, { id: "c", n: "Cash", liquido: true, va: 500e6 }],
  ingresos: [
    { nombre: "Renta domo", tipo: "pasivo", activoId: "pm", mensual: 20e6, frecuencia: "mensual" },
    { nombre: "Renta casa principal", tipo: "pasivo", activoId: "pm", mensual: 25e6, frecuencia: "mensual" },
    { nombre: "Salario", mensual: 60e6, frecuencia: "mensual" },
  ],
  gas: { Vivienda: [{ c: "Administración PM", activoId: "pm", mensual: 5e6, frecuencia: "mensual" }], Vida: [{ c: "Mercado", mensual: 20e6, frecuencia: "mensual" }] },
});

describe("paso 1: Cambia (renta nueva; 0 = deja de rentar)", () => {
  it("leerCambios ignora «renta distinta» sin monto", () => {
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: "" } } })).toEqual({});
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: 0, desde: 3 } } }).pm).toMatchObject({ modo: "propio", desde: 3 });
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: 30e6 } } }).pm).toMatchObject({ modo: "renta", desde: 1 });
  });

  it("uso propio desde ya: la renta deja de entrar y la administración pasa a gastos", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 1 } } });
    const b1 = base.filas[1], f1 = r.filas[1];
    expect(b1.ingresos - f1.ingresos).toBeCloseTo(40e6 * 12, -3); // neta 45 − 5
    expect(f1.gastos - b1.gastos).toBeCloseTo(5e6 * 12, -3);
    expect((f1.porActivo.find((x) => x.id === "pm") || {}).renta || 0).toBe(0);
    expect(f1.gastosItems.some((g) => g.nombre === "Administración PM")).toBe(true);
    expect(r.desglose.entra.some((x) => /Puerto Madero/.test(x.nombre))).toBe(false);
    expect(r.desglose.sale.some((x) => x.nombre === "Administración PM")).toBe(true);
  });

  it("uso propio desde el año 3: los años 1 y 2 siguen con renta", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 3 } } });
    expect(r.filas[2].ingresos).toBeCloseTo(base.filas[2].ingresos, -3);
    expect(r.filas[3].ingresos).toBeLessThan(base.filas[3].ingresos - 40e6 * 12);
    expect(r.filas[3].gastos).toBeGreaterThan(base.filas[3].gastos + 5e6 * 12);
    expect(r.filas[3].gastosItems.some((g) => g.nombre === "Administración PM")).toBe(true);
    expect(r.filas[2].gastosItems.some((g) => g.nombre === "Administración PM")).toBe(false);
  });

  it("renta distinta: la nueva renta neta reemplaza la de hoy desde el año elegido", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", desde: 1, mensual: 30e6 } } });
    expect(base.filas[1].ingresos - r.filas[1].ingresos).toBeCloseTo(10e6 * 12, -3);
    expect(r.filas[1].porActivo.find((x) => x.id === "pm").renta).toBeCloseTo(30e6 * 12, -3);
    expect(r.filas[1].gastos).toBeCloseTo(base.filas[1].gastos, -3);
  });

  it("inversionesHoy expone el cambio", () => {
    const x = inversionesHoy(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 2 } } }).find((y) => y.id === "pm");
    expect(x.cambio).toMatchObject({ modo: "propio", desde: 2 });
    expect(x.costoLigado).toBeCloseTo(5e6, -3);
    expect(x.vende).toBe(false);
  });
});
