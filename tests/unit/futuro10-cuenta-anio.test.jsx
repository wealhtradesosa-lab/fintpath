import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { cuentaPorAnio } from "../../src/components/MiFuturo10.jsx";

// 23-nov-2026 — La cuenta de cada año: viene de antes + flujo libre del año anterior + lo que llega − lo que se usa.
const Y = new Date().getFullYear();
const user = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [{ id: "d", n: "Saldo local", mt: 300e6, pg: 0, tipoInteres: "sin_interes" }] };

describe("cuenta año por año", () => {
  it("suma el flujo libre del año anterior, lo que llega y resta inversiones y deudas de ese año", () => {
    const cfg = { decisiones: { l: { accion: "vende" } }, terminan: {}, nuevas: [{ preset: "rfCorto", monto: 200e6, fuente: "liquidez", anio: 2 }], pagarDeudas: { d: Y + 1 } };
    const r = proyectarFuturo10(user, cfg);
    const c = cuentaPorAnio(r, cfg);
    const g2 = c.find((g) => g.anio === 2);
    expect(g2.antes).toBeCloseTo(Math.max(0, r.bolsaDetalle.restante), 0);
    expect(g2.flujo).toBeCloseTo(r.filas[2].cf, 0); // lo que sobra del flujo de ese mismo año
    expect(g2.flujoHoy).toBeCloseTo(r.filas[1].cf, 0); // y lo del año en curso llega al siguiente
    expect(g2.salen.some((u) => u.tipo === "A" && Math.round(u.monto) === 300e6)).toBe(true);
    expect(g2.salen.some((u) => u.tipo === "C" && Math.round(u.monto) === 200e6)).toBe(true);
    expect(g2.saldo).toBeCloseTo(g2.antes + g2.flujoHoy + g2.flujo + g2.llega - g2.sale, 0);
    const g3 = c.find((g) => g.anio === 3);
    expect(g3.antes).toBeCloseTo(Math.max(0, g2.saldo), 0);
  });
  it("lo que sobra cada mes con destino fijo en D no se suma al año siguiente", () => {
    const cfg = { sobraDestinos: [{ id: "c", pct: 100 }] };
    const r = proyectarFuturo10(user, cfg);
    const g = cuentaPorAnio(r, cfg).find((x) => x.anio === 2);
    expect(g.flujo).toBeCloseTo(0, 0);
    expect(g.flujoHoy).toBeCloseTo(0, 0);
  });
});

import { activosParaAportar } from "../../src/components/MiFuturo10.jsx";
describe("activos a los que se les puede aportar en un año", () => {
  it("no ofrece lo que ya se vendió ese año o antes, ni lo que ya tiene aporte ese año; sí ofrece aportar otra vez en otro año", () => {
    const u = { inflacionPct: 4, inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 3000e6 }, { id: "ib", n: "IBKR", tp: "ETF", va: 500e6 }, { id: "v", n: "Carro", tp: "Vehículo", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const cfg = { decisiones: { pm: { accion: "termina", desde: 2 } }, reinversiones: [{ activoId: "ib", monto: 100e6, anio: 2 }] };
    const r = proyectarFuturo10(u, cfg);
    const ids = (t) => activosParaAportar(r, cfg, t).map((a) => a.id);
    expect(ids(1)).toEqual(expect.arrayContaining(["pm", "ib"]));
    expect(ids(1)).not.toContain("v");
    expect(ids(2)).not.toContain("pm"); // se vende en el año 2
    expect(ids(2)).not.toContain("ib"); // ya tiene aporte en el año 2
    expect(ids(3)).toContain("ib"); // otro aporte en el año 3
    expect(ids(3)).not.toContain("pm");
  });
});

// 23-nov-2026 (Santiago: "uno puede ampliar su inversión en los fondos de renta, CDTs…").
import { proyectarFuturo10 as proyectar2, cuentaPorAnio as cuenta2 } from "../../src/lib/futuro10.js";
describe("aportes a una inversión creada en el plan", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 3000e6 }], ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} };
  const base = { nuevas: [{ preset: "custom", nombre: "CDT Bancolombia", monto: 1000e6, anio: 1, fuente: "liquidez", rendimientoNomPct: 10 }] };
  it("le meto 500 MM en 2028 a un CDT creado hoy: entra ese año, sale del saldo de ese año y sigue rindiendo igual", () => {
    const sin = proyectar2(u, base);
    const con = proyectar2(u, { ...base, reinversiones: [{ activoId: "nueva_0", monto: 500e6, anio: 3 }] });
    const v = (r, t) => r.filas[t].porActivo.find((a) => a.id === "nueva_0").valor;
    expect(v(con, 2)).toBeCloseTo(v(sin, 2), -3);
    expect(v(con, 3) - v(sin, 3)).toBeCloseTo(500e6, -3); // entra ese año
    expect(v(con, 4) - v(sin, 4)).toBeGreaterThan(500e6); // y desde ahí rinde
    const g = cuenta2(con).find((x) => x.anio === 3);
    expect(g.salen.some((s) => /CDT Bancolombia/.test(s.nombre) && Math.abs(s.monto - 500e6) < 1)).toBe(true);
    expect(con.reinversionesDetalle.some((d) => d.aNueva && d.activoId === "nueva_0" && d.anio === 3)).toBe(true);
  });
  it("la lista de «meterle más» trae lo creado en años anteriores, no lo del mismo año", () => {
    const r = proyectar2(u, { nuevas: [...base.nuevas, { preset: "custom", nombre: "Renta fija 2027", monto: 300e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 9 }] });
    const ids = (t) => activosParaAportar(r, {}, t).map((a) => a.id);
    expect(ids(1)).not.toContain("nueva_0");
    expect(ids(2)).toContain("nueva_0");
    expect(ids(2)).not.toContain("nueva_1");
    expect(ids(3)).toContain("nueva_1");
  });
  it("una inversión que empieza en 2027 también recibe aportes en años siguientes", () => {
    const cfg = { nuevas: [{ preset: "custom", nombre: "Fondo 2027", monto: 400e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 9 }] };
    const sin = proyectar2(u, cfg);
    const con = proyectar2(u, { ...cfg, reinversiones: [{ activoId: "nueva_0", monto: 200e6, anio: 4 }] });
    const v = (r, t) => (r.filas[t].porActivo.find((a) => a.id === "nueva_0") || {}).valor || 0;
    expect(v(con, 4) - v(sin, 4)).toBeCloseTo(200e6, -3);
    expect(v(con, 5) - v(sin, 5)).toBeGreaterThan(200e6);
  });
});

describe("saldo para imprevistos", () => {
  it("viaja en el resultado para que el informe lo nombre, y no cambia la cuenta del año", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 3000e6 }], ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} };
    const sin = proyectar2(u, {}), con = proyectar2(u, { reserva: 500e6 });
    expect(con.reserva).toBe(500e6);
    expect(sin.reserva).toBe(0);
    expect(cuenta2(con).map((g) => Math.round(g.saldo))).toEqual(cuenta2(sin).map((g) => Math.round(g.saldo)));
  });
});
