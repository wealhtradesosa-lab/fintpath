import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
// Finanzas 24-oct-2026: detalle nominal («pesos del año N»); totales en pesos de hoy: año t ÷ 1,05^(t−1).
describe("Renta de inversión nueva: totales en pesos de hoy", () => {
  const u = { inflacionPct: 5, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 5e9 }], ingresos: [{ nombre: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "x", m: 8e6 }] }, deu: [] };
  const inv = { preset: "custom", nombre: "CDT año 3", monto: 100e6, rendimientoNomPct: 12, anio: 3, tipo: "renta", moneda: "COP" };
  it("año 3 entra a los totales ÷ 1,1025; el detalle queda nominal", () => {
    const sin = proyectarFuturo10(u, {}), r = proyectarFuturo10(u, { nuevas: [inv] });
    const d = r.nuevasDetalle[0];
    expect(d.faltante).toBe(0);
    expect(d.rentaMensual).toBeCloseTo(1e6, 0); // 100M × 12% / 12, pesos del año 3
    expect(r.filas[3].factorFlujo).toBeCloseTo(1.1025, 10);
    expect(r.filas[3].rentaNueva - sin.filas[3].rentaNueva).toBeCloseTo(12e6, 0); // nominal año 3
    expect(r.filas[3].ingresosReal - sin.filas[3].ingresosReal).toBeCloseTo(12e6 / 1.1025, 0);
    expect(r.filas[3].rentaPasivaReal - sin.filas[3].rentaPasivaReal).toBeCloseTo(12e6 / 1.1025, 0);
    expect(r.filas[4].ingresosReal - sin.filas[4].ingresosReal).toBeCloseTo(12e6 / 1.05 ** 3, 0);
    expect(r.filas[2].rentaNueva - sin.filas[2].rentaNueva).toBe(0);
  });
});
