import { describe, it, expect } from "vitest";
import { proyectarFuturo10, leerPropiedadRaiz, migrarCiclos, migrarModifica } from "../../src/lib/futuro10.js";

// 23-nov-2026 — Propiedad raíz con modalidades; «Negocios que se repiten» se migra sin cambiar el resultado.
const user = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 3000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 40e6 }], gas: { Vida: [{ n: "Mercado", m: 15e6 }] }, deu: [] };

describe("propiedad raíz", () => {
  it("migrar «Negocios que se repiten» da el mismo plan", () => {
    const ciclos = [{ nombre: "Asociativo", capital: 1350e6, valorFinal: 1900e6, meses: 24, desde: 2, hasta: 8, costosPct: 2, fuente: "liquidez", destino: "reinvierte" }];
    const antes = proyectarFuturo10(user, { ciclos });
    const cfgM = migrarCiclos({ ciclos });
    expect(cfgM.ciclos).toHaveLength(0);
    expect(cfgM.nuevas[0].pr.tipo).toBe("asociativo");
    const despues = proyectarFuturo10(user, cfgM);
    expect(despues.final.patrimonio).toBeCloseTo(antes.final.patrimonio, 0);
    expect(despues.filas[5].ingresos).toBeCloseTo(antes.filas[5].ingresos, 0);
    expect(migrarModifica({ ciclos }).nuevas).toHaveLength(1);
  });

  it("compra en planos vendida a la entrega: entra la cuota inicial y gana la valorización sobre el valor completo", () => {
    const x = { preset: "fincaRaiz", anio: 1, fuente: "liquidez", pr: { tipo: "planos", valor: 800e6, cuotaPct: 30, plazo: 2, valEntregaPct: 20, final: "vende", vendeEn: 0, costosPct: 0 } };
    const p = leerPropiedadRaiz(x, 10);
    expect(p.capital).toBeCloseTo(240e6, 0);
    expect(p.valorFinal).toBeCloseTo(240e6 + 160e6, 0);
    expect(p.durAnios).toBe(2);
    expect(p.regimen).toBe("ocasional"); // 24 meses → ganancia ocasional
    const r = proyectarFuturo10(user, { nuevas: [x] });
    expect(r.bolsaDetalle.ciclos).toBeCloseTo(240e6, 0);
  });

  it("se repite: el ciclo corre hasta el final del plan; una sola vez: solo su duración", () => {
    const base = { preset: "fincaRaiz", anio: 1, pr: { tipo: "planos", valor: 800e6, cuotaPct: 30, plazo: 2, valEntregaPct: 20, final: "vende" } };
    expect(leerPropiedadRaiz({ ...base, pr: { ...base.pr, repite: true } }, 10).hasta).toBe(10);
    expect(leerPropiedadRaiz(base, 10).hasta).toBe(2);
    expect(leerPropiedadRaiz({ ...base, pr: { ...base.pr, repite: true } }, 10).veces).toBe(5);
  });

  it("me quedo con ella: paga cuota hoy y saldo a la entrega, salta de valor y renta desde la entrega", () => {
    const x = { preset: "fincaRaiz", anio: 1, fuente: "liquidez", pr: { tipo: "planos", valor: 800e6, cuotaPct: 30, plazo: 2, valEntregaPct: 20, valAnualPct: 6, final: "queda", rentaMensual: 5e6 } };
    const r = proyectarFuturo10(user, { nuevas: [x] });
    const a = (t) => r.filas[t].porActivo.find((y) => y.id === "nueva_0");
    expect(a(0).valor).toBeCloseTo(240e6, 0);
    expect(a(3).valor).toBeCloseTo(960e6, -3);
    expect(a(4).valor).toBeCloseTo(960e6 * 1.06, -3);
    expect(r.bolsaDetalle.usos.some((u) => u.anio === 3 && Math.round(u.monto) === 560e6)).toBe(true);
    expect(r.filas[3].rentaNueva).toBeGreaterThan(0);
  });

  it("lote y construcción: capital = lote + m² × costo; valor final = m² × precio de venta", () => {
    const p = leerPropiedadRaiz({ preset: "fincaRaiz", anio: 2, pr: { tipo: "lote", lote: 400e6, m2: 500, costoM2: 2.4e6, ventaM2: 5e6, plazo: 2, final: "vende", repite: true } }, 10);
    expect(p.capital).toBeCloseTo(1600e6, 0);
    expect(p.ventaBruta).toBeCloseTo(2500e6, 0);
    expect(p.valorFinal).toBeCloseTo(2500e6 * 0.97, 0); // 3 % de costos de venta sobre el precio
    expect(p.retencion).toBeCloseTo(25e6, 0); // 1 % del valor de venta (art. 398)
    expect(p.ciclo.desde).toBe(2);
  });

  it("precio de venta total, por m² o margen; con pérdida no hay impuesto y se muestra la pérdida", () => {
    const base = { preset: "fincaRaiz", anio: 1, pr: { tipo: "lote", lote: 650e6, m2: 240, costoM2: 3e6, plazo: 1, final: "vende", costosPct: 0 } };
    const m2 = leerPropiedadRaiz({ ...base, pr: { ...base.pr, ventaModo: "m2", ventaM2: 4.6e6 } }, 10);
    expect(m2.capital).toBeCloseTo(1370e6, 0);
    expect(m2.ventaBruta).toBeCloseTo(1104e6, 0);
    expect(m2.gananciaAntes).toBeCloseTo(-266e6, 0);
    expect(m2.impuestoCiclo).toBe(0);
    expect(m2.gananciaCiclo).toBeCloseTo(-266e6, 0);
    const tot = leerPropiedadRaiz({ ...base, pr: { ...base.pr, ventaModo: "total", ventaTotal: 2000e6 } }, 10);
    expect(tot.ventaBruta).toBeCloseTo(2000e6, 0);
    const pct = leerPropiedadRaiz({ ...base, pr: { ...base.pr, ventaModo: "pct", valEntregaPct: 25 } }, 10);
    expect(pct.ventaBruta).toBeCloseTo(1370e6 * 1.25, 0);
    const ret = leerPropiedadRaiz({ ...base, pr: { ...base.pr, ventaModo: "total", ventaTotal: 2000e6, retencionPct: 2.5 } }, 10);
    expect(ret.retencion).toBeCloseTo(50e6, 0);
    expect(ret.saldoDeclaracion).toBeCloseTo(ret.impuestoCiclo - 50e6, 0);
  });
});
