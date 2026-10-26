// La IA no debe recibir gastos en dólares convertidos a una tasa inventada.
// Hasta oct-2026 bloqueGastosDetalle multiplicaba por 4200 fijo y, a diferencia
// de los otros sitios del repo, ni siquiera miraba user.trm.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bloqueGastosDetalle, contextoCompleto } from "../../src/lib/contextoAsesor.js";

const gas = {
  Vivienda: [{ c: "Arriendo", mensual: 5_000_000, frecuencia: "mensual" }],
  Suscripciones: [{ c: "AWS", mensual: 100, moneda: "USD", frecuencia: "mensual" }],
};

describe("contexto del asesor: gastos en dólares", () => {
  it("con tasa real convierte con esa tasa, no con 4200", () => {
    const ctx = bloqueGastosDetalle(gas, 25, 3950);
    expect(ctx).toContain("$395.000/mes");
    expect(ctx).not.toContain("$420.000");
    expect(ctx).not.toContain("sin tasa del día");
  });

  it("sin tasa informa en dólares y lo avisa, en vez de inventar la conversión", () => {
    const ctx = bloqueGastosDetalle(gas, 25, null);
    expect(ctx).toContain("US$100/mes");
    expect(ctx).toContain("1 en dólares sin tasa del día");
    expect(ctx).not.toContain("$420.000");
    // El gasto en pesos sigue en pesos.
    expect(ctx).toContain("$5.000.000/mes");
  });

  it("no queda ningún 4200 en el módulo", () => {
    const src = readFileSync(new URL("../../src/lib/contextoAsesor.js", import.meta.url), "utf8");
    const enCodigo = src.split("\n").filter((l) => l.includes("4200") && !l.trim().startsWith("//"));
    expect(enCodigo).toEqual([]);
  });

  it("contextoCompleto le pasa la tasa del usuario", () => {
    const conTasa = contextoCompleto({ gas, trm: 3950 });
    expect(conTasa).toContain("$395.000/mes");
    const sinTasa = contextoCompleto({ gas });
    expect(sinTasa).toContain("US$100/mes");
  });
});
