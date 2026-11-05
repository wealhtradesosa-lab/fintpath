import { describe, it, expect } from "vitest";
import { tipoIngreso } from "../../src/lib/metrics.js";

describe("la persona decide si un ingreso cuenta en su nivel (5-nov-2026)", () => {
  it("un honorario recurrente marcado como renta cuenta; sin marca, no", () => {
    const fee = { nombre: "FEE DISTRIBUIDORES", categoria: "Honorarios", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS" };
    expect(tipoIngreso(fee)).toBe("activo");
    expect(tipoIngreso({ ...fee, rentaPasiva: true })).toBe("pasivo");
  });
  it("un arriendo marcado como trabajo deja de contar", () => {
    expect(tipoIngreso({ categoria: "Arriendo", rentaPasiva: false })).toBe("activo");
  });
  it("el salario sigue sin contar por defecto", () => {
    expect(tipoIngreso({ categoria: "Salario", fiscalCode: "LAB_SALARIO" })).toBe("activo");
  });
});
