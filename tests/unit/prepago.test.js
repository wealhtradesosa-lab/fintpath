// 14-nov-2026 — Pago por adelantado (Santiago: "un seguro, una membresía… poder poner
// pagado el total, por tanto no sigue apareciendo el resto del año").
import { describe, it, expect } from "vitest";
import { montoDelMes, montoPromedioMensual, prepagoDelAño } from "../../src/lib/flowHelpers.js";

const gym = { c: "Gimnasio", m: 300000, frecuencia: "mensual", prepago: { año: 2026, mes: 3, hastaMes: 12, monto: 2500000 } };

describe("pago por adelantado", () => {
  it("sale completo en el mes en que se pagó y no vuelve a salir hasta el mes cubierto", () => {
    expect([1, 2, 3, 4, 12].map((k) => montoDelMes(gym, 2026, k))).toEqual([300000, 300000, 2500000, 0, 0]);
  });
  it("el año siguiente sigue normal", () => {
    expect(montoDelMes(gym, 2027, 4)).toBe(300000);
  });
  it("no cambia el promedio (el gasto sigue existiendo)", () => {
    expect(montoPromedioMensual(gym)).toBe(300000);
  });
  it("cubrir solo hasta junio deja julio normal", () => {
    const g = { ...gym, prepago: { año: 2026, mes: 3, hastaMes: 6, monto: 1200000 } };
    expect([3, 4, 6, 7].map((k) => montoDelMes(g, 2026, k))).toEqual([1200000, 0, 0, 300000]);
  });
  it("datos raros se normalizan (hasta antes del mes de pago = solo ese mes)", () => {
    expect(prepagoDelAño({ prepago: { año: 2026, mes: 8, hastaMes: 2, monto: 5 } }, 2026)).toEqual({ mes: 8, hastaMes: 8, monto: 5 });
    expect(prepagoDelAño(gym, 2025)).toBeNull();
  });
});
