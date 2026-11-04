// 3-nov-2026 — Año entrante en una sesión de EE. UU.: todo en dólares (los USD no
// se multiplican por la TRM), el impuesto sale del motor de EE. UU. con el estado
// civil y el estado (taxConfig), y lo que no retiene la nómina va en 4 pagos estimados.
import { describe, it, expect, afterEach } from "vitest";
import { setRegion } from "../../src/lib/region.js";
import { construirBase, aplicarCambios, usuarioFuturo, impuestoAnual, cuadro } from "../../src/components/SimuladorFuturo.jsx";
import { pagosDeclaracion } from "../../src/lib/impuestoReferente.js";

afterEach(() => setRegion({ idioma: "es", pais: "CO" }));

const user = {
  trm: 4000,
  owners: [{ id: "own_1", name: "Me", type: "natural" }],
  ingresos: [
    { id: "i1", nombre: "Salary", tipo: "w2", categoria: "Salario", mensual: 8000, moneda: "USD", frecuencia: "mensual" },
    { id: "i2", nombre: "Consulting", tipo: "1099nec", categoria: "Honorarios", mensual: 3000, moneda: "USD", frecuencia: "mensual" },
  ],
  gastos: { Vivienda: [{ id: "g1", c: "Rent", m: 2500, mensual: 2500, moneda: "USD", frecuencia: "mensual" }] },
  deudas: [{ id: "d1", n: "Car loan", mt: 20000, pg: 500, moneda: "USD", ts: 6 }],
  taxConfig: { filingStatus: "single", state: "CA" },
};

describe("Año entrante · EE. UU.", () => {
  it("los montos quedan en dólares y el impuesto usa el estado de residencia", () => {
    setRegion({ idioma: "en", pais: "US" });
    const año = new Date().getFullYear() + 1;
    const base = construirBase(user);
    expect(base.find((b) => b.key.startsWith("ing")).montoTipico).toBe(8000);
    expect(base.find((b) => b.kind === "deu").montoTipico).toBe(500);
    const filas = aplicarCambios(base, [], año, new Set(base.map((b) => b.key)));
    const u = usuarioFuturo(user, filas);
    expect(u.taxConfig.state).toBe("CA");
    const imp = impuestoAnual(u);
    expect(imp.detalle[0].us.estado).toBe("CA");
    expect(imp.detalle[0].us.estatal).toBeGreaterThan(0);
    // Ingreso anual 132.000 USD: el impuesto total no puede ser de millones (no se multiplicó por la TRM).
    expect(imp.bruto).toBeGreaterThan(20000);
    expect(imp.bruto).toBeLessThan(60000);
    const pago = pagosDeclaracion(u.owners, {}, imp.detalle, año);
    expect(pago.porMes.filter((v) => v > 0).length).toBe(4);
    // Mes típico: los pagos estimados se prorratean.
    const t = cuadro(filas, Array.from({ length: 12 }, (_, i) => i), imp, pago.porMes);
    expect(Math.round(t.impuesto)).toBe(Math.round(pago.total / 12));
  });
  it("Colombia no cambia: los dólares se pasan a pesos y la declaración no entra al mes típico", () => {
    const base = construirBase(user);
    expect(base.find((b) => b.key.startsWith("ing")).montoTipico).toBe(8000 * 4000);
    const filas = aplicarCambios(base, [], 2027, new Set(base.map((b) => b.key)));
    const t = cuadro(filas, Array.from({ length: 12 }, (_, i) => i), { rete: 0, neto: 0 }, Array(12).fill(100));
    expect(t.impuesto).toBe(0);
  });
});

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import SimuladorFuturo from "../../src/components/SimuladorFuturo.jsx";
import NotaFuenteImpuesto from "../../src/components/NotaFuenteImpuesto.jsx";
import { estimarImpuestoReferente } from "../../src/lib/impuestoReferente.js";

describe("Año entrante · pinta en EE. UU. (inglés y español)", () => {
  const año = new Date().getFullYear() + 1;
  const esc = [{ id: "e1", nombre: "Plan", año, cambios: [] }];
  it("en inglés: impuestos de EE. UU., sin DIAN ni retención en la fuente", () => {
    setRegion({ idioma: "en", pais: "US" });
    const html = renderToString(createElement(SimuladorFuturo, { user, escenarios: esc }));
    // 4-nov-2026: el detalle de impuestos quedó plegado; arriba va el resumen.
    expect(html).toContain("Taxes per month");
    expect(html).not.toMatch(/DIAN|declaraci|Retención en la fuente|COP/);
    const nota = renderToString(createElement(NotaFuenteImpuesto, { modo: "futuro", owners: user.owners, detalle: estimarImpuestoReferente(user).detalle }));
    expect(nota).toContain("Form 1040-ES");
    expect(nota).not.toContain("Calculadora");
  });
  it("en español con país EE. UU.: textos en español, conceptos de EE. UU.", () => {
    setRegion({ idioma: "es", pais: "US" });
    const html = renderToString(createElement(SimuladorFuturo, { user, escenarios: esc }));
    expect(html).toContain("Impuestos al mes");
    expect(html).not.toMatch(/Retención en la fuente|Declaración de renta/);
  });
});
