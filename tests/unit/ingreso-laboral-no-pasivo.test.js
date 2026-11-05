import { describe, it, expect } from "vitest";
import { tipoIngreso, grupoIngreso } from "../../src/lib/metrics.js";
import { estimarImpuesto } from "../../src/lib/taxCO.js";

describe("tipoIngreso: solo el salario de empleado queda fuera del nivel (5-nov-2026)", () => {
  it("prima, bono, salario y cesantías, aun vinculados a un activo, no suman", () => {
    for (const categoria of ["Prima", "Bono", "Salario", "Cesantías", "Bonificación", "Intereses cesantías"])
      expect(tipoIngreso({ categoria, activoId: "a1" })).toBe("activo");
    for (const fiscalCode of ["LAB_SALARIO", "LAB_PRESTACIONES_PRIMA", "LAB_PRESTACIONES_CESANTIAS"])
      expect(tipoIngreso({ fiscalCode, activoId: "a1" })).toBe("activo");
  });
  it("honorarios, comisiones, negocio y «otro» se preguntan: sin respuesta no suman; con «sí», suman", () => {
    for (const x of [{ categoria: "Honorarios", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS" }, { fiscalCode: "NOL_HONORARIOS_INDEP" }, { categoria: "Negocio" }, { categoria: "Otro" }]) {
      expect(grupoIngreso(x)).toBe("pregunta");
      expect(tipoIngreso(x)).toBe("activo");
      expect(tipoIngreso({ ...x, rentaPasiva: true })).toBe("pasivo");
    }
  });
  it("salario es trabajo y lo de una sola vez es «unica»", () => {
    expect(grupoIngreso({ categoria: "Salario", fiscalCode: "LAB_SALARIO" })).toBe("trabajo");
    expect(grupoIngreso({ fiscalCode: "CAP_VENTA_ACTIVOS" })).toBe("unica");
    expect(grupoIngreso({ categoria: "Arriendo" })).toBe("renta");
  });
  it("lo de una sola vez no suma", () => {
    expect(tipoIngreso({ fiscalCode: "CAP_VENTA_ACTIVOS" })).toBe("activo");
    expect(tipoIngreso({ fiscalCode: "GO_HERENCIA" })).toBe("activo");
  });
  it("un código CAP_/DIV_ no gana sobre una categoría laboral", () => {
    expect(tipoIngreso({ categoria: "Prima", fiscalCode: "CAP_RENDIMIENTO_GENERICO" })).toBe("activo");
    expect(tipoIngreso({ categoria: "Salario", fiscalCode: "DIV_ART49_GRAVADOS", activoId: "a1" })).toBe("activo");
  });
  it("lo que sí es renta de activos sigue pasivo", () => {
    expect(tipoIngreso({ categoria: "Arriendo", activoId: "a1" })).toBe("pasivo");
    expect(tipoIngreso({ fiscalCode: "CAP_FIC" })).toBe("pasivo");
    expect(tipoIngreso({ categoria: "Otro", activoId: "a1" })).toBe("pasivo");
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
