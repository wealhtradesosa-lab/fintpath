import { describe, it, expect } from "vitest";
import { proyectarFuturo10, SUPUESTOS_F10, resolverEscenario, metaColchonF10, migrarConfigF10, avisoRetornoAlto, pareceIngresoFuturo, tasaDeuda } from "../../src/lib/futuro10.js";
import { calcularBase } from "../../src/lib/metrics.js";
import { ultimoDato, IPC_MANUAL } from "../../netlify/functions/datos-mercado.js";

const cero = JSON.parse(JSON.stringify(SUPUESTOS_F10));
cero.presets.rfCorto.realSpread = 0; cero.presets.rfLargo.realSpread = 0;
cero.escenarios.base = { ...cero.escenarios.base, ingresosSpread: 0, gastosSpread: 0, retornoSpread: 0, spRealPct: 0 };

describe("Mi futuro a 10 v2 · Finanzas", () => {
  it("retorno real 0 + flujo 0 ⇒ patrimonio (pesos de hoy) constante", () => {
    const u = { inflacionPct: 5, inv: [{ id: "a", tp: "Cash", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { supuestos: cero, mezcla: { liquidez: 100, renta: 0, crecimiento: 0 } });
    r.filas.forEach((f) => expect(f.patrimonioReal).toBeCloseTo(100e6, -1));
  });

  it("reinvierte vs retira al mismo % ⇒ mismo patrimonio (±1%)", () => {
    const s = JSON.parse(JSON.stringify(cero)); s.presets.rfCorto.realSpread = 6;
    const u = { inflacionPct: 0, inv: [{ id: "c", n: "Apto", tp: "Real Estate", va: 500e6 }], ingresos: [{ nombre: "Arriendo", categoria: "Arriendo", activoId: "c", mensual: 2.5e6 }], gas: {}, deu: [] };
    const base = { supuestos: s, mezcla: { liquidez: 100, renta: 0, crecimiento: 0 } };
    const ret = proyectarFuturo10(u, { ...base, activos: { c: { rendimientoPct: 6, renta: "retira" } } });
    const rei = proyectarFuturo10(u, { ...base, activos: { c: { rendimientoPct: 6, renta: "reinvierte" } } });
    expect(Math.abs(rei.final.patrimonio / ret.final.patrimonio - 1)).toBeLessThan(0.01);
    expect(ret.filas[1].rentaPasiva).toBeCloseTo(30e6, -3);
    expect(rei.filas[1].rentaPasiva).toBeCloseTo(0, -3); // no se cuenta dos veces
  });

  it("faltante con solo finca raíz: alerta y no se vende", () => {
    const u = { inflacionPct: 5, inv: [{ id: "c", n: "Casa", tp: "Real Estate", va: 500e6 }], ingresos: [], gas: { Vida: [{ n: "Mercado", m: 2e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    const f = r.alertas.filter((a) => a.tipo === "faltante");
    expect(f.length).toBeGreaterThan(0);
    expect(f[0].texto).toMatch(/Faltante de \$[\d.]+ en el año 1/);
    expect(r.final.activos + r.final.faltante).toBeCloseTo(500e6 * Math.pow(1.045, 10), -2);
  });

  it("colchón de Futuro = colchón de Patrimonio (ob × 6); Metas › Fondo de emergencia manda", () => {
    const u = { inflacionPct: 5, inv: [], ingresos: [], gas: { Vida: [{ n: "Mercado", m: 3e6 }] }, deu: [{ id: "d", tp: "loan", mt: 10e6, pg: 1e6, ts: 15 }] };
    expect(metaColchonF10(u)).toBeCloseTo(calcularBase({ ...u, gastos: u.gas }, {}).ob * 6, 0);
    expect(proyectarFuturo10(u, {}).metaColchon).toBeCloseTo(calcularBase({ ...u, gastos: u.gas }, {}).ob * 6, 0);
    expect(metaColchonF10({ ...u, metas: [{ name: "Fondo de emergencia", type: "emergency", target: 40e6 }] })).toBe(40e6);
  });

  it("devaluación +2% sube la caja en USD medida en pesos", () => {
    const u = { inflacionPct: 5, trm: 4000, inv: [{ id: "u", tp: "Cash", moneda: "USD", va: 10000 }], ingresos: [], gas: {}, deu: [] };
    const a = proyectarFuturo10(u, {}), b = proyectarFuturo10(u, { devaluacionRealPct: 2 });
    expect(b.final.patrimonio).toBeGreaterThan(a.final.patrimonio);
    expect(resolverEscenario("pesimista").devaluacionRealPct).toBe(0);
  });

  it("aviso suave de retorno alto (> 12% real), sin bloquear", () => {
    const esc = resolverEscenario("base", { inflacionPct: 5 });
    expect(avisoRetornoAlto(20, esc)).toMatch(/revisa/);
    expect(avisoRetornoAlto(10, esc)).toBeNull();
    const u = { inflacionPct: 5, inv: [{ id: "c", n: "Lote", tp: "Real Estate", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { activos: { c: { rendimientoPct: 25 } } });
    expect(r.alertas.some((x) => x.tipo === "retorno_alto")).toBe(true);
    expect(r.final.patrimonio).toBeGreaterThan(100e6 * 1.2 ** 10 - 1);
  });

  it("deudas: amortiza con interés; sin tasa usa la promedio y avisa; cuota sin saldo se mantiene", () => {
    const u = { inflacionPct: 5, inv: [{ id: "c", tp: "Cash", va: 500e6 }], ingresos: [], gas: {}, deu: [{ id: "h", tp: "mortgage", mt: 100e6, pg: 1.5e6 }, { id: "x", tp: "loan", pg: 0.5e6 }] };
    const r = proyectarFuturo10(u, {});
    expect(tasaDeuda({ tp: "mortgage" }).pct).toBe(SUPUESTOS_F10.tasasDeuda.hipotecario.pct);
    expect(r.alertas.some((a) => a.tipo === "tasa_estimada" && /agrégala/.test(a.texto))).toBe(true);
    expect(r.alertas.some((a) => a.tipo === "deuda_sin_saldo" && /Agrega el saldo/.test(a.texto))).toBe(true);
    expect(r.filas[1].deuda).toBeLessThan(100e6);
    expect(r.filas[1].deuda).toBeGreaterThan(100e6 - 18e6); // parte de la cuota es interés
    const uvr = proyectarFuturo10(u, { deudas: { h: { uvr: true, tasaPct: 8 } } });
    expect(uvr.filas[2].gastos).toBeGreaterThan(r.filas[2].gastos - 1);
  });

  it("venta con año: sale el arriendo vinculado desde ese año", () => {
    const u = { inflacionPct: 5, inv: [{ id: "c", n: "Apto", tp: "Real Estate", va: 400e6 }], ingresos: [{ nombre: "Arriendo", categoria: "Arriendo", activoId: "c", mensual: 2e6 }], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { c: { accion: "vende", anioVenta: 4 } } });
    expect(r.filas[3].rentaPasiva).toBeGreaterThan(0);
    expect(r.filas[4].rentaPasiva).toBeCloseTo(0, 0);
    expect(r.disponible[3].ventas).toBeCloseTo(400e6 * (1.045 / 1.05) ** 3, -2);
    expect(r.hayVentas).toBe(true);
  });
});

describe("Lo que viene: pensión como activo", () => {
  it("detecta pensión / jubilación en el nombre", () => {
    ["Pensión", "pension Colpensiones", "Jubilación"].forEach((x) => expect(pareceIngresoFuturo(x)).toBe(true));
    ["Apto en Rionegro", "Lote"].forEach((x) => expect(pareceIngresoFuturo(x)).toBe(false));
  });
});

describe("Construir o mejorar", () => {
  const u = { inflacionPct: 5, inv: [{ id: "c", tp: "Cash", va: 300e6 }, { id: "l", n: "Lote", tp: "Real Estate", va: 300e6 }], ingresos: [], gas: {}, deu: [] };
  const obra = { inversiones: [{ monto: 100e6, anio: 2 }], anioLista: 3, rentaMensual: 4e6, renta: "retira", tipoNuevo: "local" };
  it("inversión sale de la plata disponible y la renta aparece desde el año en que queda lista", () => {
    const r0 = proyectarFuturo10(u, {});
    const r = proyectarFuturo10(u, { decisiones: { l: { accion: "construye", obra } } });
    expect(r.disponible[1].adicionales).toBeCloseTo(100e6, 0);
    expect(r.filas[2].rentaPasivaReal).toBeCloseTo(r0.filas[2].rentaPasivaReal, 0);
    expect(r.filas[3].rentaPasivaReal - r0.filas[3].rentaPasivaReal).toBeCloseTo(48e6, -2);
    expect(r.filas[2].patrimonio).toBeCloseTo(r0.filas[2].patrimonio, -3); // pasar plata no crea patrimonio
  });
  it("valor final estimado y reinvertir la renta", () => {
    const r = proyectarFuturo10(u, { decisiones: { l: { accion: "construye", obra: { ...obra, renta: "reinvierte", valorFinal: 600e6 } } } });
    expect(r.filas[3].rentaPasiva).toBeCloseTo(0, 0);
    expect(r.filas[3].activos).toBeGreaterThan(600e6 * 1.05 ** 3);
  });
  it("migra escenarios viejos (inversión adicional + renta nueva + reinversiones)", () => {
    const viejo = { decisiones: { l: { accion: "modifica", inversionMonto: 100e6, inversionAnio: 2, rentaNuevaMensual: 4e6, rentaNuevaDesde: 3, valorizacionNomPct: 6 } }, reinversiones: [{ activoId: "l", monto: 20e6 }] };
    const m = migrarConfigF10(viejo);
    expect(m.version).toBe(2);
    expect(m.reinversiones).toBeUndefined();
    expect(m.decisiones.l.accion).toBe("construye");
    expect(m.decisiones.l.rendimientoPct).toBe(6);
    expect(m.decisiones.l.obra).toMatchObject({ anioLista: 3, rentaMensual: 4e6 });
    expect(m.decisiones.l.obra.inversiones).toEqual([{ monto: 100e6, anio: 2 }, { monto: 20e6, anio: 1 }]);
    expect(migrarConfigF10(m)).toBe(m);
    expect(proyectarFuturo10(u, viejo).final.patrimonio).toBeCloseTo(proyectarFuturo10(u, m).final.patrimonio, 0);
  });
});

describe("datos-mercado (BanRep)", () => {
  it("lee el último dato de la serie y tiene respaldo manual con fuente y fecha", () => {
    expect(ultimoDato([[Date.UTC(2026, 7, 15), 5.4], [Date.UTC(2026, 8, 15), 5.1]]).pct).toBe(5.1);
    expect(ultimoDato({ data: [] })).toBeNull();
    expect(IPC_MANUAL).toMatchObject({ fuente: expect.any(String), fecha: expect.any(String), manual: true });
  });
});

describe("revisión Finanzas #56", () => {
  const userBase = (extra = {}) => ({ inflacionPct: 5, ingresos: [], gas: {}, inv: [{ id: "a1", n: "Casa", tp: "Real Estate", va: 500e6 }], deu: [], ...extra });
  it("convención de deflación: retorno real 0 y flujo 0 → patrimonio real constante desde el año 1", () => {
    for (const esc of ["base", "pesimista", "optimista"]) {
      const inf = resolverEscenario(esc, userBase()).inflacionPct;
      const r = proyectarFuturo10(userBase(), { escenario: esc, activos: { a1: { rendimientoPct: inf } } });
      r.filas.forEach((f) => expect(f.patrimonioReal).toBeCloseTo(500e6, -2));
      expect(r.filas[1].factorFlujo).toBe(1);
    }
  });
  it("Construir o mejorar: el monto es en pesos de hoy y se infla al año del gasto", () => {
    const u = userBase({ inv: [{ id: "a1", n: "Lote", tp: "Real Estate", va: 100e6 }, { id: "c", n: "CDT", tp: "CDT", va: 500e6 }] });
    const inf = resolverEscenario("base", u).inflacionPct / 100;
    const cfg = { escenario: "base", activos: { a1: { rendimientoPct: 0 } }, decisiones: { a1: { accion: "construye", obra: { inversiones: [{ monto: 50e6, anio: 3 }], anioLista: 3 } } } };
    const sin = proyectarFuturo10(u, { escenario: "base", activos: { a1: { rendimientoPct: 0 } } });
    const con = proyectarFuturo10(u, cfg);
    expect(sin.filas[3].liquidez - con.filas[3].liquidez).toBeCloseTo(50e6 * Math.pow(1 + inf, 2), -2);
    expect(con.disponible[2].adicionales).toBeCloseTo(50e6, 0); // se muestra en pesos de hoy
  });
  it("deuda en UVR: tasa real sobre UVR por defecto, con fuente y fecha", () => {
    const t = tasaDeuda({ tp: "Mortgage", mt: 100e6 }, { uvr: true });
    expect(t).toMatchObject({ estimada: true, real: true, tipo: "hipotecarioUVR" });
    expect(t.pct).toBeLessThan(10);
    expect(t.fuente).toMatch(/Superfinanciera, tasa promedio por modalidad/);
    expect(t.fecha).toBeTruthy();
    expect(tasaDeuda({ tp: "Mortgage" }).pct).toBe(13.94);
  });
});
