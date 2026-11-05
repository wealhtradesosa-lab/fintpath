import { describe, it, expect } from "vitest";
import { conSlider } from "../../src/components/SimuladorAvanzado.jsx";
import { getMonto, montoDelMes } from "../../src/lib/flowHelpers.js";

describe("los sliders del simulador sí mueven el motor (5-nov-2026)", () => {
  it("renta en modo tasa: el motor recalculaba capital × tasa e ignoraba el slider", () => {
    const cdt = { nombre: "CDT", montoModo: "tasa", capital: 1_000_000_000, tasa: 1, mensual: 5_000_000, frecuencia: "mensual" };
    expect(getMonto({ ...cdt, mensual: 2_000_000 })).toBe(10_000_000); // la fuga
    expect(getMonto(conSlider(cdt, 2_000_000, getMonto(cdt)))).toBe(2_000_000);
    expect(getMonto(conSlider(cdt, 10_000_000, getMonto(cdt)))).toBe(10_000_000); // sin tocar, igual al real
  });
  it("gasto con `mensual` y `m`: el slider sobre `m` no se veía", () => {
    const g = { c: "Colegio", m: 3_000_000, mensual: 3_000_000 };
    expect(getMonto({ ...g, m: 1_000_000 })).toBe(3_000_000); // la fuga
    expect(getMonto(conSlider(g, 1_000_000, getMonto(g)))).toBe(1_000_000);
  });
  it("variable: se escala mes a mes en la misma proporción", () => {
    const g = { c: "Viajes", frecuencia: "variable", montosMensuales: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4_000_000, 0] };
    expect(montoDelMes(conSlider(g, 2_000_000, 4_000_000), 2026, 11)).toBe(2_000_000);
  });
});
