import { describe, it, expect } from "vitest";
import { fmtNumEs, fmtPctEs, fmtTasaEs, fmtMilesEs, parseDecimalEs } from "../../src/lib/formato.js";

describe("formato es-CO", () => {
  it("fmtPctEs usa coma decimal", () => {
    expect(fmtPctEs(16, 1)).toBe("16,0%");
    expect(fmtPctEs(12.5, 1)).toBe("12,5%");
    expect(fmtPctEs(69.84, 1)).toBe("69,8%");
    expect(fmtPctEs(3.1)).toBe("3,1%");
    expect(fmtPctEs(28, 1)).not.toMatch(/\./);
  });
  it("fmtTasaEs: hasta 2 decimales, sin relleno, coma", () => {
    expect(fmtTasaEs(12.5)).toBe("12,5%");
    expect(fmtTasaEs(16)).toBe("16%");
    expect(fmtTasaEs(2.22)).toBe("2,22%");
    expect(fmtTasaEs("")).toBe("");
    expect(fmtTasaEs(null)).toBe("");
  });
  it("fmtNumEs para abreviaturas M/B", () => {
    expect(fmtNumEs(2.6, 1)).toBe("2,6");
    expect(fmtNumEs(1234.5, 1)).toBe("1.234,5");
  });
  it("fmtMilesEs separa miles con punto", () => {
    expect(fmtMilesEs(638100)).toBe("638.100");
  });
  it("parseDecimalEs acepta coma, punto y % y devuelve número", () => {
    expect(parseDecimalEs("4,5")).toBe(4.5);
    expect(parseDecimalEs("4.5")).toBe(4.5);
    expect(parseDecimalEs("4,5 %")).toBe(4.5);
    expect(parseDecimalEs("4,")).toBe(4);
    expect(parseDecimalEs("")).toBe("");
    expect(parseDecimalEs("abc")).toBe("");
    expect(typeof parseDecimalEs("12,25")).toBe("number");
  });
});
