// Orden Art. 206-10 ET (spec Tributario 24-oct-2026): la base del 25 % se toma
// después de INCRNGO, deducciones, PV/AFC exentas (30 % / 3.800 UVT) y cesantías
// exentas (206-4); todo bajo el tope Art. 336 (40 % / 1.340 UVT).
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { adapterOwnerPlan, ahorroPvAfc } from "../../src/lib/ownerPlanAdapter.js";

const user = (salMes, gas = {}, extra = []) => ({ trm: 4200, owners: [{ id: "o1", name: "Luis", type: "natural" }], gas, deu: [], inv: [],
  ingresos: [{ id: "sal", owner: "o1", nombre: "Salario", fiscalCode: "LAB_SALARIO", mensual: salMes, tipo: "fijo" }, ...extra] });
const aporte = (fc, m) => ({ "Aporte tributario": [{ owner: "o1", fiscalCode: fc, m }] });
const det = (u) => estimarImpuesto(u, { ag: 2025 }).detalle.find((d) => d.name === "Luis");

describe("exenta 25 % después de PV/AFC y cesantías", () => {
  it("mismo caso con y sin AFC: el 25 % baja con AFC", () => {
    const sin = det(user(10e6)), con = det(user(10e6, aporte("AP_TRIB_AFC", 1e6)));
    expect(con.exenta25).toBeLessThan(sin.exenta25);
    expect(sin.exenta25 - con.exenta25).toBeCloseTo(12e6 * 0.25, -3);
  });
  it("pensión voluntaria también baja la base del 25 %", () => {
    expect(det(user(10e6, aporte("AP_TRIB_PV", 1e6))).exenta25).toBeLessThan(det(user(10e6)).exenta25);
  });
  it("cesantías exentas bajan la base del 25 %", () => {
    const ces = [{ id: "c", owner: "o1", nombre: "Cesantías", fiscalCode: "LAB_PRESTACIONES_CESANTIAS", mensual: 4e6, tipo: "anual", frecuencia: "anual" }];
    const d = det(user(4e6, {}, ces));
    expect(d.exenta25).toBeLessThanOrEqual(det(user(4e6)).exenta25 + 4e6 * 0.25);
  });
  it("el cambio nunca sube el 25 % (barrido de casos)", () => {
    for (const s of [3e6, 8e6, 15e6, 30e6, 60e6]) for (const fc of ["AP_TRIB_PV", "AP_TRIB_AFC"]) for (const m of [0, 5e5, 2e6, 8e6]) {
      const base = det(user(s)).exenta25, d = det(user(s, m ? aporte(fc, m) : {}));
      expect(d.exenta25).toBeLessThanOrEqual(base + 1);
      expect(d.exenta25).toBeLessThanOrEqual(790 * 49799 + 1);
    }
  });
  it("tope Art. 336 se mantiene", () => {
    for (const s of [8e6, 30e6]) { const d = det(user(s, aporte("AP_TRIB_AFC", 5e6))); expect(d.benAplic).toBeLessThanOrEqual(Math.min(d.neto * 0.4, 1340 * 49799) + 1); }
  });
  it("ahorro de la sugerencia de PV = diferencia de correr taxCO con y sin el aporte", () => {
    const u0 = user(15e6), d0 = det(u0);
    const pvAnual = d0.pensionVol;
    expect(pvAnual).toBeGreaterThan(0);
    const d1 = det(user(15e6, aporte("AP_TRIB_PV", pvAnual / 12)));
    expect(d0.ahorroOptimo).toBeCloseTo(d0.impuesto - d1.impuesto, -2);
  });
});

describe("tarjeta «Pensión voluntaria o AFC» del simulador", () => {
  it("ahorro de la tarjeta == diferencia de taxCO con y sin el aporte", () => {
    // Mismo año que usa el simulador (default de taxCO). Con y sin aporte se
    // compara el impuesto que muestra la tarjeta (saldo, después de retenciones).
    const detD = (u) => estimarImpuesto(u).detalle.find((d) => d.name === "Luis");
    for (const salMes of [10e6, 15e6, 30e6, 60e6]) {
      const u0 = user(salMes), d0 = detD(u0);
      const fd = adapterOwnerPlan({ owner: u0.owners[0], ingresos: u0.ingresos, gastos: [], inv: [], deu: [], trm: 4200 });
      const d1 = detD(user(salMes, aporte("AP_TRIB_PV", d0.pensionVol / 12)));
      expect(ahorroPvAfc(fd)).toBeCloseTo(d0.impuesto - d1.impuesto, -2);
    }
  });
});
