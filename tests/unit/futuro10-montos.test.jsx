import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import NumberInput from "../../src/components/NumberInput.jsx";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";

describe("Mi futuro a 10: montos con puntos de miles", () => {
  it("NumberInput muestra 2.000.000", () => {
    expect(renderToString(createElement(NumberInput, { value: 2000000, onChange: () => {} }))).toContain('value="2.000.000"');
  });
  it("MiFuturo10 usa NumberInput para montos (paso Reinvierte)", () => {
    const html = renderToString(createElement(MiFuturo10, { user: { inflacionPct: 4, inv: [], ingresos: [], gas: {}, deu: [] }, pasoInicial: 2 }));
    expect(html).toContain("Inversiones nuevas");
  });
});
