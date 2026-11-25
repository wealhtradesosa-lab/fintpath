import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// 24-nov-2026 (Santiago: captura de 2027 con «Te pasaste $1» y el punto rojo). Un peso de diferencia sale del redondeo al pasar
// los montos a pesos de hoy y de vuelta: no es pasarse. El botón «Usar lo que queda» redondea hacia abajo.
const src = readFileSync("src/components/MiFuturo10.jsx", "utf8");
describe("un peso de redondeo no es pasarse", () => {
  it("«Usar lo que queda» redondea hacia abajo", () => {
    expect(src).toMatch(/on\(Math\.floor\(disponible\)\)/);
    expect(src).not.toMatch(/on\(Math\.round\(disponible\)\)/);
  });
  it("pasarse es más de un peso, en todas partes", () => {
    expect(src).not.toMatch(/porInvertir < -0\.5/);
    expect(src).not.toMatch(/porInvertir \|\| 0\) < -0\.5/);
    expect(src).toMatch(/const estadoAnio = \(y, cfg\) => \(y\.porInvertir < -1 /);
  });
});
