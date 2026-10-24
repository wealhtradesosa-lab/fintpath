import { describe, it, expect } from "vitest";
import { tipoIngreso } from "../../src/lib/metrics.js";
import { estimarImpuesto } from "../../src/lib/taxCO.js";

describe("tipoIngreso: lo laboral nunca es pasivo", () => {
  it("prima, bono, salario, cesantías y honorarios vinculados a un activo siguen activos", () => {
    for (const categoria of ["Prima", "Bono", "Salario", "Cesantías", "Honorarios", "Bonificación", "Intereses cesantías"])
      expect(tipoIngreso({ categoria, activoId: "a1" })).toBe("activo");
    for (const fiscalCode of ["LAB_SALARIO", "LAB_PRESTACIONES_PRIMA", "LAB_PRESTACIONES_CESANTIAS", "NOL_HONORARIOS_INDEP"])
      expect(tipoIngreso({ fiscalCode, activoId: "a1" })).toBe("activo");
  });
  it("un código CAP_/DIV_ no gana sobre una categoría laboral", () => {
    expect(tipoIngreso({ categoria: "Prima", fiscalCode: "CAP_RENDIMIENTO_GENERICO" })).toBe("activo");
    expect(tipoIngreso({ categoria: "Salario", fiscalCode: "DIV_ART49_GRAVADOS", activoId: "a1" })).toBe("activo");
  });
  it("lo que sí es renta de activos sigue pasivo", () => {
    expect(tipoIngreso({ categoria: "Arriendo", activoId: "a1" })).toBe("pasivo");
    expect(tipoIngreso({ fiscalCode: "CAP_FIC" })).toBe("pasivo");
    expect(tipoIngreso({ categoria: "Otro", activoId: "a1" })).toBe("pasivo");
    expect(tipoIngreso({ categoria: "Otro" })).toBe("activo");
  });
});

describe("taxCO: una prima vinculada a un activo sigue siendo renta laboral", () => {
  const user = (extra) => ({ trm: 4200, owners: [{ id: "o1", name: "Luis", type: "natural" }], gas: {}, deu: [], inv: [],
    ingresos: [
      { id: "sal", owner: "o1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO", mensual: 10e6, tipo: "fijo" },
      { id: "pri", owner: "o1", nombre: "Prima", categoria: "Prima", fiscalCode: "LAB_PRESTACIONES_PRIMA", mensual: 1e6, tipo: "fijo", ...extra },
    ] });
  const det = (u) => estimarImpuesto(u, { ag: 2025 }).detalle.find((d) => d.name === "Luis");
  it("misma exenta 25 % (Art. 206-10) e impuesto con o sin activoId", () => {
    const sin = det(user({}));
    const con = det(user({ activoId: "a1" }));
    expect(con.exenta25).toBeGreaterThan(0);
    expect(con.exenta25).toBeCloseTo(sin.exenta25, 0);
    expect(con.impBruto).toBeCloseTo(sin.impBruto, 0);
  });
});
