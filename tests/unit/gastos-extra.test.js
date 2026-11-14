import { describe, it, expect } from "vitest";
import { calendarioExtra, extrasCajaDelMes, registrarExtra, crearConExtra, eliminarExtra, esMenorQueUmbral } from "../../src/lib/gastosExtra.js";
import { gastoDelMes } from "../../src/lib/flujoMes.js";
import { montoPromedioMensual } from "../../src/lib/flowHelpers.js";

// 14-nov-2026: gasto extraordinario (caso vacaciones US$4.500 con tarjeta).
const año = 2026;
const gastos = { Entretenimiento: [{ c: "Salidas", m: 2_000_000, frecuencia: "mensual" }] };
describe("gastos extraordinarios", () => {
  it("contado sale el mismo mes; tarjeta a un pago, el mes siguiente", () => {
    expect(calendarioExtra({ año, mes: 11, monto: 10, pago: "contado" })).toEqual([{ año, mes: 11, monto: 10 }]);
    expect(calendarioExtra({ año, mes: 11, monto: 10, pago: "tarjeta1" })).toEqual([{ año, mes: 12, monto: 10 }]);
    expect(calendarioExtra({ año, mes: 12, monto: 10, pago: "tarjeta1" })[0]).toMatchObject({ año: 2027, mes: 1 });
  });
  it("a cuotas: N pagos con intereses desde el mes siguiente", () => {
    const c = calendarioExtra({ año, mes: 11, monto: 12_000_000, pago: "cuotas", cuotas: 12, tasa: 28 });
    expect(c).toHaveLength(12);
    expect(c[0]).toMatchObject({ año, mes: 12 });
    expect(c[1]).toMatchObject({ año: 2027, mes: 1 });
    expect(c.reduce((t, p) => t + p.monto, 0)).toBeGreaterThan(12_000_000);
  });
  it("vacaciones en USD con tarjeta: el gasto queda en el concepto y la caja sale en diciembre", () => {
    const g2 = registrarExtra(gastos, "Entretenimiento", 0, { año, mes: 11, monto: 4_500, moneda: "USD", pago: "tarjeta1", nota: "Vacaciones" });
    const g = g2.Entretenimiento[0];
    expect(extrasCajaDelMes(g, año, 11, 4_000)).toBe(0);
    expect(extrasCajaDelMes(g, año, 12, 4_000)).toBe(18_000_000);
    expect(gastoDelMes(g, año, 12, 4_000)).toBe(20_000_000);
    expect(montoPromedioMensual(g)).toBe(2_000_000); // no es recurrente
  });
  it("crear un concepto nuevo sin monto recurrente, y quitar el extra", () => {
    const g2 = crearConExtra(gastos, { nombre: "Vacaciones", cat: "Viajes" }, { año, mes: 11, monto: 5_000_000, pago: "contado" });
    const v = g2.Viajes[0];
    expect(v).toMatchObject({ c: "Vacaciones", m: 0, soloExtras: true });
    expect(gastoDelMes(v, año, 11, 4_000)).toBe(5_000_000);
    const g3 = eliminarExtra(g2, "Viajes", 0, v.extras[0].id);
    expect(g3.Viajes[0].extras).toHaveLength(0);
  });
  it("umbral que orienta: menos del 5 % del gasto mensual", () => {
    expect(esMenorQueUmbral(300_000, 20_000_000)).toBe(true);
    expect(esMenorQueUmbral(5_000_000, 20_000_000)).toBe(false);
  });
});
