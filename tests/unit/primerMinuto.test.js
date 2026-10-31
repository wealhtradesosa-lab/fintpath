import { describe, it, expect } from "vitest";
import { itemsDesdeNorte } from "../../src/lib/norteUnMinuto.js";
import { calcularMetricas } from "../../src/lib/metrics.js";

describe("primer minuto → datos del dashboard", () => {
  it("tres cifras + rentas producen patrimonio y cobertura de rentas", () => {
    const it0 = itemsDesdeNorte({ ingresoTrabajo: "8000000", ingresoPasivo: "3000000", gastos: "6000000", ahorrado: "300000000", deudas: "50000000" }, "own_1");
    const inv = it0.inv.map((i) => ({ ...i, n: "Lo que tengo (estimado)", tp: "Otros" }));
    const m = calcularMetricas({ ingresos: it0.ingresos, gastos: it0.gas, deudas: it0.deu, inv, trm: 4000 });
    expect(m.patrimonioNeto).toBe(250000000);
    expect(m.ipBruto).toBe(3000000);
    expect(Math.round(m.coberturaPasiva)).toBe(50);
    expect(m.liquidos).toBe(0); // "lo que tengo" incluye propiedades: no se presume líquido
  });
});
