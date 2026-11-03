// 2-nov-2026 — El motor de EE. UU. calculaba con cifras 2025 y solo para
// soltero. Estas pruebas fijan las cifras 2026 (IRS Rev. Proc. 2025-32, SSA)
// y que todas las pantallas lean la misma tabla.
import { describe, it, expect } from "vitest";
import { US } from "../../src/lib/jurisdictions/US.js";
import { US_TAX_YEAR, STANDARD_DEDUCTION, FEDERAL_BRACKETS, LTCG_BREAKPOINTS, US_LIMITS, federalTax, fechasEstimadosUS } from "../../src/lib/jurisdictions/usStateTax.js";

describe("EE. UU. año fiscal 2026", () => {
  it("año y deducción estándar", () => {
    expect(US_TAX_YEAR).toBe(2026);
    expect(STANDARD_DEDUCTION).toEqual({ single: 16100, married_jointly: 32200, married_separately: 16100, head_of_household: 24150 });
  });
  it("tramos: puntos de quiebre del IRS", () => {
    expect(FEDERAL_BRACKETS.single.map((b) => b.max).slice(0, 6)).toEqual([12400, 50400, 105700, 201775, 256225, 640600]);
    expect(FEDERAL_BRACKETS.married_jointly.map((b) => b.max).slice(0, 6)).toEqual([24800, 100800, 211400, 403550, 512450, 768700]);
    expect(FEDERAL_BRACKETS.head_of_household[0].max).toBe(17700);
    expect(FEDERAL_BRACKETS.married_separately[5].max).toBe(384350);
  });
  it("impuesto federal soltero sobre $100.000 brutos", () => {
    // 83.900 gravables: 1.240 + 4.560 + 7.370
    const r = US.calculateIncomeTax(100000);
    expect(r.taxableIncome).toBe(83900);
    expect(r.tax).toBe(13170);
    expect(r.marginalRate).toBe(0.22);
  });
  it("respeta el estado civil", () => {
    expect(US.calculateIncomeTax(100000, "married_jointly").tax).toBe(7640);
    expect(federalTax(0).tax).toBe(0);
  });
  it("ganancia de largo plazo se apila sobre el ingreso ordinario", () => {
    // 20.000 de ingreso → 3.900 gravables; 50.000 de ganancia: 45.550 al 0 % y 4.450 al 15 %
    const r = US.calculateCapitalGains(50000, 400, 20000);
    expect(r.tax).toBe(Math.round(4450 * 0.15));
    expect(LTCG_BREAKPOINTS.married_jointly).toEqual({ cero: 98900, quince: 613700 });
  });
  it("límites de retiro y Seguro Social", () => {
    expect(US_LIMITS.k401).toBe(24500);
    expect(US_LIMITS.ira).toBe(7500);
    expect(US_LIMITS.ssWageBase).toBe(184500);
    expect(US_LIMITS.hsaSelf).toBe(4400);
    expect(US.calculateRetirementContribution(200000).breakdown.socialSecurity).toBe(Math.round(184500 * 0.062));
  });
  it("fechas de pagos estimados del año fiscal", () => {
    expect(fechasEstimadosUS(2026).map((f) => f.due)).toEqual(["April 15, 2026", "June 15, 2026", "September 15, 2026", "January 15, 2027"]);
    // 2028: 15 de abril cae sábado → lunes 17
    expect(fechasEstimadosUS(2028)[0].due).toBe("April 17, 2028");
  });
});
