import { describe, it, expect } from "vitest";
import { proyectarFuturo10, anioPagoDeuda } from "../../src/lib/futuro10.js";

const Y = new Date().getFullYear();
// 23-nov-2026 — Deudas que se pagan en un año elegido e inversiones de la lista con año.
describe("futuro10 · pago de deudas por año e inversiones con año", () => {
  const base = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 2000e6 }, { id: "l", n: "Local", tp: "Local Comercial", va: 900e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: {}, deu: [] };

  it("anioPagoDeuda: true y año actual = hoy; año siguiente = 2; Sigue = null", () => {
    expect(anioPagoDeuda({ id: "d" }, { d: true })).toBe(1);
    expect(anioPagoDeuda({ id: "d" }, { d: Y })).toBe(1);
    expect(anioPagoDeuda({ id: "d" }, { d: Y + 1 })).toBe(2);
    expect(anioPagoDeuda({ id: "d" }, { d: false })).toBeNull();
    expect(anioPagoDeuda({ id: "d" }, {})).toBeNull();
  });

  it("saldo sin intereses pagado en el año 2: resta hasta ese año y luego sale", () => {
    const u = { ...base, deu: [{ id: "d", n: "Saldo local", mt: 437e6, pg: 0, tipoInteres: "sin_interes", la: "l" }] };
    const sigue = proyectarFuturo10(u, { pagarDeudas: { d: false } });
    const r = proyectarFuturo10(u, { pagarDeudas: { d: Y + 1 } });
    expect(r.filas[1].deuda).toBeCloseTo(437e6, 0);
    expect(r.filas[2].deuda).toBeCloseTo(0, 0);
    expect(sigue.filas[10].deuda).toBeCloseTo(437e6, 0);
    expect(r.alertas.some((a) => a.tipo === "pago_unico" && a.anio === 2)).toBe(true);
    const d = r.deudas.find((x) => x.id === "d");
    expect(d.pagaAnio).toBe(2);
    expect(d.pagado).toBe(0); // no sale de lo vendido hoy
  });

  it("deuda con cuota pagada en el año 3: la cuota corre 2 años y luego se acaba", () => {
    const u = { ...base, deu: [{ id: "k", n: "Crédito", mt: 120e6, pg: 3e6, ts: 12 }] };
    const r = proyectarFuturo10(u, { pagarDeudas: { k: Y + 2 } });
    expect(r.filas[2].deuda).toBeGreaterThan(0);
    expect(r.filas[3].deuda).toBeCloseTo(0, 0);
    expect(r.alertas.some((a) => a.tipo === "pago_deuda" && a.anio === 3)).toBe(true);
    const sinPagar = proyectarFuturo10(u, {});
    expect(r.filas[3].gastos).toBeLessThan(sinPagar.filas[3].gastos);
  });

  it("escenario viejo «Se paga hoy» (true) se lee igual que antes", () => {
    const u = { ...base, inv: [...base.inv, { id: "v", n: "Lote", tp: "Lote", va: 300e6 }], deu: [{ id: "k", n: "Crédito", mt: 120e6, pg: 3e6, ts: 12 }] };
    const cfg = { decisiones: { v: { accion: "vende" } } };
    const viejo = proyectarFuturo10(u, { ...cfg, pagarDeudas: { k: true } });
    const nuevo = proyectarFuturo10(u, { ...cfg, pagarDeudas: { k: Y } });
    expect(viejo.deudas[0].pagado).toBeCloseTo(120e6, 0);
    expect(nuevo.final.patrimonio).toBeCloseTo(viejo.final.patrimonio, 0);
  });

  it("inversión de la lista en un año siguiente no sale de hoy", () => {
    const hoy = proyectarFuturo10(base, { nuevas: [{ preset: "rfCorto", monto: 500e6, fuente: "liquidez" }] });
    const en2 = proyectarFuturo10(base, { nuevas: [{ preset: "rfCorto", monto: 500e6, fuente: "liquidez", anio: 2 }] });
    expect(hoy.bolsaDetalle.nuevas).toBeCloseTo(500e6, 0);
    expect(en2.bolsaDetalle.nuevas).toBeCloseTo(0, 0);
    expect(en2.bolsaDetalle.usos.some((u) => u.seccion === "C" && u.anio === 2 && u.monto === 500e6)).toBe(true);
    const id = "nueva_0";
    expect(en2.filas[1].porActivo.some((a) => a.id === id)).toBe(false);
    expect(en2.filas[2].porActivo.some((a) => a.id === id && a.valor > 400e6)).toBe(true);
  });
});

describe("año en que cada deuda deja de existir (finAnio)", () => {
  const Y2 = new Date().getFullYear();
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 3000e6 }, { id: "v", n: "Volvo", tp: "Vehículo", va: 200e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: {},
    deu: [{ id: "s", n: "Saldo local", mt: 437e6, pg: 0, tipoInteres: "sin_interes" }, { id: "vv", n: "Sufi Volvo", mt: 152e6, pg: 5e6, ts: 15, la: "v" }, { id: "k", n: "Consumo", mt: 60e6, pg: 3e6, ts: 20 }] };
  it("pagada en un año, con la venta de su activo o con su cuota", () => {
    const r = proyectarFuturo10(u, { pagarDeudas: { s: Y2 + 1, vv: Y2 + 1 } });
    const f = (id) => r.deudas.find((d) => d.id === id);
    expect(f("s").finAnio).toBe(2);
    expect(f("vv").finAnio).toBe(2);
    expect(f("k").finPorCuota).toBe(true);
    expect(f("k").finAnio).toBe(3); // 60 M a 3 M/mes con 20 % E.A.: unos 24 meses → se acaba al empezar el año 3
    const hoy = proyectarFuturo10(u, { decisiones: { v: { accion: "vende" } } });
    expect(hoy.deudas.find((d) => d.id === "vv").finAnio).toBe(1);
  });
});

describe("informe: inversiones de años siguientes con su serie", () => {
  it("una inversión de 2027 trae su id y en el último año vale más que lo invertido", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 9000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { nuevas: [{ preset: "rfLargo", nombre: "SKANDIA", monto: 4000e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 14 }] });
    const d = r.nuevasDetalle.find((x) => x.nombre === "SKANDIA");
    expect(d.id).toBe("nueva_0");
    const fin = r.filas[r.filas.length - 1].porActivo.find((a) => a.id === d.id);
    expect(fin.valor).toBeGreaterThan(4000e6 * 2);
  });
});
