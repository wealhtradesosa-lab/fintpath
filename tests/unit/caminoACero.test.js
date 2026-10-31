import { describe, it, expect } from "vitest";
import { simularPlanACero } from "../../src/lib/planDeudas.js";
import { fechaEnMeses } from "../../src/components/CaminoACero.jsx";

describe("camino a cero", () => {
  const d = [{ id: "a", nombre: "A", saldoCOP: 1200, cuotaCOP: 100, rMes: 0, tasaEA: 0 }];
  it("serie e intereses", () => {
    const s = simularPlanACero(d, 0);
    expect(s.meses).toBe(12);
    expect(s.serie).toHaveLength(13);
    expect(s.serie[0]).toBe(1200);
    expect(s.serie[12]).toBe(0);
    expect(s.interesTotal).toBe(0);
  });
  it("abono extra acorta y ahorra intereses", () => {
    const c = [{ ...d[0], rMes: 0.01, tasaEA: 12.68 }];
    const a = simularPlanACero(c, 0), b = simularPlanACero(c, 100);
    expect(b.meses).toBeLessThan(a.meses);
    expect(b.interesTotal).toBeLessThan(a.interesTotal);
  });
  it("fecha legible", () => {
    expect(fechaEnMeses(6, new Date(2026, 9, 31))).toBe("abril de 2027");
  });
});
