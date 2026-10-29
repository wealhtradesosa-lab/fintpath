import { describe, it, expect } from "vitest";
import { pagosDeclaracion } from "../../src/lib/impuestoReferente.js";

describe("pagosDeclaracion: renta del año anterior de una vez", () => {
  const owners = [{ name: "Santiago", type: "natural", mesDeclaracion: 8 }, { name: "Lagoon SAS", type: "juridica" }, { name: "Hija", type: "natural" }];
  const cal = { Santiago: { totalAlDeclarar: 30e6, saldo: 20e6, anticipoSiguiente: 10e6, anoDeclaracion: 2026 }, "Lagoon SAS": { totalAlDeclarar: 50e6, anoDeclaracion: 2026 } };
  const respaldo = [{ name: "Hija", impBruto: 5e6, reteN: 1e6 }];
  const p = pagosDeclaracion(owners, cal, respaldo, 2026);
  it("persona natural: todo en su mes", () => {
    expect(p.porMes[7]).toBe(30e6 + 0);
    const s = p.titulares.find((t) => t.name === "Santiago");
    expect(s.fuente).toBe("calculadora"); expect(s.anticipo).toBe(10e6);
  });
  it("sociedad: dos cuotas mayo y julio", () => {
    expect(p.porMes[4]).toBe(25e6); expect(p.porMes[6]).toBe(25e6);
  });
  it("sin declaración: motor, en septiembre", () => {
    expect(p.porMes[8]).toBe(4e6);
    expect(p.titulares.find((t) => t.name === "Hija").fuente).toBe("motor");
  });
  it("total = suma de meses", () => { expect(p.total).toBe(84e6); });
});
