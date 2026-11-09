// 3-nov-2026 — Región (idioma/país) y el impuesto de EE. UU. que usan las
// pantallas compartidas a través de impuestoReferente.
import { describe, it, expect, afterEach } from "vitest";
import { setRegion, tx, plata, plataCorta, pct, miles } from "../../src/lib/region.js";
import { estimarImpuestoReferente, mesesDePago, calibracionReferente } from "../../src/lib/impuestoReferente.js";
import { impuestoUSAnual, estimarImpuestoUS } from "../../src/lib/impuestoUS.js";

afterEach(() => setRegion({ idioma: "es", pais: "CO" }));

describe("región", () => {
  it("por defecto es Colombia en español y no cambia lo existente", () => {
    expect(tx("Hola", "Hello")).toBe("Hola");
    expect(plata(1234567)).toBe("$1.234.567");
    expect(plataCorta(16393000000)).toBe("$16.393.000.000"); // 9-nov-2026: sin abreviar
    expect(pct(4.25, 1)).toBe("4,3%");
  });
  it("idioma y país son ejes distintos", () => {
    setRegion({ idioma: "es", pais: "US" });
    expect(tx("Hola", "Hello")).toBe("Hola");
    expect(plata(1234567)).toBe("$1,234,567");
    expect(plataCorta(2500000)).toBe("$2,500,000");
    expect(plataCorta(16400000000)).toBe("$16,400,000,000");
    expect(miles(57500)).toBe("57,500");
    setRegion({ idioma: "en", pais: "US" });
    expect(tx("Hola", "Hello")).toBe("Hello");
  });
});

describe("impuesto de EE. UU.", () => {
  it("salario de $100.000, soltero en Texas: federal + FICA, todo retenido", () => {
    const r = impuestoUSAnual({ w2: 100000 }, { filingStatus: "single", state: "TX" });
    expect(Math.round(r.federal)).toBe(13170);
    expect(Math.round(r.fica)).toBe(7650);
    expect(r.estatal).toBe(0);
    expect(Math.round(r.retenido)).toBe(Math.round(r.total));
  });
  it("freelance: SE tax y saldo a pagar con estimados", () => {
    const u = { ingresos: [{ nombre: "Consulting", tipo: "1099nec", mensual: 5000, moneda: "USD" }], taxConfig: { state: "FL" } };
    const e = estimarImpuestoUS(u);
    expect(e.detalle[0].us.seTax).toBeGreaterThan(8000);
    expect(e.total).toBeGreaterThan(0);
    expect(e.detalle[0].reteN).toBe(0);
  });
  it("las pantallas compartidas reciben el impuesto de EE. UU. en una sesión de EE. UU.", () => {
    const u = { ingresos: [{ nombre: "Salary", tipo: "w2", mensual: 10000, moneda: "USD" }], owners: [{ name: "Me", type: "natural" }] };
    setRegion({ idioma: "en", pais: "US" });
    const e = estimarImpuestoReferente(u, calibracionReferente(u));
    expect(e.us).toBe(true);
    expect(mesesDePago({ type: "natural" }).map((m) => m.mes)).toEqual([1, 4, 6, 9]);
  });
});

import { tasaMensualEq } from "../../src/lib/flowHelpers.js";
describe("tasa mensual de una deuda por país", () => {
  it("Colombia: E.A. (Sufi 22,99 % → 1,7394 %)", () => {
    expect(tasaMensualEq(22.99)).toBeCloseTo(0.017394, 5);
  });
  it("EE. UU.: APR / 12 (24,9 % → 2,075 %)", () => {
    setRegion({ idioma: "en", pais: "US" });
    expect(tasaMensualEq(24.9)).toBeCloseTo(0.02075, 6);
  });
});

import { tipoActivo, tipoIngreso, esLaboral } from "../../src/lib/metrics.js";
describe("tipos de EE. UU. en el motor compartido", () => {
  it("activos de AssetsModuleUS", () => {
    expect(tipoActivo({ tp: "primary_home" })).toBe("Real Estate");
    expect(tipoActivo({ tp: "rental_res" })).toBe("Real Estate");
    expect(tipoActivo({ tp: "401k_trad" })).toBe("Acciones");
    expect(tipoActivo({ tp: "cash_equiv" })).toBe("Cash");
    expect(tipoActivo({ tp: "vehicle" })).toBe("Vehículo");
  });
  it("ingresos por tipo del IRS: arriendo y dividendos son pasivos, W-2 es laboral", () => {
    expect(tipoIngreso({ tipo: "rental" })).toBe("pasivo");
    expect(tipoIngreso({ tipo: "qual_div" })).toBe("pasivo");
    expect(tipoIngreso({ tipo: "social_sec" })).toBe("pasivo");
    expect(esLaboral({ tipo: "w2" })).toBe(true);
    expect(tipoIngreso({ tipo: "1099nec" })).toBe("activo"); // 5-nov-2026: se pregunta; sin respuesta no suma
    expect(tipoIngreso({ tipo: "w2" })).toBe("activo");
    expect(tipoIngreso({ categoria: "Rental" })).toBe("pasivo");
  });
});

import { sugerirVinculados } from "../../src/lib/futuro10.js";
describe("lo que se va con una venta", () => {
  const user = {
    inv: [{ id: "a1", n: "Rental duplex — East Austin", tp: "rental_res", va: 500000 }, { id: "a2", n: "Local comercial Medellín", tp: "Local Comercial", va: 1 }],
    ingresos: [
      { id: "i1", nombre: "Salary — Alex (Austin Tech Co.)", categoria: "Salario", tipo: "w2", mensual: 18500 },
      { id: "i2", nombre: "Short-term rental — Orlando condo", categoria: "Arriendo", tipo: "rental", mensual: 2700 },
      { id: "i3", nombre: "Salario Empresa Medellín", categoria: "Salario", mensual: 9000000 },
      { id: "i4", nombre: "Arriendo local Medellín", categoria: "Arriendo", mensual: 4000000 },
    ],
    gas: {},
  };
  it("vender el dúplex no se lleva el salario ni la renta de otro inmueble", () => {
    const s = sugerirVinculados(user, "a1");
    expect(s.ingresos.filter((x) => x.sugerido)).toEqual([]);
  });
  it("vender un local sugiere su arriendo, nunca un salario", () => {
    const s = sugerirVinculados(user, "a2").ingresos.filter((x) => x.sugerido).map((x) => x.nombre);
    expect(s).toEqual(["Arriendo local Medellín"]);
  });
});
