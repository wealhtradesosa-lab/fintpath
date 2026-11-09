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

// 9-nov-2026 — Escenarios con crecimiento que baja (Santiago: "¿cómo ponemos
// escenarios que sí sean realistas?"). Caso real: $350.000.000 en una compra,
// 10 años, retiro 6 % hasta los 80 (18 años).
import { ESCENARIOS_CURVA, tasaCurva, trayectoria, techoPersonalizado, PRECIO_TECHO_REALISTA, proyeccionPrecio } from "../../src/lib/ahorroBTC.js";
describe("escenarios con curva", () => {
  const caso = { frecuencia: "unico", monto: 350e6, años: 10, precioHoy: 75_270, trm: 3_900 };
  it("la tasa arranca en r0, baja a la mitad del exceso cada 4 años y tiende a rt", () => {
    const b = ESCENARIOS_CURVA.find((e) => e.id === "base");
    expect(tasaCurva(b, 1)).toBe(25);
    expect(tasaCurva(b, 5)).toBeCloseTo(15, 6);
    expect(tasaCurva(b, 60)).toBeCloseTo(5, 1);
  });
  it("ningún escenario pasa el techo realista en 40 años", () => {
    for (const e of ESCENARIOS_CURVA) expect(75_270 * trayectoria({ curva: e }).f(40 * 12)).toBeLessThan(PRECIO_TECHO_REALISTA);
  });
  it("sin curva, la trayectoria es la tasa fija de siempre", () => {
    expect(trayectoria({ cagr: 10 }).f(24)).toBeCloseTo(1.21, 10);
  });
  it("caso de Santiago con Base: herencia de cientos de millones, no decenas de miles de millones", () => {
    const b = ESCENARIOS_CURVA.find((e) => e.id === "base");
    const r = simularAhorroBTC({ ...caso, curva: b });
    const ret = simularRetiro({ capital: r.valorCOPHoy, retiroPct: 6, años: 18, curva: b, desdeAño: 10, precioInicial: r.precioFinal });
    expect(r.irreal).toBe(false); expect(ret.irreal).toBe(false);
    expect(ret.capitalFinal).toBeLessThan(2e9);
    expect(ret.precioFinal).toBeLessThan(1_500_000);
    expect(proyeccionPrecio({ precioHoy: 75_270, curva: b, años: 10 }).at(-1).precio).toBeCloseTo(r.precioFinal, 0);
  });
  it("prueba de estrés: caer 60 % al empezar a retirar deja menos (o se acaba)", () => {
    const b = ESCENARIOS_CURVA.find((e) => e.id === "base");
    const r = simularAhorroBTC({ ...caso, curva: b });
    const a = { capital: r.valorCOPHoy, retiroPct: 6, años: 18, curva: b, desdeAño: 10, precioInicial: r.precioFinal };
    const n = simularRetiro(a), s = simularRetiro({ ...a, caidaInicial: 0.6 });
    expect(s.retiroMes).toBe(n.retiroMes);
    expect(s.capitalFinal).toBeLessThan(n.capitalFinal);
    expect(s.agotaEn).not.toBeNull();
  });
  it("personalizado: 35 % y luego 20 % es irreal y el máximo realista del retiro es ~7 %", () => {
    const t = techoPersonalizado({ precioHoy: 75_270, cagr: 35, años: 10, crecRetiro: 20, añosRetiro: 18 });
    expect(t.irreal).toBe(true); expect(t.irrealAhorro).toBe(false); expect(t.maxCrecRetiro).toBe(7);
    expect(techoPersonalizado({ precioHoy: 75_270, cagr: 35, años: 10, crecRetiro: 7, añosRetiro: 18 }).irreal).toBe(false);
  });
});
