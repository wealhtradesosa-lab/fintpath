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

// 22-nov-2026 (Santiago: "esta inversión dura 2 años: me devuelven el capital y dejo de recibir la renta").
describe("paso 1: se vende o vence en un año siguiente", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "rc", n: "Rapicredit fondeo", tipo: "otro", va: 3288e6 }, { id: "c", n: "Cash", liquido: true, va: 100e6 }],
    ingresos: [{ nombre: "Rapicredit", tipo: "pasivo", activoId: "rc", mensual: 54.8e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }],
    gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] } });
  it("vence en el año 3: renta hasta el año 2, capital vuelve y el patrimonio no se pierde", () => {
    const base = proyectarFuturo10(u(), {});
    const r = proyectarFuturo10(u(), { decisiones: { rc: { accion: "termina", desde: 3 } } });
    expect(r.filas[2].ingresos).toBeCloseTo(base.filas[2].ingresos, -3);
    expect(base.filas[3].ingresos - r.filas[3].ingresos).toBeGreaterThan(54.8e6 * 12);
    expect(r.filas[2].porActivo.some((x) => x.id === "rc" && x.valor > 0)).toBe(true);
    expect(r.filas[3].porActivo.some((x) => x.id === "rc")).toBe(false);
    // el capital no desaparece: el patrimonio del año 3 queda cerca del año 2 (no cae 3.288 M)
    expect(r.filas[3].patrimonio).toBeGreaterThan(r.filas[2].patrimonio * 0.98);
    expect(r.alertas.some((a) => a.tipo === "activo_termina" && a.anio === 3)).toBe(true);
    expect(r.bolsaDetalle.vendido).toBe(0); // no es una venta de hoy
  });
  it("inversionesHoy lo expone y no lo marca como vendido hoy", () => {
    const x = inversionesHoy(u(), { decisiones: { rc: { accion: "termina", desde: 3 } } }).find((y) => y.id === "rc");
    expect(x.termina).toBe(3); expect(x.vende).toBe(false);
  });
});

// 22-nov-2026 (Santiago): el vencimiento cargado en Patrimonio entra solo al plan.
import { vencimientosPatrimonio } from "../../src/lib/futuro10.js";
describe("vencimiento cargado en Patrimonio", () => {
  const Y = new Date().getFullYear();
  const u = (venceAnio, venceMes = 6) => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "cdt", n: "CDT", tipo: "CDT", va: 100e6, venceAnio, venceMes }, { id: "c", n: "Cash", liquido: true, va: 50e6 }],
    ingresos: [{ nombre: "Int CDT", tipo: "pasivo", activoId: "cdt", mensual: 1e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 20e6, frecuencia: "mensual" }], gas: {} });
  it("año del plan: este año → 2; a mitad del año siguiente → 2; diciembre → año siguiente", () => {
    expect(vencimientosPatrimonio(u(Y)).cdt).toBe(2);
    expect(vencimientosPatrimonio(u(Y + 1)).cdt).toBe(2);
    expect(vencimientosPatrimonio(u(Y + 1, 12)).cdt).toBe(3);
    expect(vencimientosPatrimonio(u(Y - 1)).cdt).toBeUndefined();
    expect(vencimientosPatrimonio(u(Y + 30)).cdt).toBeUndefined();
  });
  it("sin decidir nada, el plan libera el capital ese año; «se conserva» lo renueva", () => {
    const r = proyectarFuturo10(u(Y + 2), {});
    expect(r.liberados).toHaveLength(1); expect(r.liberados[0]).toMatchObject({ id: "cdt", anio: 3 });
    expect(r.liberados[0].monto).toBeGreaterThan(100e6 * 0.99);
    const x = inversionesHoy(u(Y + 2), {}).find((y) => y.id === "cdt");
    expect(x.termina).toBe(3); expect(x.terminaDePatrimonio).toBe(true);
    const r2 = proyectarFuturo10(u(Y + 2), { decisiones: { cdt: { accion: "continua" } } });
    expect(r2.liberados).toHaveLength(0);
  });
});
