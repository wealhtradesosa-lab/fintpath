import { describe, it, expect } from "vitest";
import { labelVigenciaBadge } from "../../src/lib/flowHelpers.js";

describe("badge de ingresos: mes supuesto no se afirma", () => {
  it("prima con mesSupuesto no muestra «Dic»", () => {
    const b = labelVigenciaBadge({ categoria: "Prima/Bono", frecuencia: "anual", mesPago: 12, mesSupuesto: true, mensual: 12000000 });
    expect(b.label).toBe("Anual");
    expect(b.sub).toBeNull();
  });
  it("prima con mes real guardado conserva el mes", () => {
    const b = labelVigenciaBadge({ categoria: "Prima/Bono", frecuencia: "anual", mesPago: 12, mensual: 12000000 });
    expect(b.sub).toBe("Dic");
    const j = labelVigenciaBadge({ categoria: "Prima/Bono", frecuencia: "anual", mesPago: 6, mesSupuesto: false, mensual: 1 });
    expect(j.sub).toBe("Jun");
  });
});
