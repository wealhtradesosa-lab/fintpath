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
  // 24-oct-2026 (Santiago: "en Reinvierte necesito ver qué saldo me quedó de
  // lo que vendí"). La cuenta de la bolsa viaja en el resultado.
  it("la bolsa dice cuánto se vendió, cuánto se asignó y cuánto queda", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Casa", tp: "Real Estate", va: 500e6 }, { id: "e", n: "ETF", tp: "ETF", va: 50e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { c: { accion: "vende" } }, reinversiones: [{ activoId: "e", monto: 120e6 }], nuevas: [{ preset: "rfCorto", monto: 80e6 }] });
    expect(r.bolsaDetalle.vendido).toBe(500e6);
    expect(r.bolsaDetalle.reinvertido).toBe(120e6);
    expect(r.bolsaDetalle.nuevas).toBe(80e6);
    expect(r.bolsaDetalle.restante).toBeCloseTo(500e6 - r.bolsaDetalle.colchon - 200e6, 0);
    const r2 = proyectarFuturo10(u, { decisiones: { c: { accion: "vende" } }, reinversiones: [{ activoId: "e", monto: 900e6 }] });
    expect(r2.bolsaDetalle.faltante).toBeGreaterThan(0);
    expect(r2.bolsaDetalle.restante).toBe(0);
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

  describe("Lo que viene", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 2000e6 }], ingresos: [], gas: {}, deu: [] };
    it("ingreso futuro solo afecta los años activos", () => {
      const r0 = proyectarFuturo10(u, { supuestos: cero });
      const r = proyectarFuturo10(u, { supuestos: cero, futuros: { ingresos: [{ nombre: "Pensión", mensual: 5e6, desde: 4, hasta: 6 }] } });
      [1, 2, 3, 7, 10].forEach((t) => expect(r.filas[t].cf).toBeCloseTo(r0.filas[t].cf, 0));
      [4, 5, 6].forEach((t) => expect(r.filas[t].cf - r0.filas[t].cf).toBeCloseTo(60e6 * 1.04 ** t, 0));
    });
    it("pagos del activo futuro no cambian el patrimonio y se valoriza desde la entrega", () => {
      const r0 = proyectarFuturo10(u, { supuestos: cero });
      const fut = { activos: [{ nombre: "Local", clase: "inmueble", valor: 800e6, cuotaInicial: 300e6, anioCuota: 1, entrega: 2, valorizacionNomPct: 10 }] };
      const r = proyectarFuturo10(u, { supuestos: cero, futuros: fut });
      expect(r.filas[1].patrimonio).toBeCloseTo(r0.filas[1].patrimonio, 0);
      // año 2: la cuota no se valoriza antes de la entrega, pero la caja sí habría rendido 4%
      expect(r.filas[2].patrimonio).toBeCloseTo(r0.filas[2].patrimonio - 300e6 * 0.04, 0);
      expect(r.filas[3].patrimonio - r0.filas[3].patrimonio).toBeCloseTo(800e6 * (1.1 - 1.04) - 300e6 * 0.04 * 1.04, -2);
    });
    it("renta del activo futuro desde el año Z", () => {
      const r0 = proyectarFuturo10(u, { supuestos: cero });
      const r = proyectarFuturo10(u, { supuestos: cero, futuros: { activos: [{ nombre: "Local", valor: 500e6, entrega: 2, rentaMensual: 4e6, rentaDesde: 3 }] } });
      expect(r.filas[2].cf).toBeCloseTo(r0.filas[2].cf, 0);
      expect(r.filas[3].cf - r0.filas[3].cf).toBeCloseTo(48e6 * 1.04 ** 3, 0);
    });
    it("escenario viejo sin futuros carga igual", () => {
      expect(proyectarFuturo10(u, {}).final.patrimonio).toBeCloseTo(proyectarFuturo10(u, { futuros: undefined }).final.patrimonio, 0);
    });
  });
});

describe("futuro10 · deudas que se pagan con lo vendido", () => {
  // Orlando: 800 M con hipoteca de 300 M (cuota 4 M/mes) que cuelga de él (campo `la`).
  const U = () => ({ inflacionPct: 4,
    inv: [{ id: "orl", n: "Orlando", tp: "Real Estate", va: 800e6 }, { id: "cta", n: "Cuenta", tp: "Cash", va: 200e6 }],
    ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 30e6 }], gas: { Vida: [{ n: "Mercado", m: 5e6 }] },
    deu: [{ id: "h", n: "Hipoteca Orlando", mt: 300e6, pg: 4e6, la: "orl" }, { id: "t", n: "Tarjeta", mt: 50e6, pg: 2e6 }] });

  it("vender Orlando paga su deuda con esa venta, sin marcarla", () => {
    const sin = proyectarFuturo10(U(), {});
    const r = proyectarFuturo10(U(), { decisiones: { orl: { accion: "vende" } } });
    const h = r.deudas.find((d) => d.id === "h");
    expect(h.porVenta).toBe(true);
    expect(h.pagado).toBeCloseTo(300e6, 0);
    expect(r.bolsaDetalle.deudas).toBeCloseTo(300e6, 0);
    expect(r.filas[0].deuda).toBeCloseTo(50e6, 0); // queda solo la tarjeta
    expect(r.cuotasQueSalenMes).toBeCloseTo(4e6, 0);
    // pagar deuda con la venta no cambia el patrimonio de hoy
    expect(r.filas[0].patrimonio).toBeCloseTo(sin.filas[0].patrimonio, 0);
  });

  it("otra deuda marcada se paga con lo que queda de la venta", () => {
    const r = proyectarFuturo10(U(), { decisiones: { orl: { accion: "vende" } }, pagarDeudas: { t: true } });
    expect(r.bolsaDetalle.deudas).toBeCloseTo(350e6, 0);
    expect(r.filas[0].deuda).toBeCloseTo(0, 0);
    expect(r.filas.every((f) => f.anio === 0 || f.gastos < 12 * 6e6 * 2)).toBe(true);
  });

  it("sin ventas, marcar una deuda no la paga (solo se paga con lo vendido)", () => {
    const r = proyectarFuturo10(U(), { pagarDeudas: { t: true } });
    expect(r.bolsaDetalle.deudas).toBe(0);
    expect(r.filas[0].deuda).toBeCloseTo(350e6, 0);
    expect(r.bolsaDetalle.deudaSinCubrir).toBeCloseTo(50e6, 0);
  });

  it("si la venta no alcanza, abona hasta donde llega", () => {
    const u = U(); u.inv[0].va = 320e6;
    const r = proyectarFuturo10(u, { decisiones: { orl: { accion: "vende" } }, pagarDeudas: { t: true } });
    const t = r.deudas.find((d) => d.id === "t");
    expect(t.pagado).toBeCloseTo(20e6, 0);
    expect(r.filas[0].deuda).toBeCloseTo(30e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(0, 0);
  });
});

describe("futuro10 · inversiones nuevas se reflejan en el resultado", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "cta", n: "Cuenta", tp: "Cash", va: 300e6 }, { id: "casa", n: "Casa", tp: "Real Estate", va: 500e6 }], ingresos: [], gas: {}, deu: [] });

  it("sin vender nada, la inversión nueva sale de la liquidez y aparece en el reparto", () => {
    const r = proyectarFuturo10(U(), { nuevas: [{ preset: "sp500", monto: 100e6, nombre: "IBKR" }] });
    expect(r.bolsaDetalle.nuevas).toBeCloseTo(100e6, 0);
    expect(r.bolsaDetalle.desdeLiquidez).toBeCloseTo(100e6, 0);
    expect(r.reparto.some((x) => x.nombre === "IBKR" && x.valor > 100e6)).toBe(true);
    // mover plata de la cuenta a la inversión no cambia el patrimonio de hoy
    expect(r.filas[0].patrimonio).toBeCloseTo(800e6, 0);
  });

  it("reinvertir en lo que ya tienes sin ventas también usa la liquidez", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "casa", monto: 50e6 }] });
    expect(r.bolsaDetalle.reinvertido).toBeCloseTo(50e6, 0);
    expect(r.filas[0].patrimonio).toBeCloseTo(800e6, 0);
  });

  it("si la liquidez no alcanza, asigna hasta donde llega y lo dice", () => {
    const r = proyectarFuturo10(U(), { nuevas: [{ preset: "rfLargo", monto: 400e6 }] });
    expect(r.bolsaDetalle.nuevas).toBeCloseTo(300e6, 0);
    expect(r.bolsaDetalle.faltante).toBeCloseTo(100e6, 0);
  });

  it("la bolsa reporta el colchón de hoy, no el del año 10", () => {
    const u = U(); u.gas = { Vida: [{ n: "Mercado", m: 10e6 }] }; u.inv[0].va = 0;
    const r = proyectarFuturo10(u, { decisiones: { casa: { accion: "vende" } } });
    expect(r.bolsaDetalle.colchon).toBeCloseTo(60e6, 0);
  });
});

describe("futuro10 · lote que se transforma en bodega", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "orl", n: "Orlando", tp: "Real Estate", va: 900e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 50e6 }], ingresos: [], gas: {}, deu: [] });
  const bodega = { accion: "modifica", inversionMonto: 600e6, inversionAnio: 1, rentaNuevaMensual: 8.5e6, rentaNuevaDesdeMes: 6 };

  it("resume cuánto queda valiendo, la renta y desde cuándo", () => {
    const r = proyectarFuturo10(U(), { decisiones: { l: bodega } });
    const x = r.modificados.find((y) => y.id === "l");
    expect(x.valorConObra).toBeCloseTo(1000e6, 0);
    expect(x.rentaMensual).toBe(8.5e6);
    expect(x.rentaDesdeMes).toBe(6);
    expect(x.rentaPctAnual).toBeCloseTo(10.2, 6);
  });

  it("la renta que arranca a los 6 meses paga medio año 1 y el año 2 completo", () => {
    const sin = proyectarFuturo10(U(), {});
    const r = proyectarFuturo10(U(), { decisiones: { l: { accion: "modifica", rentaNuevaMensual: 8.5e6, rentaNuevaDesdeMes: 6 } } });
    expect(r.filas[1].rentaNueva).toBeCloseTo(8.5e6 * 6 * 1.04, 0);
    expect(r.filas[2].rentaNueva).toBeCloseTo(8.5e6 * 12 * 1.04 ** 2, 0);
    expect(r.filas[1].cf - sin.filas[1].cf).toBeCloseTo(8.5e6 * 6 * 1.04, 0);
  });

  it("la obra del año 1 sale del saldo de lo vendido", () => {
    const r = proyectarFuturo10(U(), { decisiones: { l: bodega, orl: { accion: "vende" } } });
    expect(r.bolsaDetalle.obras).toBeCloseTo(600e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(300e6, 0);
    expect(r.filas[0].patrimonio).toBeCloseTo(1350e6, 0);
  });

  it("escenarios guardados con rentaNuevaDesde (año) siguen funcionando", () => {
    const r = proyectarFuturo10(U(), { decisiones: { l: { accion: "modifica", rentaNuevaMensual: 5e6, rentaNuevaDesde: 3 } } });
    expect(r.filas[2].rentaNueva).toBe(0);
    expect(r.filas[3].rentaNueva).toBeCloseTo(60e6 * 1.04 ** 3, 0);
  });
});

describe("futuro10 · la tabla de ingresos muestra la renta nueva", () => {
  it("la bodega sube el ingreso del mes en la tabla", () => {
    const u = { inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", tp: "Cash", va: 900e6 }], ingresos: [{ nombre: "Honorarios", categoria: "Salario", mensual: 30e6 }], gas: {}, deu: [] };
    const sin = proyectarFuturo10(u, {});
    const r = proyectarFuturo10(u, { decisiones: { l: { accion: "modifica", rentaNuevaMensual: 8.5e6, rentaNuevaDesdeMes: 6 } } });
    expect((r.filas[2].ingresosReal - sin.filas[2].ingresosReal) / 12).toBeCloseTo(8.5e6, 0);
    expect((r.filas[1].ingresosReal - sin.filas[1].ingresosReal) / 12).toBeCloseTo(8.5e6 / 2, 0);
  });
});

describe("futuro10 · inversión personalizada del año 1 sale de lo vendido", () => {
  const U = () => ({ inflacionPct: 3, inv: [{ id: "f", n: "Finca", tp: "Real Estate", va: 11787e6 }, { id: "c", tp: "Cash", va: 100e6 }], ingresos: [], gas: {}, deu: [] });
  it("BTG 7.500 M en el año 1 baja el saldo de Te quedan", () => {
    const r = proyectarFuturo10(U(), { decisiones: { f: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 7500e6, anio: 1, rendimientoNomPct: 14, tipo: "valoriza" }] });
    expect(r.bolsaDetalle.nuevas).toBeCloseTo(7500e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(11787e6 - 7500e6, 0);
    expect(r.reparto.find((x) => x.nombre === "BTG").valor).toBeCloseTo(7500e6 * 1.14 ** 10, -3);
    expect(r.filas[0].patrimonio).toBeCloseTo(11887e6, 0);
  });
  it("una personalizada de un año siguiente queda programada, no descuenta hoy", () => {
    const r = proyectarFuturo10(U(), { decisiones: { f: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "Negocio", monto: 1000e6, anio: 3 }] });
    expect(r.bolsaDetalle.programadas).toBeCloseTo(1000e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(11787e6, 0);
  });
});
