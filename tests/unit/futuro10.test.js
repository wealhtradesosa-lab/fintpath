import { describe, it, expect } from "vitest";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, resolverEscenario, cienMillones, leerModifica } from "../../src/lib/futuro10.js";

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

  describe("Se modifica", () => {
    const lote = { inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 1000e6 }], ingresos: [], gas: {}, deu: [] };
    it("valorización nominal = inflación ⇒ valor real constante", () => {
      const u = { inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }], ingresos: [], gas: {}, deu: [] };
      const r = proyectarFuturo10(u, { decisiones: { l: { accion: "modifica", valorizacionNomPct: 4 } } });
      r.filas.forEach((f) => expect(f.patrimonioReal).toBeCloseTo(400e6, 0));
    });
    it("inversión adicional es neutra para el patrimonio el año del traslado", () => {
      const cfg0 = { supuestos: cero, decisiones: { l: { accion: "modifica", valorizacionNomPct: 4 } } };
      const a = proyectarFuturo10(lote, cfg0);
      const b = proyectarFuturo10(lote, { ...cfg0, decisiones: { l: { ...cfg0.decisiones.l, inversionMonto: 600e6, inversionAnio: 1 } } });
      expect(b.filas[1].patrimonio).toBeCloseTo(a.filas[1].patrimonio, 0);
      expect(b.filas[1].liquidez).toBeCloseTo(a.filas[1].liquidez - 600e6, 0);
      expect(b.alertas.some((x) => x.tipo === "inversion_adicional" && x.anio === 1)).toBe(true);
    });
    it("después del traslado se valoriza el total", () => {
      const u = { inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", tp: "Cash", va: 1000e6 }], ingresos: [], gas: {}, deu: [] };
      const r = proyectarFuturo10(u, { supuestos: cero, decisiones: { l: { accion: "modifica", valorizacionNomPct: 10, inversionMonto: 600e6, inversionAnio: 1 } } });
      const r0 = proyectarFuturo10(u, { supuestos: cero, decisiones: { l: { accion: "modifica", valorizacionNomPct: 10 } } });
      // año 2: (400·1,1 + 600)·1,1 vs 400·1,1² → diferencia 600·1,1 menos lo que habría rendido la caja (600·1,04)
      expect(r.filas[2].patrimonio - r0.filas[2].patrimonio).toBeCloseTo(600e6 * (1.1 - 1.04), -2);
    });
    it("renta nueva aumenta el flujo desde el año X", () => {
      const r = proyectarFuturo10(lote, { decisiones: { l: { accion: "modifica", rentaNuevaMensual: 5e6, rentaNuevaDesde: 3 } } });
      const r0 = proyectarFuturo10(lote, {});
      expect(r.filas[2].cf).toBeCloseTo(r0.filas[2].cf, 0);
      expect(r.filas[3].cf - r0.filas[3].cf).toBeCloseTo(60e6 * 1.04 ** 3, 0);
    });
    it("escenario guardado con retornoRealPct viejo sigue cargando", () => {
      const viejo = proyectarFuturo10(lote, { decisiones: { l: { accion: "modifica", retornoRealPct: 2 } } });
      const nuevo = proyectarFuturo10(lote, { decisiones: { l: { accion: "modifica", valorizacionNomPct: (1.04 * 1.02 - 1) * 100 } } });
      expect(viejo.final.patrimonio).toBeCloseTo(nuevo.final.patrimonio, 0);
      expect(leerModifica({ retornoRealPct: 0 }, resolverEscenario("base", { inflacionPct: 4 })).valorizacionNomPct).toBeCloseTo(4, 6);
    });
  });

  describe("Inversión personalizada", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 500e6 }], ingresos: [], gas: {}, deu: [] };
    const cus = (o) => ({ supuestos: cero, nuevas: [{ preset: "custom", nombre: "Negocio", monto: 200e6, anio: 1, ...o }] });
    it("rendimiento nominal = inflación ⇒ valor real constante", () => {
      const r = proyectarFuturo10(u, cus({ rendimientoNomPct: 4 }));
      r.filas.forEach((f) => expect(f.patrimonioReal).toBeCloseTo(500e6, 0));
    });
    it("paga renta vs solo se valoriza: retorno total parecido", () => {
      const a = proyectarFuturo10(u, cus({ rendimientoNomPct: 10, tipo: "renta" }));
      const b = proyectarFuturo10(u, cus({ rendimientoNomPct: 10, tipo: "valoriza" }));
      expect(a.filas[1].patrimonio).toBeCloseTo(b.filas[1].patrimonio, 0);
      expect(a.filas[1].cf).toBeCloseTo(200e6 * 0.06, 0);
      expect(Math.abs(a.final.patrimonio / b.final.patrimonio - 1)).toBeLessThan(0.1);
    });
    it("escenario guardado (JSON) recarga igual", () => {
      const cfg = cus({ rendimientoNomPct: 8, moneda: "USD", anio: 3 });
      const r1 = proyectarFuturo10(u, cfg), r2 = proyectarFuturo10(u, JSON.parse(JSON.stringify(cfg)));
      expect(r2.final.patrimonio).toBeCloseTo(r1.final.patrimonio, 0);
      expect(r1.hayUSD).toBe(true);
      expect(r1.filas[2].patrimonio).toBeCloseTo(proyectarFuturo10(u, { supuestos: cero }).filas[2].patrimonio, 0);
    });
  });
});
