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

import { fechaPersonaNatural, mesesDePago } from "../../src/lib/impuestoReferente.js";
describe("fecha de pago por NIT (calendario DIAN personas naturales)", () => {
  it("dos últimos dígitos, sin dígito de verificación", () => {
    expect(fechaPersonaNatural("71.234.501-3")).toEqual({ mes: 8, dia: 12 });
    expect(fechaPersonaNatural("98765400")).toEqual({ mes: 10, dia: 26 });
    expect(fechaPersonaNatural("1036")).toEqual({ mes: 9, dia: 7 });
  });
  it("el NIT de la declaración fija el mes; el mes manual manda", () => {
    expect(mesesDePago({ type: "natural", declaraciones: [{ nit: "800" }] })[0]).toMatchObject({ mes: 10, dia: 26, auto: true });
    expect(mesesDePago({ type: "natural", mesDeclaracion: 8, declaraciones: [{ nit: "800" }] })[0].mes).toBe(8);
    expect(mesesDePago({ type: "natural" })[0].mes).toBe(9);
  });
});

import { saldoDeclarado } from "../../src/lib/rentaDesdeDeclaracion.js";
import { calibracionReferente } from "../../src/lib/impuestoReferente.js";
describe("saldo a favor leído sin signo (F-110)", () => {
  const d = { tipo: "F110", anoGravable: 2025, renglones: { ingresosBrutos: 600e6, rentaLiquidaGravable: 3e5, impuestoCalculado: 1e5, impuestoNeto: 1e5, autorretencion: 172e6, saldoPagar: 171e6 } };
  it("no puede pagar más que impuesto + anticipo: era saldo a favor", () => {
    expect(saldoDeclarado(d)).toMatchObject({ valor: -171e6, ajustado: true });
  });
  it("saldo normal se respeta", () => {
    expect(saldoDeclarado({ renglones: { impuestoCalculado: 80e6, retefuente: 50e6, saldoPagar: 30e6 } }).valor).toBe(30e6);
  });
  it("el simulador del año no cobra los 171 MM", () => {
    const o = { id: "o2", name: "Lagoon", type: "juridica", declaraciones: [d] };
    const c = calibracionReferente({ owners: [o] }, { modo: "actual", hoy: new Date(2026, 9, 29) }).Lagoon;
    expect(c.totalAlDeclarar).toBe(0); expect(c.saldoAjustado).toBe(true);
  });
});
