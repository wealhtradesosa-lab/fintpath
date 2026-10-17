import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calcularMetricas, saludFinanciera, rentaYYield, gananciaVsInflacion, INFLACION_SUPUESTA_PCT } from "../../src/lib/metrics.js";

const qa = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_patrimonio_completo.json", import.meta.url), "utf8"));
const m = calcularMetricas({ ingresos: qa.ingresos, gastos: qa.gas, deudas: qa.deu, inv: qa.inv, trm: qa.trm });

describe("salud financiera (spec §2)", () => {
  const s = saludFinanciera(m);
  it("caso QA: 38 Crítica (ahorro 5,8%, deuda 38,2%, colchón 3,07, D/A 49,7%, cobertura 17,4%)", () => {
    expect(s.score).toBe(38);
    expect(s.banda).toBe("Crítica");
    expect(s.componentes.ahorro.puntos).toBeCloseTo(29.1, 1);
    expect(s.componentes.cargaDeuda.puntos).toBeCloseTo(22.8, 1);
    expect(s.componentes.colchon.puntos).toBeCloseTo(51.2, 1);
    expect(s.componentes.apalancamiento.puntos).toBeCloseTo(60.7, 1);
    expect(s.componentes.cobertura.puntos).toBeCloseTo(34.7, 1);
  });
  it("candado: patrimonio negativo o FL<0 → máx 39", () => {
    const x = saludFinanciera({ ingresoTotal: 10e6, fl: 5e6, sd: 0, colchonMeses: 12, activosTotal: 100, deudaTotal: 120, patrimonioNeto: -20, coberturaPasiva: 100 });
    expect(x.score).toBe(39);
    expect(x.candado).toBe("patrimonio_negativo");
  });
  it("extremos: todo al máximo = 100 Excelente; bandas", () => {
    const x = saludFinanciera({ ingresoTotal: 10e6, fl: 3e6, sd: 1e6, colchonMeses: 6, activosTotal: 100, deudaTotal: 10, patrimonioNeto: 90, coberturaPasiva: 60 });
    expect(x.score).toBe(100);
    expect(x.banda).toBe("Excelente");
  });
});

describe("renta anual y yield (spec §4)", () => {
  const r = rentaYYield(m);
  it("renta anual = IP×12 neto (no 117M)", () => {
    expect(r.rentaAnual).toBe(17970000);
  });
  it("yield sobre costo de los activos que rentan, nunca 0,0% con arriendo", () => {
    expect(r.yield).toBeCloseTo(4.46, 2);
    expect(r.etiqueta).toBe("Yield on cost");
  });
  it("sin costo cargado usa valor actual y lo rotula", () => {
    const x = rentaYYield(calcularMetricas({
      ingresos: [{ categoria: "Rentas de capital", mensual: 1000000, activoId: "a" }],
      inv: [{ id: "a", tp: "Real Estate", va: 200e6 }],
    }));
    expect(x.sobreValorActual).toBe(true);
    expect(x.etiqueta).toBe("Rendimiento por renta (sobre valor actual)");
    expect(x.yield).toBeCloseTo(6, 5);
  });
});

describe("inflación (spec §5)", () => {
  it("QA: nominal 4,4% vs 5,2% → no le gana (−0,8% real)", () => {
    const g = gananciaVsInflacion(m);
    expect(g.nominal).toBeCloseTo(4.42, 2);
    expect(g.real).toBeCloseTo(-0.78, 2);
    expect(g.mensaje).toBe("No le gana a la inflación (−0,8% real)");
    expect(g.inflacion).toBe(INFLACION_SUPUESTA_PCT);
  });
  it("con valorización declarada suma al nominal y puede ganarle", () => {
    const x = calcularMetricas({
      ingresos: [{ categoria: "Rentas de capital", mensual: 1000000, activoId: "a" }],
      inv: [{ id: "a", tp: "Real Estate", va: 200e6, vc: 150e6, valorizacionPct: 3 }],
    });
    const g = gananciaVsInflacion(x);
    expect(g.nominal).toBeCloseTo(9, 5);
    expect(g.mensaje).toBe("Tu portafolio le gana a la inflación (+3,8% real al año)");
  });
});
