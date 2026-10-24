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

import { textoFaltanteNueva } from "../../src/components/MiFuturo10.jsx";
describe("Finanzas #56: alerta de faltante con monto invertido y renta de la parte fondeada", () => {
  const u = { inflacionPct: 5, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 200e6 }], ingresos: [{ nombre: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "x", m: 8e6 }] }, deu: [] };
  it("faltan + invertido = monto; renta fondeada = invertido × 14% / 12 = la que entra al flujo", () => {
    const btg = { preset: "custom", nombre: "BTG", monto: 6.5e9, rendimientoNomPct: 14, anio: 1, tipo: "renta", moneda: "COP" };
    const sin = proyectarFuturo10(u, {}), r = proyectarFuturo10(u, { nuevas: [btg] });
    const d = r.nuevasDetalle[0];
    expect(d.faltante).toBeGreaterThan(0);
    expect(d.faltante + d.invertido).toBeCloseTo(6.5e9, 0);
    expect(Math.abs(d.rentaMensualFondeada - d.invertido * 0.14 / 12)).toBeLessThan(100); // <100 pesos sobre millones (punto fijo)
    expect((r.filas[1].rentaNueva - sin.filas[1].rentaNueva) / 12).toBeCloseTo(d.rentaMensualFondeada, -1);
    const t = textoFaltanteNueva(d);
    expect(t).toMatch(/^Faltan \$[\d.]+ para BTG\. Quedaron invertidos \$[\d.]+; esa parte renta \$[\d.]+\/mes\.$/);
  });
});
