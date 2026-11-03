import { describe, it, expect } from "vitest";
import { simularPlanACero } from "../../src/lib/planDeudas.js";
import { fechaEnMeses, mesQueDejaDeBajar, mesesAGraficar, deudasQueNoTerminan } from "../../src/components/CaminoACero.jsx";

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
  it("una deuda sin cuota no estira la gráfica 50 años y se nombra", () => {
    const deudas = [
      { id: "a", nombre: "Tarjeta", saldoCOP: 1200, cuotaCOP: 100, rMes: 0, tasaEA: 0 },
      { id: "b", nombre: "Saldo pendiente", saldoCOP: 500, cuotaCOP: 0, rMes: 0, tasaEA: 0 },
    ];
    const base = simularPlanACero(deudas, 0), sim = simularPlanACero(deudas, 100);
    expect(base.converge).toBe(false);
    expect(mesQueDejaDeBajar(base.serie)).toBe(12);
    expect(sim.converge).toBe(true);
    const n = mesesAGraficar({ base, sim, conExtra: true });
    expect(n).toBe(Math.max(12, sim.meses) + 13);
    expect(n).toBeLessThan(60);
    const q = deudasQueNoTerminan(base);
    expect(q).toHaveLength(1);
    expect(q[0].nombre).toBe("Saldo pendiente");
    expect(q[0].motivo).toBe("no tiene cuota mensual");
  });
  it("cuota que no cubre intereses se explica", () => {
    const base = simularPlanACero([{ id: "c", nombre: "Crédito", saldoCOP: 10000, cuotaCOP: 50, rMes: 0.01, tasaEA: 12.68, noAmortiza: true }], 0);
    const q = deudasQueNoTerminan(base);
    expect(q[0].motivo).toBe("su cuota no alcanza ni para los intereses");
    expect(q[0].interes).toBe(100);
  });
});
