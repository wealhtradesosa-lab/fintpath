import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { calibracionReferente, aplicarReferente, estimarImpuestoReferente } from "../../src/lib/impuestoReferente.js";
import { estimarDesdeDeclaracion } from "../../src/lib/rentaDesdeDeclaracion.js";

const decl = { tipo: "F210", anoGravable: 2025, renglones: { ingresosBrutos: 300e6, ingresosNoConstitutivos: 8e6, rentaExenta25: 30e6, impuestoCalculado: 40e6, retefuente: 30e6, saldoPagar: 10e6 } };
const base = (mensual = 25e6, conDecl = true) => ({ trm: 4200, gas: {}, deu: [], inv: [],
  owners: [{ id: "o1", name: "Luis", type: "natural", ...(conDecl ? { declaraciones: [decl] } : {}) }],
  ingresos: [{ id: "sal", owner: "o1", nombre: "Honorarios", categoria: "Honorarios", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS", mensual, tipo: "fijo" }] });
const bruto = (est) => est.detalle.reduce((a, d) => a + (d.impBruto ?? d.impuesto ?? 0), 0);

describe("impuesto referente", () => {
  it("sin declaración, es exactamente el motor de siempre", () => {
    const u = base(25e6, false);
    expect(estimarImpuestoReferente(u).total).toBeCloseTo(estimarImpuesto(u).total, 0);
  });
  it("con declaración, el impuesto de hoy es el de «Lo que viene»", () => {
    const u = base();
    const e = estimarDesdeDeclaracion(u.owners[0], {});
    const ref = estimarImpuestoReferente(u);
    expect(bruto(ref)).toBeCloseTo(e.renta, -2);
    expect(ref.detalle[0].fuente).toBe("declaracion");
    expect(ref.referente).toBe(true);
  });
  it("en un simulador conserva la sensibilidad del motor, escalada a la declaración", () => {
    const u = base(), cal = calibracionReferente(u);
    const hoy = bruto(estimarImpuestoReferente(u, cal));
    const masIngreso = bruto(estimarImpuestoReferente(base(35e6), cal));
    const motorHoy = bruto(estimarImpuesto(u)), motorMas = bruto(estimarImpuesto(base(35e6)));
    expect(masIngreso).toBeGreaterThan(hoy);
    expect(masIngreso / hoy).toBeCloseTo(motorMas / motorHoy, 5);
  });
  it("un titular con declaración pero sin ingresos registrados igual aparece", () => {
    const u = { ...base(), ingresos: [] };
    const ref = aplicarReferente(estimarImpuesto(u), calibracionReferente(u));
    expect(ref.detalle.find((d) => d.name === "Luis")?.fuente).toBe("declaracion");
  });
});
