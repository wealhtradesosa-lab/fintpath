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
