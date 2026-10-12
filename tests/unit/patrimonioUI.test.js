// Bugs de UI de Patrimonio/Egresos que encontró QA (11-oct-2026).
import { describe, it, expect } from "vitest";
import { valorOpcion, etiquetaOpcion, gastosDelUsuario, columnasPortafolio } from "../../src/lib/patrimonioUI.js";

describe("opciones de <select> (Egresos: '[object Object]')", () => {
  const opciones = [{ v: "", l: "— Sin asignar (no calcula impuesto)" }, { v: "own_1", l: "👤 Personal" }, "Real Estate"];
  it("la opción con valor vacío no devuelve el objeto", () => {
    expect(valorOpcion(opciones[0])).toBe("");
    expect(etiquetaOpcion(opciones[0])).toBe("— Sin asignar (no calcula impuesto)");
    expect(opciones.map(valorOpcion).some((v) => String(v) === "[object Object]")).toBe(false);
    expect(opciones.map(etiquetaOpcion).some((v) => String(v) === "[object Object]")).toBe(false);
  });
  it("las opciones de texto siguen igual", () => {
    expect(valorOpcion("Real Estate")).toBe("Real Estate");
    expect(etiquetaOpcion("Real Estate")).toBe("Real Estate");
    expect(valorOpcion({ v: "own_1", l: "x" })).toBe("own_1");
    expect(etiquetaOpcion({ v: "COP" })).toBe("COP");
  });
});

describe("gastos vinculados a activos (InversionesModule leía user.gastos)", () => {
  it("lee u.gas, que es donde viven los datos", () => {
    const gas = { Vivienda: [{ m: 100, activoId: "a1" }] };
    expect(gastosDelUsuario({ gas })).toBe(gas);
    expect(gastosDelUsuario({ gastos: gas })).toBe(gas);
    expect(gastosDelUsuario({ gas, gastos: { otro: [] } })).toBe(gas);
    expect(gastosDelUsuario(null)).toEqual({});
  });
});

describe("tabla del portafolio en el móvil", () => {
  it("en angosto quedan Inversión, Valor, Deuda y acciones", () => {
    expect(columnasPortafolio(true)).toEqual(["Inversión", "Valor", "Deuda", ""]);
    expect(columnasPortafolio(false)).toEqual(["Inversión", "Tipo", "Valor", "Ganancia", "Deuda", "On/Off", ""]);
  });
});
