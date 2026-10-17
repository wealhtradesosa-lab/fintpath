import { describe, it, expect } from "vitest";
import { FACTORES_ESCENARIO, gastosEscenario } from "../../src/lib/escenarios.js";

describe("Conservador: gastos +10%", () => {
  const gastos = {
    "Seguridad Social": [{ m: 272000 }],
    Alimentación: [{ m: 1100000 }, { m: 750000 }],
    Vida: [{ m: 500000, sim: false }],
  };
  const nv = gastosEscenario(gastos, FACTORES_ESCENARIO.conservador.g);
  it("sube 10% los gastos de vida", () => {
    expect(nv["gf_Alimentación_0"]).toBe(1210000);
    expect(nv["gf_Alimentación_1"]).toBe(825000);
  });
  it("Seguridad Social queda fija y los gastos apagados no se tocan", () => {
    expect("gf_Seguridad Social_0" in nv).toBe(false);
    expect("gf_Vida_0" in nv).toBe(false);
  });
});
