import { describe, it, expect } from "vitest";
import { esEstimado, tieneEstimados, pasosAfinar } from "../../src/lib/afinaNumero.js";

describe("afina tu número", () => {
  const u0 = {
    inv: [{ n: "Lo que tengo (estimado)", va: 1 }],
    ingresos: [{ nombre: "Mi ingreso mensual", mensual: 1 }],
    gas: { Personal: [{ c: "Mis gastos y cuotas del mes", m: 1 }] },
    deu: [{ n: "Mis deudas", mt: 1 }],
  };
  it("reconoce las filas del primer minuto (con y sin marca)", () => {
    expect(esEstimado({ n: "Casa", estimado: true })).toBe(true);
    expect(esEstimado(u0.inv[0])).toBe(true);
    expect(esEstimado({ n: "Apartamento Laureles" })).toBe(false);
    expect(tieneEstimados(u0)).toBe(true);
  });
  it("nada está hecho con solo estimados", () => {
    expect(pasosAfinar(u0).map((p) => p.hecho)).toEqual([false, false, false]);
  });
  it("un activo real marca el paso; ingresos y gastos van juntos; sin deudas es opcional", () => {
    const u = { ...u0, inv: [...u0.inv, { n: "Apto" }], ingresos: [{ nombre: "Salario" }], deu: [] };
    const p = pasosAfinar(u);
    expect(p[0].hecho).toBe(true);
    expect(p[1].hecho).toBe(false); // falta un gasto real
    expect(p[1].ir).toBe("gas");
    expect(p[2].hecho).toBe(true);
    expect(p[2].opcional).toBe(true);
  });
});

import { futuroEstimado, extraRedondo } from "../../src/lib/afinaNumero.js";
describe("futuroEstimado", () => {
  it("capitaliza patrimonio y aportes", () => {
    const v = futuroEstimado({ nw: 100, cfMes: 0, anos: 10, r: 0.07 });
    expect(v).toBeCloseTo(100 * Math.pow(1.07, 10), 6);
    expect(futuroEstimado({ nw: 0, cfMes: 1, extraMes: 1 })).toBeGreaterThan(futuroEstimado({ nw: 0, cfMes: 1 }));
    expect(futuroEstimado({ nw: 0, cfMes: -5 })).toBe(0);
  });
  it("extra redondo", () => {
    expect(extraRedondo(9000000)).toBe(900000);
    expect(extraRedondo(0)).toBe(100000);
  });
});
