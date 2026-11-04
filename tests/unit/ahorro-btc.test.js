import { describe, it, expect } from "vitest";
import { simularAhorroBTC, escenariosAhorroBTC, pensionParaComparar } from "../../src/lib/ahorroBTC.js";

const base = { frecuencia: "mensual", monto: 1_000_000, años: 10, precioHoy: 100_000, trm: 4_000 };

describe("simularAhorroBTC", () => {
  it("sin monto o sin años no hay resultado (la sección no muestra cifras antes de empezar)", () => {
    expect(simularAhorroBTC({ ...base, monto: 0, cagr: 10 })).toBeNull();
    expect(simularAhorroBTC({ ...base, años: 0, cagr: 10 })).toBeNull();
  });
  it("con crecimiento igual a la inflación del dólar, el valor en pesos de hoy ≈ lo invertido", () => {
    const r = simularAhorroBTC({ ...base, frecuencia: "unico", cagr: 3 });
    expect(r.invertido).toBe(1_000_000);
    expect(r.valorCOPHoy).toBeCloseTo(1_000_000, 0);
  });
  it("aporte mensual: 120 compras e invertido = monto × 12 × años", () => {
    const r = simularAhorroBTC({ ...base, cagr: 10 });
    expect(r.invertido).toBe(120_000_000);
    expect(r.serie).toHaveLength(10);
    expect(r.retiroMes).toBeCloseTo(r.valorCOPHoy * 0.04 / 12, 6);
  });
  it("aporte anual compra una vez por año", () => {
    const r = simularAhorroBTC({ ...base, frecuencia: "anual", cagr: 0 });
    expect(r.btc).toBeCloseTo(10 * 1_000_000 / 4_000 / 100_000, 10);
  });
  it("marca como irreal un escenario que vale más que un cuarto de la riqueza mundial", () => {
    expect(simularAhorroBTC({ ...base, cagr: 10 }).irreal).toBe(false);
    expect(simularAhorroBTC({ ...base, años: 20, cagr: 60 }).irreal).toBe(true);
  });
  it("tres escenarios ordenados de menor a mayor", () => {
    const e = escenariosAhorroBTC(base);
    expect(e.map((x) => x.id)).toEqual(["conservador", "moderado", "optimista"]);
    expect(e[0].r.valorCOPHoy).toBeLessThan(e[1].r.valorCOPHoy);
    expect(e[1].r.valorCOPHoy).toBeLessThan(e[2].r.valorCOPHoy);
  });
});

describe("pensionParaComparar", () => {
  it("usa la pensión calculada y guardada, sin rehacerla", () => {
    expect(pensionParaComparar({ fuente: "calculada", calculada: { neta: 12_000_000 } }).promedioMes).toBe(13_000_000);
  });
  it("acepta la mesada de alguien ya pensionado", () => {
    expect(pensionParaComparar({ fuente: "manual", manual: 6_000_000 }).mesada).toBe(6_000_000);
  });
  it("sin pensión no compara", () => {
    expect(pensionParaComparar({ fuente: "ninguna" })).toBeNull();
    expect(pensionParaComparar({ fuente: "calculada", calculada: null })).toBeNull();
  });
});

import { cagrHistorico, circulanteDesdeAltura, ofertaBTC, alturaEstimada, simularRetiro, comparativoHerencia, historicoConVariacion } from "../../src/lib/ahorroBTC.js";
describe("histórico y oferta", () => {
  it("crecimiento de los últimos 10 años ≈ 70 % y de 5 años ≈ 25 %", () => {
    expect(cagrHistorico(10)).toBeGreaterThan(65); expect(cagrHistorico(10)).toBeLessThan(75);
    expect(cagrHistorico(5)).toBeGreaterThan(22); expect(cagrHistorico(5)).toBeLessThan(28);
    expect(historicoConVariacion().find((h) => h.año === 2022).variacion).toBeLessThan(-60);
  });
  it("oferta: 19.687.500 BTC en el 4.º halving y nunca más de 21 millones", () => {
    expect(circulanteDesdeAltura(840_000)).toBe(19_687_500);
    expect(circulanteDesdeAltura(10_000_000)).toBeLessThanOrEqual(21_000_000);
    const o = ofertaBTC(alturaEstimada(Date.UTC(2026, 10, 4)));
    expect(o.circulante).toBeGreaterThan(20_000_000); expect(o.faltan).toBeLessThan(1_000_000);
    expect(o.proximoHalving).toBe(1_050_000); expect(o.recompensa).toBe(3.125);
  });
});
describe("retiro y herencia", () => {
  it("con crecimiento real 0 y 4 % de retiro, en 25 años queda ~0 %… y el capital no se agota antes", () => {
    const r = simularRetiro({ capital: 1000, retiroPct: 4, años: 25, cagr: 3, inflacionUSD: 3 });
    expect(r.capitalFinal).toBeCloseTo(0, 6);
    expect(r.totalRetirado).toBeCloseTo(1000, 6);
  });
  it("retirar 20 % agota el capital antes y deja menos herencia que 4 %", () => {
    const a = simularRetiro({ capital: 1000, retiroPct: 4, años: 25, cagr: 10 });
    const b = simularRetiro({ capital: 1000, retiroPct: 20, años: 25, cagr: 10 });
    expect(b.agotaEn).not.toBeNull();
    expect(b.capitalFinal).toBeLessThan(a.capitalFinal);
  });
  it("la pensión no deja capital heredable", () => {
    const r = simularRetiro({ capital: 1000, retiroPct: 4, años: 20, cagr: 10 });
    const c = comparativoHerencia({ pensionMes: 10, añosVida: 20, retiro: r });
    expect(c.pension.heredable).toBe(0);
    expect(c.pension.enVida).toBe(10 * 13 * 20);
    expect(c.btc.heredable).toBeGreaterThan(0);
  });
});

import { PROYECCIONES_ANALISTAS, cagrHacia } from "../../src/lib/ahorroBTC.js";
describe("proyecciones de analistas", () => {
  it("todas tienen fuente, fecha, año y url", () => {
    for (const p of PROYECCIONES_ANALISTAS) { expect(p.fuente).toBeTruthy(); expect(p.url).toMatch(/^https:/); expect(p.año).toBe(2030); }
  });
  it("crecimiento implícito: de 77.647 hoy (4-nov-2026) a 500 mil en 2030 ≈ 57 % al año", () => {
    const c = cagrHacia({ precioHoy: 77_647, precio: 500_000, año: 2030, hoy: Date.UTC(2026, 10, 4) });
    expect(c).toBeGreaterThan(54); expect(c).toBeLessThan(60);
  });
});
