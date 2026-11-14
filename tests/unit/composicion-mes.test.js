import { describe, it, expect } from "vitest";
import { composicionMes } from "../../src/lib/composicionMes.js";
import { montoDelMes, getMesActual } from "../../src/lib/flowHelpers.js";

// 14-nov-2026: la lista del mes debe sumar exactamente el total del mes.
const { año } = getMesActual();
const user = {
  ingresos: [
    { nombre: "Salario", mensual: 10_000_000, frecuencia: "mensual" },
    { nombre: "Renta USD", mensual: 1_000, moneda: "USD", frecuencia: "mensual", desdeMes: 6, hastaMes: 12 },
    { nombre: "Prima", mensual: 5_000_000, frecuencia: "anual", mesPago: 12 },
    { nombre: "Apagado", mensual: 9e6, frecuencia: "mensual", sim: false },
  ],
  gastos: {
    Vivienda: [{ c: "Arriendo", m: 3_000_000, frecuencia: "mensual" }],
    "Seguridad Social": [{ c: "Pensión", m: 1_000_000, frecuencia: "mensual" }],
    Impuestos: [{ c: "Predial", m: 2_400_000, frecuencia: "anual", mesPago: 3 }],
  },
  deudas: [
    { n: "Hipoteca", mt: 100e6, pago: 2_000_000 },
    { n: "Vehículo", mt: 20e6, pago: 800_000, desdeMes: 1, hastaMes: 6 },
    { n: "Saldada", mt: 0, pago: 500_000 },
  ],
};
describe("composicionMes", () => {
  it("los totales cuadran con el motor en los 12 meses", () => {
    for (let mes = 1; mes <= 12; mes++) {
      const c = composicionMes({ user, año, mes, trm: 4000 });
      let ing = 0;
      user.ingresos.forEach((i) => { if (i.sim !== false) ing += montoDelMes({ ...i, mensual: i.mensual * (i.moneda === "USD" ? 4000 : 1) }, año, mes); });
      expect(c.totalIngresos).toBeCloseTo(ing, 2);
      expect(c.totalIngresos).toBeCloseTo(c.ingresos.reduce((s, x) => s + x.monto, 0), 2);
    }
  });
  it("noviembre: lista los conceptos del mes, sin apagados ni deudas fuera de vigencia", () => {
    const c = composicionMes({ user, año, mes: 11, trm: 4000 });
    expect(c.ingresos.map((x) => x.nombre)).toEqual(["Salario", "Renta USD"]);
    expect(c.totalIngresos).toBe(14_000_000);
    expect(c.gastos.map((x) => x.nombre)).toEqual(["Arriendo", "Pensión"]);
    expect(c.cuotas).toEqual([{ nombre: "Hipoteca", monto: 2_000_000 }]);
  });
  it("marzo incluye el pago anual y la cuota vigente", () => {
    const c = composicionMes({ user, año, mes: 3, trm: 4000 });
    expect(c.totalGastos).toBe(6_400_000);
    expect(c.totalCuotas).toBe(2_800_000);
  });
});
