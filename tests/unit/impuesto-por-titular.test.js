import { describe, it, expect } from "vitest";
import { saldoImpuestoAnual, saldoImpuestoDelMes } from "../../src/lib/impuestoReferente.js";

// 14-nov-2026: la retención de un titular no paga el impuesto de otro.
describe("saldoImpuestoAnual", () => {
  const detalle = [
    { name: "Persona", type: "natural", impBruto: 100_000_000, reteN: 162_000_000 }, // saldo a favor
    { name: "Sociedad", type: "juridica", impBruto: 62_400_000, reteN: 0 },
  ];
  it("suma el saldo de cada titular, sin compensar entre titulares", () => {
    expect(saldoImpuestoAnual(detalle)).toBe(62_400_000);
  });
  it("cuadra con la suma de los 12 meses de pago", () => {
    const owners = [{ name: "Persona", type: "natural" }, { name: "Sociedad", type: "juridica" }];
    let t = 0; for (let m = 1; m <= 12; m++) t += saldoImpuestoDelMes(detalle, owners, m);
    expect(Math.round(t)).toBe(62_400_000);
  });
  it("sin detalle da 0", () => { expect(saldoImpuestoAnual(undefined)).toBe(0); });
});
