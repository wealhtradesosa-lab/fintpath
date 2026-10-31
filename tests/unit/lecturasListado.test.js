import { describe, it, expect } from "vitest";
import { corteTrabajo, mesVsPromedio } from "../../src/lib/lecturasListado.js";
import { claseGasto } from "../../src/lib/clasesListado.js";

describe("lecturas de listados", () => {
  it("corte trabajo / sin trabajar, con dólares", () => {
    const r = corteTrabajo([
      { categoria: "Salario", mensual: 100 },
      { categoria: "Arriendo", mensual: 1, moneda: "USD" },
      { categoria: "Dividendos", mensual: 50, sim: false },
    ], 300);
    expect(r.trabajo).toBe(100);
    expect(r.sinTrabajo).toBe(300);
    expect(r.pctSin).toBe(75);
  });
  it("mes contra promedio por clase", () => {
    const g = [
      { cat: "Entretenimiento", m: 0, frecuencia: "variable", montosMensuales: [0,0,0,0,0,0,0,0,0,1200,0,0] }, // prom 100, oct 1200
      { cat: "Vivienda", m: 1000 },
    ];
    const r = mesVsPromedio(g, claseGasto, { año: 2026, mes: 10 });
    expect(r.notables[0].id).toBe("estilo");
    expect(Math.round(r.notables[0].dif)).toBe(1100);
  });
});
