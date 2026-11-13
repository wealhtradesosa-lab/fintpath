// 13-nov-2026 (Santiago: "lo que no debe pasar es que considere valores apagados").
// Nivel de libertad y salud financiera: un ingreso, gasto, deuda o activo con
// el interruptor apagado (sim:false) no suma, ni en la base del mes ni en el promedio.
import { describe, it, expect } from "vitest";
import { calcularMetricas } from "../../src/lib/metrics.js";
import { saludFinanciera } from "../../src/lib/metrics.js";

const base = {
  ingresos: [{ id: "i1", nombre: "Arriendo local", categoria: "Arriendo", mensual: 10_000_000 }],
  gastos: { Hogar: [{ id: "g1", nombre: "Mercado", mensual: 4_000_000 }] },
  deudas: [{ id: "d1", nombre: "Crédito", mt: 100_000_000, pg: 2_000_000 }],
  inv: [{ id: "a1", nombre: "Local", tp: "Inmueble", va: 1_000_000_000 }],
  trm: 4000,
};
const conApagados = {
  ...base,
  ingresos: [...base.ingresos, { id: "i2", nombre: "Renta apagada", categoria: "Arriendo", mensual: 14_000_000, sim: false }],
  gastos: { ...base.gastos, "Seguridad Social": [{ id: "g2", nombre: "Seguridad social", mensual: 27_600_000, sim: false }] },
  deudas: [...base.deudas, { id: "d2", nombre: "Deuda apagada", mt: 500_000_000, pg: 9_000_000, sim: false }],
  inv: [...base.inv, { id: "a2", nombre: "Activo apagado", tp: "Inmueble", va: 3_000_000_000, sim: false }],
};

describe("los valores apagados no cuentan", () => {
  for (const opts of [{}, { base: "mes" }]) {
    it(`misma foto con y sin apagados (${opts.base || "promedio"})`, () => {
      const a = calcularMetricas(base, opts), b = calcularMetricas(conApagados, opts);
      for (const k of ["ip", "ipBruto", "ob", "fl", "activosTotal", "deudaTotal", "patrimonioNeto", "colchonMeses"]) expect(b[k]).toBe(a[k]);
      expect(b.nivel.nivel).toBe(a.nivel.nivel);
      expect(saludFinanciera(b).score).toBe(saludFinanciera(a).score);
    });
  }
  it("pero avisa cuánto quedó oculto", () => {
    const b = calcularMetricas(conApagados);
    expect(b.ocultos.nGastos).toBe(1);
    expect(b.ocultos.nIngresos).toBe(1);
  });
});
