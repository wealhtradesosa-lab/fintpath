import { describe, it, expect } from "vitest";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, resolverEscenario, cienMillones, leerModifica, migrarModifica, leerFuentesPago } from "../../src/lib/futuro10.js";

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
    // 24-oct-2026: lo que no alcanza para aumentar lo que ya tienes se paga en el año 1 (no se recorta).
    expect(r2.bolsaDetalle.pendienteAnio1).toBeGreaterThan(0);
    expect(r2.bolsaDetalle.faltante).toBe(0);
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
      // 24-oct-2026: «paga renta» paga la tasa completa (10 % de 200 M), como un CDT.
      expect(a.filas[1].cf).toBeCloseTo(200e6 * 0.10, 0);
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
  // 25-oct-2026: si sale «de lo que vendo», se aparta hoy (Santiago: "le bajé
  // 100 M a Ledger y sigue saliendo que me pasé"). De tus cuentas: programada.
  it("una personalizada de un año siguiente se aparta de lo vendido; de tus cuentas queda programada", () => {
    const r = proyectarFuturo10(U(), { decisiones: { f: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "Negocio", monto: 1000e6, anio: 3 }] });
    expect(r.bolsaDetalle.reservado).toBeCloseTo(1000e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(10787e6, 0);
    const l = proyectarFuturo10(U(), { decisiones: { f: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "Negocio", monto: 1000e6, anio: 3, fuente: "liquidez" }] });
    expect(l.bolsaDetalle.programadas).toBeCloseTo(1000e6, 0);
    expect(l.bolsaDetalle.restante).toBeCloseTo(11787e6, 0);
  });
});

describe("futuro10 · un solo camino para meterle plata a lo que ya tienes", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "orl", n: "Orlando", tp: "Real Estate", va: 900e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 50e6 }], ingresos: [], gas: {}, deu: [] });
  it("reinvertir en el lote con renta: hoy + aporte = total y la renta entra desde el mes 6", () => {
    const sin = proyectarFuturo10(U(), { decisiones: { orl: { accion: "vende" } } });
    const r = proyectarFuturo10(U(), { decisiones: { orl: { accion: "vende" } }, reinversiones: [{ activoId: "l", monto: 600e6, rentaMensual: 8.5e6, rentaDesdeMes: 6 }] });
    const d = r.reinversionesDetalle[0];
    expect(d.valorHoy).toBeCloseTo(400e6, 0); expect(d.aporte).toBeCloseTo(600e6, 0); expect(d.total).toBeCloseTo(1000e6, 0);
    expect(d.rentaPctAnual).toBeCloseTo(10.2, 6);
    expect(r.filas[1].rentaNueva - sin.filas[1].rentaNueva).toBeCloseTo(8.5e6 * 6 * 1.04, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(300e6, 0);
  });
  it("un «Se modifica» guardado se pasa a Reinvierte sin perder nada", () => {
    const viejo = { decisiones: { l: { accion: "modifica", inversionMonto: 600e6, inversionAnio: 1, rentaNuevaMensual: 8.5e6, rentaNuevaDesdeMes: 6, valorizacionNomPct: 5 } } };
    const nuevo = migrarModifica(viejo);
    expect(nuevo.decisiones.l.accion).toBe("continua");
    expect(nuevo.reinversiones).toEqual([{ activoId: "l", monto: 600e6, anio: 1, rentaMensual: 8.5e6, rentaDesdeMes: 6, valorizacionNomPct: 5 }]);
    const a = proyectarFuturo10(U(), viejo), b = proyectarFuturo10(U(), nuevo);
    expect(b.filas[2].rentaNueva).toBeCloseTo(a.filas[2].rentaNueva, 0);
    // Antes la obra del año 1 se valorizaba desde el año 2; en Reinvierte, desde que se invierte.
    expect(Math.abs(b.final.patrimonio / a.final.patrimonio - 1)).toBeLessThan(0.05);
  });
  it("aporte en un año siguiente queda programado y entra ese año", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "l", monto: 100e6, anio: 3 }] });
    expect(r.bolsaDetalle.programadas + r.bolsaDetalle.reservado).toBeCloseTo(100e6, 0);
    expect(r.alertas.some((x) => x.tipo === "inversion_adicional" && x.anio === 3)).toBe(true);
  });
});

describe("futuro10 · aumentar lo que ya tienes cuando la plata no alcanza", () => {
  it("no recorta la obra: lo que falta se paga en el año 1", () => {
    const u = { inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", tp: "Cash", va: 100e6 }], ingresos: [{ nombre: "Honorarios", categoria: "Salario", mensual: 40e6 }], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { reinversiones: [{ activoId: "l", monto: 600e6, rentaMensual: 8.5e6, rentaDesdeMes: 6 }] });
    expect(r.reinversionesDetalle[0].total).toBeCloseTo(1000e6, 0);
    expect(r.bolsaDetalle.pendienteAnio1).toBeCloseTo(500e6, 0);
    expect(r.bolsaDetalle.faltante).toBeCloseTo(0, 0);
    expect(r.reparto.find((x) => x.nombre === "Lote").valor).toBeGreaterThan(1000e6);
  });
});

describe("futuro10 · la tabla trae el gasto del mes", () => {
  it("gastosReal existe en todas las filas y no es cero con gastos", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 500e6 }], ingresos: [{ nombre: "S", categoria: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "Mercado", m: 8e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    r.filas.slice(1).forEach((f) => { expect(Number.isFinite(f.gastosReal)).toBe(true); expect(f.gastosReal / 12).toBeGreaterThan(7e6); });
  });
});

describe("futuro10 · cada tipo de inversión pregunta lo suyo", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "l", n: "Lote", tp: "Lote", va: 410e6 }, { id: "ib", n: "IBKR", tp: "ETF", va: 500e6 }, { id: "c", tp: "Cash", va: 3000e6 }], ingresos: [], gas: {}, deu: [] });
  it("trading: rinde 20 %, todo se reinvierte → interés compuesto, nada al flujo", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "ib", monto: 1500e6, rendimientoNomPct: 20, pctRecibe: 0 }] });
    const d = r.reinversionesDetalle[0];
    expect(d.total).toBeCloseTo(2000e6, 0); expect(d.rindeAnual).toBeCloseTo(400e6, 0); expect(d.teLlegaMes).toBe(0);
    expect(r.reparto.find((x) => x.nombre === "IBKR").valor).toBeCloseTo(2000e6 * 1.2 ** 10, -4);
    expect(r.filas[1].rentaNueva).toBe(0);
  });
  it("trading: te llega la mitad → entra al flujo y crece a la mitad", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "ib", monto: 1500e6, rendimientoNomPct: 20, pctRecibe: 50 }] });
    const d = r.reinversionesDetalle[0];
    expect(d.teLlegaMes).toBeCloseTo(2000e6 * 0.2 * 0.5 / 12, 0);
    expect(r.filas[1].rentaNueva).toBeCloseTo(2000e6 * 0.1, -3);
    expect(r.reparto.find((x) => x.nombre === "IBKR").valor).toBeCloseTo(2000e6 * 1.1 ** 10, -4);
  });
  it("inmueble: lote 410 + 600 = 1.010, se valoriza al % que digas", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "l", monto: 600e6, rentaMensual: 8.5e6, rentaDesdeMes: 12, valorizacionNomPct: 6 }] });
    const d = r.reinversionesDetalle[0];
    expect(d.total).toBeCloseTo(1010e6, 0); expect(d.valorizacionPct).toBeCloseTo(6, 6); expect(d.rendimientoPct).toBeNull();
    expect(r.reparto.find((x) => x.nombre === "Lote").valor).toBeCloseTo(1010e6 * 1.06 ** 10, -4);
  });
});

describe("futuro10 · ingreso futuro que sale de un activo", () => {
  it("aplica la valorización al activo elegido y la renta entra desde el año dicho", () => {
    const u = { inflacionPct: 4, inv: [{ id: "loc", n: "Local", tp: "Local Comercial", va: 800e6 }, { id: "c", tp: "Cash", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { futuros: { ingresos: [{ nombre: "Renta local", mensual: 5e6, desde: 2, activoId: "loc", valorizacionNomPct: 6 }], activos: [] } });
    expect(r.reparto.find((x) => x.nombre === "Local").valor).toBeCloseTo(800e6 * 1.06 ** 10, -4);
    expect(r.filas[1].rentaNueva).toBe(0);
    expect(r.filas[2].rentaNueva).toBeGreaterThan(0);
  });
});

describe("futuro10 · de dónde sale la plata de cada inversión", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 1000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 430e6 }, { id: "c", tp: "Cash", va: 200e6 }], ingresos: [], gas: {}, deu: [] });
  it("de lo que vendo: sale de la venta de Puerto Madero", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, reinversiones: [{ activoId: "l", monto: 600e6, fuente: "venta" }] });
    const d = r.reinversionesDetalle[0];
    expect(d.deVenta).toBeCloseTo(600e6, 0); expect(d.deNuevo).toBe(0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(400e6, 0);
    expect(r.vendidos[0].nombre).toBe("Puerto Madero");
  });
  it("capital nuevo: no toca lo vendido y suma al patrimonio", () => {
    const sin = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } } });
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, reinversiones: [{ activoId: "l", monto: 600e6, fuente: "nuevo" }] });
    expect(r.reinversionesDetalle[0].deNuevo).toBeCloseTo(600e6, 0);
    expect(r.bolsaDetalle.capitalNuevo).toBeCloseTo(600e6, 0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(sin.bolsaDetalle.restante, 0);
    expect(r.filas[0].patrimonio - sin.filas[0].patrimonio).toBeCloseTo(600e6, 0);
  });
  it("de mi liquidez: no toca lo vendido", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, reinversiones: [{ activoId: "l", monto: 150e6, fuente: "liquidez" }] });
    const d = r.reinversionesDetalle[0];
    expect(d.deLiquidez).toBeCloseTo(150e6, 0); expect(d.deVenta).toBe(0);
    expect(r.bolsaDetalle.restante).toBeCloseTo(1000e6, 0);
  });
});

describe("futuro10 · deuda sin intereses de un solo pago", () => {
  const U = (extra = {}) => ({ inflacionPct: 4, inv: [{ id: "loc", n: "Local", tp: "Local Comercial", va: 900e6 }, { id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 1000e6 }, { id: "c", tp: "Cash", va: 600e6 }], ingresos: [], gas: {}, deu: [{ id: "s", n: "Saldo local", mt: 437e6, pg: 0, ts: 0, tipoInteres: "sin_interes", la: "loc", ...extra }, { id: "h", n: "Hipoteca", mt: 100e6, pg: 2e6, ts: 12 }] });
  it("no se amortiza con las cuotas de otras deudas: resta igual hasta pagarla", () => {
    const r = proyectarFuturo10(U(), {});
    expect(r.filas[0].deuda).toBeCloseTo(537e6, 0);
    const ult = r.filas[10];
    expect(ult.deuda).toBeCloseTo(437e6, 0); // la hipoteca se saldó; el saldo del local sigue
  });
  it("se paga con la venta de Puerto Madero si la marcas", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, pagarDeudas: { s: true } });
    expect(r.deudas.find((d) => d.id === "s").pagado).toBeCloseTo(437e6, 0);
    expect(r.filas[0].deuda).toBeCloseTo(100e6, 0);
  });
  it("con año de pago, sale de la liquidez ese año", () => {
    const anio = new Date().getFullYear() + 2; // año 3 de la proyección
    const r = proyectarFuturo10(U({ pagoUnicoAnio: anio }), {});
    expect(r.filas[2].deuda).toBeGreaterThan(437e6 - 1);
    expect(r.filas[3].deuda).toBeLessThan(437e6);
    expect(r.alertas.some((a) => a.tipo === "pago_unico" && a.anio === 3)).toBe(true);
  });
});

describe("futuro10 · el detalle de inversiones nuevas es lo que se invierte hoy", () => {
  it("nuevasDetalle.monto no cambia con los años", () => {
    const u = { inflacionPct: 6.3, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 8700e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 5000e6, anio: 1, rendimientoNomPct: 10.5, tipo: "renta" }, { preset: "rfCorto", monto: 1000e6 }] });
    expect(r.nuevasDetalle.map((x) => x.monto)).toEqual([5000e6, 1000e6]);
  });
  it("cada año trae lo que produce: renta + crece = produce", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 1000e6 }], ingresos: [{ nombre: "S", categoria: "Salario", mensual: 20e6 }], gas: { V: [{ n: "x", m: 5e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    r.filas.slice(1).forEach((f) => { expect(f.produce).toBeCloseTo(f.rentas + f.crece, 0); expect(f.porActivo.length).toBeGreaterThan(0); });
  });
});

describe("futuro10 · renta fija personalizada paga la tasa completa", () => {
  const U = () => ({ inflacionPct: 3, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 9000e6 }], ingresos: [], gas: {}, deu: [] });
  it("BTG 7.164 M al 10,5 %, te llega todo: $62,7 M al mes y el capital queda igual", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 7164e6, anio: 1, rendimientoNomPct: 10.5, pctRecibe: 100 }] });
    expect(r.filas[1].rentaNueva / 12).toBeCloseTo(7164e6 * 0.105 / 12, -3);
    expect(r.reparto.find((x) => x.nombre === "BTG").valor).toBeCloseTo(7164e6, -3);
  });
  it("escenarios viejos con tipo renta siguen pagando (ahora la tasa completa)", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 1000e6, anio: 1, rendimientoNomPct: 10, tipo: "renta" }] });
    expect(r.filas[1].rentaNueva).toBeCloseTo(100e6, -3);
  });
  it("si no te llega nada, todo se reinvierte con interés compuesto", () => {
    const r = proyectarFuturo10(U(), { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 1000e6, anio: 1, rendimientoNomPct: 10, pctRecibe: 0 }] });
    expect(r.filas[1].rentaNueva).toBe(0);
    expect(r.reparto.find((x) => x.nombre === "BTG").valor).toBeCloseTo(1000e6 * 1.1 ** 10, -4);
  });
});

describe("futuro10 · al vender se van la renta y todos los gastos del activo", () => {
  it("Orlando renta 22,6 M y cuesta 24,8 M: al venderlo no queda el exceso en los gastos", () => {
    const u = { inflacionPct: 4, inv: [{ id: "orl", n: "Orlando", tp: "Real Estate", va: 460e6 }, { id: "c", tp: "Cash", va: 100e6 }],
      ingresos: [{ nombre: "Arriendo Orlando", categoria: "Arriendo", mensual: 22.6e6, activoId: "orl" }, { nombre: "Sueldo", categoria: "Salario", mensual: 50e6 }],
      gas: { Vivienda: [{ n: "Admin Orlando", m: 24.8e6, activoId: "orl" }], Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { orl: { accion: "vende" } } });
    expect(r.filas[1].gastos / 12).toBeCloseTo(20e6, -2);
    expect(r.filas[1].ingresos / 12).toBeCloseTo(50e6, -2);
  });
});

describe("futuro10 · desglose del año 1 cuadra con la proyección", () => {
  it("entra y sale suman lo mismo que la fila del año 1, y avisa lo que se reinvierte", () => {
    const u = { inflacionPct: 4, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 9000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 400e6 }],
      ingresos: [{ nombre: "Arriendo PM", categoria: "Arriendo", mensual: 47e6, activoId: "pm" }, { nombre: "Fee", categoria: "Honorarios", mensual: 13e6 }],
      gas: { Vida: [{ n: "Familia", m: 21e6 }] }, deu: [{ id: "f", n: "Ford", mt: 157e6, pg: 4.5e6, ts: 20 }] };
    const r = proyectarFuturo10(u, { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 8500e6, anio: 1, rendimientoNomPct: 14, pctRecibe: 0 }], reinversiones: [{ activoId: "l", monto: 300e6, rentaMensual: 8e6 }] });
    const sum = (l) => l.reduce((s, x) => s + x.mensual, 0);
    expect(sum(r.desglose.entra)).toBeCloseTo(r.filas[1].ingresos / 12, -2);
    expect(sum(r.desglose.sale)).toBeCloseTo(r.filas[1].gastos / 12, -2);
    expect(r.desglose.reinvierte[0].nombre).toBe("BTG");
    expect(r.desglose.reinvierte[0].mensual).toBeCloseTo(8500e6 * 0.14 / 12, -3);
    const r2 = proyectarFuturo10(u, { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 8500e6, anio: 1, rendimientoNomPct: 14, pctRecibe: 100 }] });
    expect(r2.desglose.entra.find((x) => x.nombre === "BTG").mensual).toBeCloseTo(8500e6 * 0.14 / 12, -3);
  });
});

describe("futuro10 · gastos futuros (universidad de los hijos)", () => {
  it("180 M al año desde el año 4, durante 4 años: sube con la inflación y se acaba", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 2000e6 }], ingresos: [{ nombre: "S", categoria: "Salario", mensual: 50e6 }], gas: { V: [{ n: "x", m: 20e6 }] }, deu: [] };
    const sin = proyectarFuturo10(u, {});
    const r = proyectarFuturo10(u, { futuros: { gastos: [{ nombre: "Universidad", anual: 180e6, desde: 4, anios: 4 }] } });
    expect(r.filas[3].gastos).toBeCloseTo(sin.filas[3].gastos, 0);
    expect(r.filas[4].gastos - sin.filas[4].gastos).toBeCloseTo(180e6 * 1.04 ** 4, -2);
    expect(r.filas[7].gastos - sin.filas[7].gastos).toBeCloseTo(180e6 * 1.04 ** 7, -2);
    expect(r.filas[8].gastos).toBeCloseTo(sin.filas[8].gastos, 0);
    expect(r.final.patrimonio).toBeLessThan(sin.final.patrimonio);
  });
});

describe("futuro10 · gastos que se acaban", () => {
  it("un mantenimiento que se acaba en 2 años deja de restar desde ese año", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", tp: "Cash", va: 2000e6 }], ingresos: [{ nombre: "S", categoria: "Salario", mensual: 50e6 }], gas: { Mantenimiento: [{ c: "Finca", m: 3e6 }], Vida: [{ c: "Mercado", m: 20e6 }] }, deu: [] };
    const sin = proyectarFuturo10(u, {});
    expect(sin.gastosHoy.find((g) => g.key === "Mantenimiento::finca").nombre).toBe("Finca");
    const r = proyectarFuturo10(u, { gastosTerminan: { "Mantenimiento::0": 3 } });
    expect(r.filas[2].gastos).toBeCloseTo(sin.filas[2].gastos, 0);
    expect(sin.filas[3].gastos - r.filas[3].gastos).toBeCloseTo(3e6 * 12 * (1.04) ** 2, -2);
    const ya = proyectarFuturo10(u, { gastosTerminan: { "Mantenimiento::0": 1 } });
    expect(ya.desglose.sale.some((x) => x.nombre === "Finca")).toBe(false);
    expect(ya.desglose.sale.reduce((s, x) => s + x.mensual, 0)).toBeCloseTo(ya.filas[1].gastos / 12, -2);
  });
});

describe("futuro10 · casa propia en 5 años pagada con una inversión", () => {
  it("la plata sale de BTG ese año; lo que falta, de la liquidez", () => {
    const u = { inflacionPct: 4, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 9000e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }], ingresos: [], gas: {}, deu: [] };
    const cfg = { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 5000e6, anio: 1, rendimientoNomPct: 10, pctRecibe: 100 }],
      futuros: { activos: [{ nombre: "Casa", clase: "vivienda", valor: 3900e6, cuotaInicial: 3900e6, anioCuota: 5, entrega: 5, fuenteId: "nueva_0" }] } };
    const r = proyectarFuturo10(u, cfg);
    const btg4 = r.filas[4].porActivo.find((x) => x.nombre === "BTG").valor, btg5 = r.filas[5].porActivo.find((x) => x.nombre === "BTG").valor;
    expect(btg4 - btg5).toBeCloseTo(3900e6, -3);
    expect(r.filas[5].porActivo.find((x) => x.nombre === "Casa").valor).toBeCloseTo(3900e6, -3);
    expect(Math.abs(r.filas[5].patrimonio - r.filas[4].patrimonio) / r.filas[4].patrimonio).toBeLessThan(0.1);
    expect(r.alertas.some((a) => a.tipo === "pago_futuro" && /de BTG/.test(a.texto))).toBe(true);
    expect(r.fuentes.some((f) => f.id === "nueva_0")).toBe(true);
  });
});

describe("futuro10 · una compra futura puede salir de varias inversiones", () => {
  it("50 % de BTG y 50 % de IBKR", () => {
    const u = { inflacionPct: 4, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 9000e6 }, { id: "ib", n: "IBKR", tp: "ETF", va: 3000e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }], ingresos: [], gas: {}, deu: [] };
    const cfg = { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 5000e6, anio: 1, rendimientoNomPct: 10, pctRecibe: 100 }],
      futuros: { activos: [{ nombre: "Casa", clase: "vivienda", valor: 2000e6, entrega: 3, fuentes: [{ id: "nueva_0", pct: 50 }, { id: "ib", pct: 50 }] }] } };
    const r = proyectarFuturo10(u, cfg);
    const v = (t, n) => r.filas[t].porActivo.find((x) => x.nombre === n).valor;
    expect(v(2, "BTG") - v(3, "BTG")).toBeCloseTo(1000e6, -3);
    const sinCasa = proyectarFuturo10(u, { ...cfg, futuros: { activos: [] } });
    expect(sinCasa.filas[3].porActivo.find((x) => x.nombre === "IBKR").valor - v(3, "IBKR")).toBeCloseTo(1000e6, -3);
    expect(r.alertas.some((a) => a.tipo === "pago_futuro" && /de BTG y .* de IBKR/.test(a.texto))).toBe(true);
  });
  it("escenarios viejos con fuenteId siguen funcionando (100 %)", () => {
    expect(leerFuentesPago({ fuenteId: "x" })).toEqual([{ id: "x", pct: 100 }]);
    expect(leerFuentesPago({ fuentes: [{ id: "a", pct: 70 }, { id: "b", pct: 50 }] })).toEqual([{ id: "a", pct: 70 }, { id: "b", pct: 30 }]);
  });
});

describe("futuro10 · monto por fuente y valor al terminar", () => {
  const U = () => ({ inflacionPct: 4, inv: [{ id: "pm", n: "PM", tp: "Real Estate", va: 9000e6 }, { id: "ib", n: "IBKR", tp: "ETF", va: 3000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", tp: "Cash", va: 500e6 }], ingresos: [], gas: {}, deu: [] });
  it("la casa sale con $2.400 M de BTG y $1.500 M de IBKR, y vale $5.400 M al terminar", () => {
    const cfg = { decisiones: { pm: { accion: "vende" } }, nuevas: [{ preset: "custom", nombre: "BTG", monto: 5000e6, rendimientoNomPct: 10, pctRecibe: 100 }],
      futuros: { activos: [{ nombre: "Casa", clase: "vivienda", valor: 3900e6, entrega: 5, valorAlTerminar: 5400e6, valorizacionNomPct: 6, fuentes: [{ id: "nueva_0", monto: 2400e6 }, { id: "ib", monto: 1500e6 }] }] } };
    const r = proyectarFuturo10(U(), cfg);
    const v = (t, n) => r.filas[t].porActivo.find((x) => x.nombre === n).valor;
    expect(v(4, "BTG") - v(5, "BTG")).toBeCloseTo(2400e6, -3);
    expect(v(5, "Casa")).toBeCloseTo(5400e6, -3);
    expect(v(6, "Casa")).toBeCloseTo(5400e6 * 1.06, -3);
  });
  it("la bodega: el lote queda valiendo $1.500 M cuando empieza a rentar", () => {
    const r = proyectarFuturo10(U(), { reinversiones: [{ activoId: "l", monto: 600e6, rentaMensual: 8e6, rentaDesdeMes: 12, valorAlTerminar: 1500e6 }] });
    expect(r.filas[2].porActivo.find((x) => x.nombre === "Lote").valor).toBeCloseTo(1500e6, -3);
  });
});

describe("lo que se va con una venta (rentas sin vincular)", () => {
  const user = {
    trm: 4000, inflacionPct: 4,
    inv: [{ id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 3000e6 }, { id: "otro", n: "CDT", tipo: "cdt", va: 100e6 }],
    ingresos: [{ nombre: "RENTA TRADICIONAL PUERTO MADERO", categoria: "arriendos", tipo: "pasivo", mensual: 13e6, frecuencia: "mensual" }, { nombre: "Salario", tipo: "activo", mensual: 20e6, frecuencia: "mensual" }],
    gastos: { vivienda: [{ c: "Administración Madero", mensual: 2e6, frecuencia: "mensual" }, { c: "Mercado", mensual: 5e6, frecuencia: "mensual" }] },
  };
  it("sugiere por nombre y los quita al vender", async () => {
    const { sugerirVinculados, vinculadosQueSeVan } = await import("../../src/lib/futuro10.js");
    const s = sugerirVinculados(user, "pm");
    expect(s.ingresos.find((x) => x.nombre === "RENTA TRADICIONAL PUERTO MADERO").sugerido).toBe(true);
    expect(s.ingresos.find((x) => x.nombre === "Salario").sugerido).toBe(false);
    expect(s.gastos.find((x) => x.nombre === "Administración Madero").sugerido).toBe(true);
    const f = vinculadosQueSeVan(user, { decisiones: { pm: { accion: "vende" } } });
    expect([...f].sort()).toEqual(["i:renta tradicional puerto madero", "vivienda::administracion madero"]);
    const f2 = vinculadosQueSeVan(user, { decisiones: { pm: { accion: "vende", seVan: ["i:renta tradicional puerto madero"] } } });
    expect([...f2]).toEqual(["i:renta tradicional puerto madero"]);
  });
  it("la renta vendida no aparece en lo que entra", () => {
    const base = proyectarFuturo10(user, { escenario: "base", decisiones: {} });
    const r = proyectarFuturo10(user, { escenario: "base", decisiones: { pm: { accion: "vende" } } });
    expect(r.desglose.entra.some((x) => /MADERO/.test(x.nombre))).toBe(false);
    expect(r.desglose.sale.some((x) => /Madero/.test(x.nombre))).toBe(false);
    expect(r.filas[0].ingresos).toBeLessThan(base.filas[0].ingresos - 12 * 12e6);
  });
});

describe("vínculo a un activo borrado", () => {
  it("se trata como suelto y se sugiere por nombre", async () => {
    const { sugerirVinculados } = await import("../../src/lib/futuro10.js");
    const user = { inv: [{ id: "o", n: "Casa Orlando", tipo: "inmueble", va: 400e6 }], ingresos: [{ nombre: "renta orlando", activoId: "viejo", mensual: 20e6, frecuencia: "mensual" }], gas: {} };
    expect(sugerirVinculados(user, "o").ingresos[0].sugerido).toBe(true);
  });
});

describe("ingresos que se acaban", () => {
  it("apagar una renta baja los ingresos desde ese año", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [], ingresos: [{ nombre: "renta orlando", tipo: "pasivo", mensual: 20e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: {} };
    const a = proyectarFuturo10(user, { decisiones: {} });
    const r = proyectarFuturo10(user, { decisiones: {}, ingresosTerminan: { "i:0": 3 } });
    expect(r.filas[1].ingresos).toBeCloseTo(a.filas[1].ingresos, -3);
    expect(a.filas[3].ingresos - r.filas[3].ingresos).toBeGreaterThan(12 * 20e6);
    const r1 = proyectarFuturo10(user, { decisiones: {}, ingresosTerminan: { "i:0": 1 } });
    expect(r1.desglose.entra.some((x) => /orlando/.test(x.nombre))).toBe(false);
  });
});

describe("montos completos y cada inversión hoy", () => {
  const user = { trm: 4000, inflacionPct: 4,
    inv: [{ id: "rc", n: "RAPICREDIT FONDEO", tipo: "otro", va: 3288e6 }],
    ingresos: [{ nombre: "Rapicredit", tipo: "pasivo", activoId: "rc", mensual: 57.5e6, frecuencia: "mensual", desdeMes: 7, hastaMes: 12 }],
    gas: { Varios: [{ c: "Comisión fondeo", activoId: "rc", mensual: 5e6, frecuencia: "mensual" }] } };
  it("un ingreso de julio a diciembre cuenta el mes completo en el plan", async () => {
    const { inversionesHoy } = await import("../../src/lib/futuro10.js");
    const [x] = inversionesHoy(user);
    expect(x.bruta).toBeCloseTo(57.5e6, -3);
    expect(x.neta).toBeCloseTo(52.5e6, -3);
    expect(x.ingresos[0].nota).toMatch(/jul a dic/);
    const r = proyectarFuturo10(user, { decisiones: {} });
    expect(r.filas[1].ingresos / 12).toBeGreaterThan(52e6);
  });
  it("corregir la renta en el plan la reemplaza", async () => {
    const { inversionesHoy } = await import("../../src/lib/futuro10.js");
    const a = proyectarFuturo10(user, { decisiones: {} });
    const r = proyectarFuturo10(user, { decisiones: {}, rentaHoy: { rc: 57.5e6 } });
    expect(r.filas[1].ingresos - a.filas[1].ingresos).toBeCloseTo(5e6 * 12 * 1.0, -6);
    expect(inversionesHoy(user, { rentaHoy: { rc: 57.5e6 } })[0].pctAnual).toBeCloseTo(21, 0);
    expect(r.desglose.entra.find((x) => /RAPICREDIT/.test(x.nombre)).nota).toMatch(/corregiste/);
  });
});

describe("negocio que se repite (asociativos)", () => {
  const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 3000e6 }, { id: "c", n: "Cash", tipo: "liquidez", va: 100e6 }], ingresos: [{ nombre: "Salario", mensual: 50e6, frecuencia: "mensual" }], gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] } };
  const base = { decisiones: { pm: { accion: "vende" } } };
  it("el capital sale una vez y la ganancia de cada año se reinvierte", () => {
    const a = proyectarFuturo10(user, base);
    const r = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "Asociativos", capital: 1350e6, valorFinal: 1900e6, meses: 12, desde: 1, fuente: "venta", impuestoPct: 0 }] });
    expect(r.ciclosDetalle[0].gananciaAnual).toBeCloseTo(550e6, -3);
    const t = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "A", capital: 1350e6, valorFinal: 1900e6, meses: 12 }] });
    expect(t.ciclosDetalle[0].impuestoPct).toBe(39);
    expect(t.ciclosDetalle[0].gananciaAnual).toBeCloseTo(550e6 * 0.61, -3);
    const o = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "A", capital: 1350e6, valorFinal: 1900e6, meses: 24 }] });
    expect(o.ciclosDetalle[0].impuestoPct).toBe(15);
    expect(r.bolsaDetalle.restante).toBeCloseTo(a.bolsaDetalle.restante - 1350e6, -3);
    // 10 ciclos de ~550 M (con inflación) reinvertidos: bastante más patrimonio que sin el negocio
    expect(r.final.patrimonioReal - a.final.patrimonioReal).toBeGreaterThan(5000e6);
    expect(r.filas[1].cicloReinv).toBeCloseTo(550e6 * 1, -6);
    expect(r.filas[1].porActivo.find((x) => x.id === "ciclo_0").valor).toBeGreaterThan(1350e6);
  });
  it("si la ganancia llega al mes, sube el flujo; si termina, el capital vuelve", () => {
    const r = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "Asociativos", capital: 1350e6, valorFinal: 1900e6, meses: 12, desde: 1, hasta: 3, destino: "flujo", impuestoPct: 0 }] });
    expect(r.filas[1].cicloFlujo).toBeGreaterThan(500e6);
    expect(r.filas[4].cicloFlujo || 0).toBe(0);
    expect((r.filas[4].porActivo.find((x) => x.id === "ciclo_0") || { valor: 0 }).valor).toBe(0);
    expect(r.desglose.entra.some((x) => x.nombre === "Asociativos")).toBe(true);
  });
});

describe("saldo de las ventas", () => {
  it("dice cuánto te pasaste de lo vendido", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 1000e6 }, { id: "c", n: "Cash", tipo: "liquidez", liquido: true, va: 800e6 }], ingresos: [], gas: {} };
    const r = proyectarFuturo10(user, { decisiones: { pm: { accion: "vende" } }, ciclos: [{ nombre: "A", capital: 1350e6, valorFinal: 1900e6, fuente: "venta" }] });
    const bd = r.bolsaDetalle;
    expect(bd.ciclos).toBeCloseTo(1350e6, -3);
    expect(bd.excesoVentas).toBeGreaterThan(300e6);
    expect(bd.restante).toBe(0);
  });
});

describe("lo que sobra responde a cada inversión", () => {
  it("invertir menos de lo vendido sube lo que sobra; de tus cuentas no lo mueve", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 3000e6 }, { id: "l", n: "Ledger", tipo: "Cripto", va: 200e6 }, { id: "c", n: "Cash", liquido: true, va: 500e6 }], ingresos: [], gas: {} };
    const base = { decisiones: { pm: { accion: "vende" } } };
    const a = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 500e6, fuente: "venta" }] });
    const b = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 300e6, fuente: "venta" }] });
    expect(b.bolsaDetalle.restante - a.bolsaDetalle.restante).toBeCloseTo(200e6, -3);
    const c = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 300e6, fuente: "liquidez" }] });
    expect(c.bolsaDetalle.usos[0].deCuentas).toBeCloseTo(300e6, -3);
    expect(c.bolsaDetalle.usos[0].deVenta).toBe(0);
  });
});

describe("inversión de un año siguiente que sale de lo vendido", () => {
  it("se aparta hoy: bajar el monto sube lo que sobra, y entra al activo ese año", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 3000e6 }, { id: "l", n: "Ledger", tipo: "Cripto", va: 50e6 }], ingresos: [], gas: {} };
    const base = { decisiones: { pm: { accion: "vende" } } };
    const a = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 500e6, anio: 2, fuente: "venta" }] });
    const b = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 400e6, anio: 2, fuente: "venta" }] });
    expect(b.bolsaDetalle.restante - a.bolsaDetalle.restante).toBeCloseTo(100e6, -3);
    expect(a.bolsaDetalle.reservado).toBeCloseTo(500e6, -3);
    const v1 = a.filas[1].porActivo.find((x) => x.id === "l").valor, v2 = a.filas[2].porActivo.find((x) => x.id === "l").valor;
    expect(v1).toBeGreaterThan(500e6); // valor + apartado
    expect(v2).toBeGreaterThan(550e6);
  });
});

describe("apartar de lo vendido para años siguientes (C y D)", () => {
  it("una inversión nueva del año 3 y un negocio del año 2 bajan lo que sobra hoy", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 3000e6 }], ingresos: [], gas: {} };
    const base = { decisiones: { pm: { accion: "vende" } } };
    const a = proyectarFuturo10(user, base);
    const r = proyectarFuturo10(user, { ...base, nuevas: [{ preset: "custom", nombre: "BTG", monto: 500e6, anio: 3, rendimientoNomPct: 10 }], ciclos: [{ nombre: "Aso", capital: 1000e6, valorFinal: 1300e6, desde: 2, impuestoPct: 0 }] });
    expect(a.bolsaDetalle.restante - r.bolsaDetalle.restante).toBeCloseTo(1500e6, -3);
    expect(r.filas[1].porActivo.some((x) => /Apartado para BTG/.test(x.nombre))).toBe(true);
    expect(r.filas[2].cicloReinv).toBeGreaterThan(0);
    expect(r.filas[3].porActivo.find((x) => x.nombre === "BTG").valor).toBeGreaterThan(500e6);
    expect(r.final.patrimonio).toBeGreaterThan(a.final.patrimonio);
  });
});

describe("la ganancia del negocio se reinvierte en lo que elijas", () => {
  it("va a la inversión elegida", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 3000e6 }, { id: "ib", n: "IBKR", tipo: "Acciones", va: 100e6 }], ingresos: [], gas: {} };
    const base = { decisiones: { pm: { accion: "vende" } } };
    const a = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "Aso", capital: 1000e6, valorFinal: 1500e6, impuestoPct: 0 }] });
    const r = proyectarFuturo10(user, { ...base, ciclos: [{ nombre: "Aso", capital: 1000e6, valorFinal: 1500e6, impuestoPct: 0, destinoId: "ib" }] });
    const ibA = a.filas[3].porActivo.find((x) => x.id === "ib").valor, ibR = r.filas[3].porActivo.find((x) => x.id === "ib").valor;
    expect(ibR - ibA).toBeGreaterThan(1400e6);
  });
});

describe("lo que sobra cada mes va a donde elijas", () => {
  it("el % elegido se suma a la inversión; el resto al reparto", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "ib", n: "IBKR", tipo: "Acciones", va: 100e6 }], ingresos: [{ nombre: "Salario", mensual: 100e6, frecuencia: "mensual" }], gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] } };
    const a = proyectarFuturo10(user, {});
    const r = proyectarFuturo10(user, { sobraDestinos: [{ id: "ib", pct: 50 }] });
    const d = r.filas[1].porActivo.find((x) => x.id === "ib").valor - a.filas[1].porActivo.find((x) => x.id === "ib").valor;
    expect(d).toBeCloseTo(r.filas[1].cf * 0.5, -6);
  });
});

describe("una reinversión por activo", () => {
  it("si hay dos para el mismo activo, cuenta la que se ve (la primera)", async () => {
    const { migrarModifica } = await import("../../src/lib/futuro10.js");
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 3000e6 }, { id: "l", n: "Ledger", tipo: "Cripto", va: 50e6 }], ingresos: [], gas: {} };
    const base = { decisiones: { pm: { accion: "vende" } } };
    const uno = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 400e6 }] });
    const dos = proyectarFuturo10(user, { ...base, reinversiones: [{ activoId: "l", monto: 400e6 }, { activoId: "l", monto: 600e6, anio: 2 }] });
    expect(dos.bolsaDetalle.restante).toBeCloseTo(uno.bolsaDetalle.restante, -3);
    expect(migrarModifica({ reinversiones: [{ activoId: "l", monto: 1 }, { activoId: "l", monto: 2 }] }).reinversiones.length).toBe(1);
  });
});

describe("sacar plata de algo que renta baja su renta", () => {
  it("pagar la casa con Rapicredit baja la renta de Rapicredit", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "rc", n: "Rapicredit", tipo: "otro", va: 3288e6 }], ingresos: [{ nombre: "Rapicredit", tipo: "pasivo", activoId: "rc", mensual: 57.5e6, frecuencia: "mensual" }], gas: {} };
    const casa = { futuros: { ingresos: [], gastos: [], activos: [{ nombre: "Casa", clase: "vivienda", valor: 1644e6, entrega: 3, fuentes: [{ id: "rc", monto: 1644e6 }] }] } };
    const a = proyectarFuturo10(user, {});
    const r = proyectarFuturo10(user, casa);
    const q = r.filas[4].ingresos / a.filas[4].ingresos; expect(q).toBeGreaterThan(0.5); expect(q).toBeLessThan(0.6);
    expect(r.alertas.some((x) => x.tipo === "renta_baja")).toBe(true);
  });
});

describe("cuánto sube cada inversión, corregido en Hoy", () => {
  it("reemplaza el supuesto general", async () => {
    const { inversionesHoy } = await import("../../src/lib/futuro10.js");
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "ib", n: "IBKR", tipo: "Acciones", va: 100e6 }], ingresos: [], gas: {} };
    const r = proyectarFuturo10(user, { crecHoy: { ib: 25 } });
    expect(r.filas[1].porActivo.find((x) => x.id === "ib").valor).toBeCloseTo(125e6, -5);
    expect(inversionesHoy(user, { crecHoy: { ib: 25 } })[0].crecPct).toBe(25);
    expect(inversionesHoy(user, {})[0].crecCorregido).toBe(false);
  });
});

describe("ingreso variable en el plan", () => {
  it("usa el promedio de los meses con monto", async () => {
    const { paraPlan } = await import("../../src/lib/futuro10.js");
    const u = paraPlan({ ingresos: [{ nombre: "Fondo", frecuencia: "variable", montosMensuales: [0, 0, 0, 0, 0, 0, 57.5e6, 57.5e6, 57.5e6, 57.5e6, 0, 0] }] });
    expect(u.ingresos[0].mensual).toBeCloseTo(57.5e6, -3);
  });
});

describe("Hoy marca las rentas que se van con una venta", () => {
  it("la renta suelta de un activo vendido sale marcada", async () => {
    const { ingresosSueltosHoy } = await import("../../src/lib/futuro10.js");
    const user = { inv: [{ id: "o", n: "Casa Orlando", tipo: "inmueble", va: 400e6 }], ingresos: [{ nombre: "renta orlando", tipo: "pasivo", mensual: 20e6, frecuencia: "mensual" }, { nombre: "Fee", mensual: 13e6, frecuencia: "mensual" }], gas: {} };
    const xs = ingresosSueltosHoy(user, { decisiones: { o: { accion: "vende" } } });
    expect(xs.find((x) => x.nombre === "renta orlando").seVa).toBe("venta");
    expect(xs.find((x) => x.nombre === "Fee").seVa).toBe(null);
  });
});

describe("dejar disponible lo que sobra", () => {
  it("va al colchón disponible", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [], ingresos: [{ nombre: "Salario", mensual: 100e6, frecuencia: "mensual" }], gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] } };
    const r = proyectarFuturo10(user, { sobraDestinos: [{ id: "c_disponible", pct: 100 }] });
    const c = r.filas[1].porActivo.find((x) => x.id === "c_liquidez");
    expect(c.valor).toBeGreaterThan(r.filas[1].cf * 0.99);
  });
});

describe("dejar disponible lo que sobra de las ventas", () => {
  it("no se invierte en canastas", () => {
    const user = { trm: 4000, inflacionPct: 4, inv: [{ id: "pm", n: "PM", tipo: "inmueble", va: 1000e6 }], ingresos: [], gas: {} };
    const r = proyectarFuturo10(user, { decisiones: { pm: { accion: "vende" } }, repartoDisponible: true });
    const p0 = r.filas[0].porActivo;
    expect((p0.find((x) => x.id === "c_renta") || { valor: 0 }).valor).toBe(0);
    expect(p0.find((x) => x.id === "c_liquidez").valor).toBeGreaterThan(990e6);
  });
});

describe("claves estables: agregar un gasto no corre lo que se acaba", () => {
  it("el mantenimiento sigue marcado aunque se agregue otro gasto antes", async () => {
    const { migrarClaves } = await import("../../src/lib/futuro10.js");
    const u1 = { inflacionPct: 4, inv: [], ingresos: [], gas: { Vida: [{ c: "Arriendo", m: 16e6 }, { c: "Mantenimiento", m: 3e6 }] } };
    const cfg = migrarClaves({ gastosTerminan: { "Vida::1": 1 } }, u1);
    const u2 = { ...u1, gas: { Vida: [{ c: "Colegio", m: 2e6 }, { c: "Arriendo", m: 16e6 }, { c: "Mantenimiento", m: 3e6 }] } };
    const r = proyectarFuturo10(u2, cfg);
    expect(r.seVan.map((x) => x.nombre)).toEqual(["Mantenimiento"]);
  });
});
