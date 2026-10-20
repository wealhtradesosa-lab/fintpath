import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fmtAniosEs, fmtVolatilidadEs } from "../../src/lib/formato.js";

describe("smoke 2026-10-19: decimales es-CO", () => {
  it("años con coma decimal", () => {
    expect(fmtAniosEs(37.94)).toBe("37,9");
    expect(fmtAniosEs(13)).toBe("13,0");
  });
  it("volatilidad: razón → %, sin explotar cuando el promedio ≈ 0", () => {
    expect(fmtVolatilidadEs(0.25)).toBe("25%");
    expect(fmtVolatilidadEs(1)).toBe("100%");
    expect(fmtVolatilidadEs(12.47)).toBe(">100%");
    expect(fmtVolatilidadEs(-0.1)).toBe("10%");
  });
  it("App.jsx sin cifras con punto decimal reportadas por QA", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    expect(app).not.toContain("62.5× gastos");
    expect(app).toContain("62,5× gastos");
    expect(app).not.toMatch(/Math\.round\(aF?\*10\)\/10/);
    expect(app).not.toContain("(mesesLibre / 12).toFixed(1)");
  });
  it("send-email no loguea el objeto de Resend completo", () => {
    const src = readFileSync("netlify/functions/send-email.cjs", "utf8");
    expect(src).not.toMatch(/console\.(log|error)\([^\n]*,\s*data\);/);
  });
});
