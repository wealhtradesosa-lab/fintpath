import { describe, it, expect } from "vitest";
import { AVISO_CALCULADORA } from "../../src/lib/exportarCalculadoraPDF.js";

describe("exportar calculadora a PDF", () => {
  it("el aviso dice que es informativo y no es asesoría, sin «recomendar»", () => {
    expect(AVISO_CALCULADORA).toMatch(/informativo/);
    expect(AVISO_CALCULADORA).toMatch(/No es asesoría financiera/);
    expect(AVISO_CALCULADORA).toMatch(/revisión de un experto/);
    expect(AVISO_CALCULADORA).not.toMatch(/recomend/i);
  });
});
