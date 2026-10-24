import { describe, it, expect } from "vitest";
import { parseNumber, esCampoTasa } from "../../src/components/NumberInput.jsx";

describe("NumberInput: montos sin decimales (punto = miles es-CO) y tasas con decimales", () => {
  const monto = (s) => parseNumber(s, { allowDecimals: false });
  it("montos", () => {
    expect(monto("6.500.000.000")).toBe(6500000000);
    expect(monto("6500000000")).toBe(6500000000);
    expect(monto("1.500")).toBe(1500);
    expect(monto("6.5")).toBe(65); // el punto nunca es decimal en un monto
    expect(monto("6.50")).toBe(650); // estado intermedio al teclear 6.500.000.000
    expect(monto("1.500,50")).toBe(1501); // sin decimales: se redondea
    expect(monto("500M")).toBe(500e6);
  });
  it("con decimales permitidos", () => {
    expect(parseNumber("1.500,50")).toBe(1500.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("6.500.000.000")).toBe(6500000000);
  });
  it("tasas", () => {
    expect(parseNumber("7,5")).toBe(7.5);
    expect(parseNumber("7.5")).toBe(7.5);
    expect(parseNumber("6.5")).toBe(6.5);
    expect(parseNumber("14")).toBe(14);
  });
  it("clasifica campos por etiqueta", () => {
    expect(esCampoTasa("Tasa E.A. (%)")).toBe(true);
    expect(esCampoTasa("Valor actual")).toBe(false);
  });
});
