import { describe, it, expect } from "vitest";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, resolverEscenario, cienMillones } from "../../src/lib/futuro10.js";

const cero = JSON.parse(JSON.stringify(SUPUESTOS_F10));
cero.presets.rfCorto.realSpread = 0; cero.presets.rfLargo.realSpread = 0;
cero.escenarios.base = { ...cero.escenarios.base, ingresosSpread: 0, gastosSpread: 0, retornoSpread: 0, spRealPct: 0 };

describe("futuro10", () => {
  it("retorno real 0 y flujo 0 → patrimonio real constante 10 años", () => {
    const u = { inflacionPct: 4, inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: 100e6 }, { id: "b", n: "ETF", tp: "ETF", va: 50e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { supuestos: cero });
    expect(r.filas).toHaveLength(11);
    r.filas.forEach((f) => expect(f.patrimonioReal).toBeCloseTo(150e6, 0));
    expect(r.final.patrimonio).toBeCloseTo(150e6 * 1.04 ** 10, 0); // inflación aplicada una sola vez
  });
  it("el vehículo no afecta el comparativo contra la inflación", () => {
    const base = { inflacionPct: 4, inv: [{ id: "a", tp: "Cash", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const con = { ...base, inv: [...base.inv, { id: "v", n: "Carro", tp: "Vehículo", va: 80e6 }] };
    const a = proyectarFuturo10(base, {}), b = proyectarFuturo10(con, {});
    expect(b.vsInflacionReal).toBeCloseTo(a.vsInflacionReal, 6);
    expect(b.final.patrimonio).toBeLessThan(a.final.patrimonio + 80e6);
    expect(b.final.activos - a.final.activos).toBeCloseTo(80e6 * 0.88 ** 3 * 0.92 ** 7, 0);
  });
  it("ingresos y gastos se proyectan con inflación (base: ingresos infl+1)", () => {
    const u = { inflacionPct: 4, inv: [], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 10e6 }], gas: { Vivienda: [{ n: "Arriendo", m: 6e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    const f1 = r.filas[1], f10 = r.filas[10];
    expect(f10.gastos / f1.gastos).toBeCloseTo(1.04 ** 9, 6);
    expect(f10.ingresos / f1.ingresos).toBeCloseTo((1.04 * 1.01) ** 9, 6);
  });
  it("CF negativo consume liquidez y alerta", () => {
    const u = { inflacionPct: 4, inv: [{ id: "a", tp: "Cash", va: 10e6 }], ingresos: [], gas: { Vida: [{ n: "Mercado", m: 1e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    expect(r.alertas.some((a) => a.tipo === "cf_negativo")).toBe(true);
    expect(r.alertas.some((a) => a.tipo === "activo_negativo")).toBe(true);
    expect(r.liqAgotadaAnio).not.toBeNull();
  });
  it("vender un activo lo manda a la bolsa y se reparte según el norte", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Casa", tp: "Real Estate", va: 500e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { c: { accion: "vende" } }, norte: "rentas" });
    expect(r.mezcla.renta).toBeCloseTo(65);
    expect(r.filas[0].activos).toBeCloseTo(500e6, 0);
  });
  it("presets: renta fija largo con tope y escenarios", () => {
    const opt = resolverEscenario("optimista", { inflacionPct: 4 });
    expect(opt.inflacionPct).toBe(3);
    // 3,5 + 1 = 4,5 = tope
    expect(retornoNominalPreset("rfLargo", opt)).toBeCloseTo((1.03 * 1.045 - 1) * 100, 6);
    const base = resolverEscenario("base", { inflacionPct: 4 });
    expect(retornoNominalPreset("sp500", base)).toBeCloseTo((1.04 * 1.065 - 1) * 100, 6);
    const c = cienMillones("rfCorto", base);
    expect(c[2].hoy).toBeCloseTo(100e6 * 1.025 ** 10, 0);
  });
  it("renta manual (rentaOrigen) es neta: no resta otra vez los gastos vinculados; vender quita esa renta", () => {
    const u = { inflacionPct: 4, inv: [{ id: "ap", n: "Apto", tp: "Real Estate", va: 400e6, rentaOrigen: "manual" }],
      ingresos: [{ nombre: "Arriendo", categoria: "Arriendo", mensual: 1.5e6, activoId: "ap" }],
      gas: { Vivienda: [{ n: "Administración", m: 400000, activoId: "ap" }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    expect(r.filas[1].ingresos).toBeCloseTo(18e6, 0);
    expect(r.filas[1].gastos).toBeCloseTo(0, 0);
    const v = proyectarFuturo10(u, { decisiones: { ap: { accion: "vende" } } });
    expect(v.filas[1].ingresos).toBeCloseTo(0, 0);
  });
});
