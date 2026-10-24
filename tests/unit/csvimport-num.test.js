import { describe, it, expect } from "vitest";
import { numCelda } from "../../src/components/CsvImport.jsx";
describe("import Excel/CSV: números es-CO", () => {
  it("texto es-CO", () => {
    expect(numCelda("6.500.000")).toBe(6500000);
    expect(numCelda("1.500,50")).toBe(1500.5);
    expect(numCelda("$ 6.500.000.000")).toBe(6500000000);
    expect(numCelda("12,5")).toBe(12.5);
  });
  it("celdas numéricas quedan igual", () => {
    expect(numCelda(6500000)).toBe(6500000);
    expect(numCelda(1500.5)).toBe(1500.5);
    expect(numCelda(0.25)).toBe(0.25);
  });
  it("vacío o basura → 0", () => { expect(numCelda("")).toBe(0); expect(numCelda(null)).toBe(0); expect(numCelda("n/a")).toBe(0); });
});
