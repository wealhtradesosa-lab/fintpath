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
    const ref = estimarImpuestoReferente(u, calibracionReferente(u, { modo: "estimado" }));
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
    const ref = aplicarReferente(estimarImpuesto(u), calibracionReferente(u, { modo: "estimado" }));
    expect(ref.detalle.find((d) => d.name === "Luis")?.fuente).toBe("declaracion");
  });
});

describe("año actual con la declaración real del año pasado", () => {
  it("lo que sale de la caja este año = retenciones + saldo de la declaración del año pasado", () => {
    const u = base();
    const cal = calibracionReferente(u, { modo: "actual", hoy: new Date("2026-10-29") });
    expect(cal.Luis.real).toBe(true);
    expect(cal.Luis.renta).toBeCloseTo(30e6 + 10e6, 0);
    const ref = estimarImpuestoReferente(u, cal);
    expect(ref.detalle[0].fuente).toBe("declaracion_real");
    expect(ref.detalle[0].impBruto - ref.detalle[0].reteN).toBeCloseTo(10e6, -3);
  });
  it("para años siguientes usa el estimado de la Calculadora", () => {
    const cal = calibracionReferente(base(), { modo: "estimado" });
    expect(cal.Luis.real).toBeUndefined();
  });
  it("si no tiene la declaración del año pasado, el año actual usa el estimado", () => {
    const cal = calibracionReferente(base(), { modo: "actual", hoy: new Date("2028-03-01") });
    expect(cal.Luis.real).toBeUndefined();
  });
});
