// 23-nov-2026 (revisor de normas): el IRS subió el millaje a mitad de 2026
// (Announcement 2026-11, que modifica la Notice 2026-10): 72,5 ¢ hasta el
// 30-jun y 76 ¢ desde el 1-jul. https://www.irs.gov/tax-professionals/standard-mileage-rates
import { describe, it, expect } from "vitest";
import { deduccionMillaje } from "../../src/components/ExpensesModuleUS.jsx";

describe("Millaje de negocios 2026 con cambio a mitad de año", () => {
  it("sin millas del segundo semestre, todo va a 72,5 ¢", () => {
    expect(deduccionMillaje(10000, 0, 2026)).toBeCloseTo(7250, 6);
  });
  it("las millas del 1-jul en adelante van a 76 ¢", () => {
    // 6.000 × 0,725 + 4.000 × 0,76 = 4.350 + 3.040 = 7.390
    expect(deduccionMillaje(10000, 4000, 2026)).toBeCloseTo(7390, 6);
  });
  it("las millas del segundo semestre no pueden pasar del total", () => {
    expect(deduccionMillaje(1000, 5000, 2026)).toBeCloseTo(760, 6);
  });
  it("valores vacíos o negativos dan cero", () => {
    expect(deduccionMillaje(undefined, undefined, 2026)).toBe(0);
    expect(deduccionMillaje(-50, 0, 2026)).toBe(0);
  });
  it("2027 usa la última tarifa vigente (76 ¢) hasta que el IRS publique la de 2027", () => {
    expect(deduccionMillaje(1000, 999, 2027)).toBeCloseTo(760, 6);
  });
});
