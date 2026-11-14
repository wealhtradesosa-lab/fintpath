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
    expect(prepagoDelAño({ prepago: { año: 2026, mes: 8, hastaMes: 2, monto: 5 } }, 2026)).toEqual({ mes: 8, hastaMes: 8, monto: 5, incluyeMes: true });
    expect(prepagoDelAño(gym, 2025)).toBeNull();
  });
});

// 14-nov-2026 (Santiago: "un gasto es un gasto y debe alterar el índice de libertad; cada año
// saco vacaciones"). Marcar un gasto anual como pagado ya no lo saca del promedio.
describe("un gasto anual pagado sigue contando", () => {
  it("el promedio mensual es el mismo, pagado o no", () => {
    const vac = { c: "Vacaciones", m: 12000000, frecuencia: "anual", mesPago: 6 };
    const año = new Date().getFullYear();
    expect(montoPromedioMensual(vac)).toBe(1000000);
    expect(montoPromedioMensual({ ...vac, pagos: { [año]: true } })).toBe(1000000);
  });
});

// 14-nov-2026 (Santiago: "cada mes pago 3 MM y este mes pagué 25 MM, incluida la cuota o no";
// "ahí mismo puede uno marcar se pagó todo lo pendiente y deja de cobrarse la cuota").
import { montoDelMes as _mdm, montoPromedioMensual as _mpm } from "../../src/lib/flowHelpers.js";
import { describe as _d, it as _it, expect as _e } from "vitest";
_d("abono o pago extraordinario en un gasto mensual de 3 MM", () => {
  const base = { c: "Colegio", m: 3e6, frecuencia: "mensual" };
  _it("25 MM que incluyen la cuota: ese mes sale 25 MM y los demás siguen normal", () => {
    const g = { ...base, prepago: { año: 2026, mes: 11, monto: 25e6, incluyeMes: true, hastaMes: 11 } };
    _e(_mdm(g, 2026, 11)).toBe(25e6);
    _e(_mdm(g, 2026, 12)).toBe(3e6);
    _e(_mdm(g, 2026, 10)).toBe(3e6);
  });
  _it("25 MM aparte de la cuota: ese mes sale 28 MM", () => {
    const g = { ...base, prepago: { año: 2026, mes: 11, monto: 25e6, incluyeMes: false, hastaMes: 11 } };
    _e(_mdm(g, 2026, 11)).toBe(28e6);
    _e(_mdm(g, 2026, 12)).toBe(3e6);
  });
  _it("pagó todo lo pendiente del año en noviembre: diciembre no se cobra; 2027 normal", () => {
    const g = { ...base, prepago: { año: 2026, mes: 11, monto: 6e6, incluyeMes: true, hastaMes: 12 } };
    _e(_mdm(g, 2026, 11)).toBe(6e6);
    _e(_mdm(g, 2026, 12)).toBe(0);
    _e(_mdm(g, 2027, 1)).toBe(3e6);
    _e(_mpm(g)).toBe(3e6); // el promedio y el nivel no cambian
  });
  _it("pagos viejos sin incluyeMes se leen como que incluyen la cuota (como antes)", () => {
    const g = { ...base, prepago: { año: 2026, mes: 11, monto: 6e6, hastaMes: 12 } };
    _e(_mdm(g, 2026, 11)).toBe(6e6);
  });
});
