// 18-nov-2026 — Año fiscal 2027 de EE. UU. (Santiago: "ok cárguelos").
// Fuentes: IRS Rev. Proc. 2026-35, Notice 2026-66, Rev. Proc. 2026-24 (HSA)
// y hoja de COLA 2027 de la SSA. Se fija la fecha en 2027: el año vigente
// sale del calendario y en 2026 la app sigue con las cifras 2026.
import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2027-03-01T12:00:00")); });

import { US } from "../../src/lib/jurisdictions/US.js";
import { US_TAX_YEAR, US_MAX_TAX_YEAR, usTaxYearFor, US_TAX_BY_YEAR, STANDARD_DEDUCTION, FEDERAL_BRACKETS, LTCG_BREAKPOINTS, US_LIMITS } from "../../src/lib/jurisdictions/usStateTax.js";

describe("EE. UU. año fiscal 2027", () => {
  it("entra el 1 de enero, no antes", () => {
    expect(US_TAX_YEAR).toBe(2027);
    expect(US_MAX_TAX_YEAR).toBe(2027);
    expect(usTaxYearFor(new Date("2026-12-31T12:00:00"))).toBe(2026);
    expect(usTaxYearFor(new Date("2027-01-01T12:00:00"))).toBe(2027);
    expect(usTaxYearFor(new Date("2029-05-01T12:00:00"))).toBe(2027); // no inventa años
  });
  it("deducción estándar (Rev. Proc. 2026-35 § 3.15)", () => {
    expect(STANDARD_DEDUCTION).toEqual({ single: 16600, married_jointly: 33200, married_separately: 16600, head_of_household: 24925 });
  });
  it("tramos (§ 3.01)", () => {
    expect(FEDERAL_BRACKETS.single.map((b) => b.max).slice(0, 6)).toEqual([12800, 52025, 109125, 208325, 264550, 661375]);
    expect(FEDERAL_BRACKETS.married_jointly.map((b) => b.max).slice(0, 6)).toEqual([25600, 104050, 218250, 416650, 529100, 793650]);
    expect(FEDERAL_BRACKETS.married_separately.map((b) => b.max).slice(0, 6)).toEqual([12800, 52025, 109125, 208325, 264550, 396825]);
    expect(FEDERAL_BRACKETS.head_of_household.map((b) => b.max).slice(0, 6)).toEqual([18250, 69650, 109100, 208300, 264550, 661350]);
    expect(FEDERAL_BRACKETS.single.at(-1)).toEqual({ max: Infinity, rate: 0.37 });
  });
  it("impuesto federal soltero sobre $100.000 brutos", () => {
    // 83.400 gravables: 1.280 + 4.707 + 6.902,50 = 12.889,50
    const r = US.calculateIncomeTax(100000);
    expect(r.taxableIncome).toBe(83400);
    expect(Math.round(r.tax)).toBe(Math.round(1280 + (52025 - 12800) * 0.12 + (83400 - 52025) * 0.22));
    expect(r.marginalRate).toBe(0.22);
  });
  it("ganancia de largo plazo (§ 3.03)", () => {
    expect(LTCG_BREAKPOINTS.single).toEqual({ cero: 51050, quince: 563200 });
    expect(LTCG_BREAKPOINTS.married_jointly).toEqual({ cero: 102100, quince: 633600 });
  });
  it("retiro, HSA y Seguro Social", () => {
    expect(US_LIMITS.k401).toBe(25500);
    expect(US_LIMITS.k401CatchUp50).toBe(8500);
    expect(US_LIMITS.k401CatchUp6063).toBe(11750);
    expect(US_LIMITS.k401Total).toBe(75000);
    expect(US_LIMITS.ira).toBe(7500);
    expect(US_LIMITS.rothPhaseOutSingle).toEqual([158000, 173000]);
    expect(US_LIMITS.hsaSelf).toBe(4500);
    expect(US_LIMITS.hsaFamily).toBe(9000);
    expect(US_LIMITS.ssWageBase).toBe(192300);
    expect(US_LIMITS.ssBendPoints).toEqual([1340, 8077]);
    expect(US_LIMITS.estateExemption).toBe(15480000);
    expect(US.calculateRetirementContribution(250000).breakdown.socialSecurity).toBe(Math.round(192300 * 0.062));
  });
  it("2026 sigue intacto en la tabla", () => {
    expect(US_TAX_BY_YEAR[2026].standard.single).toBe(16100);
    expect(US_TAX_BY_YEAR[2026].limits.k401).toBe(24500);
  });
});
