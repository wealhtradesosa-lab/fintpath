// «La historia de tu plata» (7-nov-2026): la sección cuenta la historia completa
// del escenario: lo que tienes hoy, qué se vende, cómo queda el portafolio y qué
// pasa con cada destino, incluidos los negocios que se repiten (asociativos).
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import HistoriaPlata from "../../src/components/infografia/HistoriaPlata.jsx";

const user = {
  trm: 4000, inflacionPct: 4,
  inv: [
    { id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 3000e6 },
    { id: "lote", n: "Lote bodega", tipo: "inmueble", va: 410e6 },
    { id: "c", n: "Cash", tipo: "liquidez", va: 100e6 },
  ],
  ingresos: [{ nombre: "Salario", mensual: 50e6, frecuencia: "mensual" }],
  gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] },
};
const cfg = {
  decisiones: { pm: { accion: "vende" } },
  reinversiones: [{ activoId: "lote", monto: 600e6, anio: 1, rentaMensual: 8e6, rentaDesdeMes: 18, fuente: "venta" }],
  nuevas: [{ preset: "custom", nombre: "BTG", monto: 500e6, anio: 1, rendimientoNomPct: 14, pctRecibe: 100, fuente: "venta" }],
  ciclos: [{ nombre: "Asociativos", capital: 1350e6, valorFinal: 1900e6, meses: 12, desde: 1, fuente: "venta", impuestoPct: 0, destino: "reinvierte" }],
};

describe("HistoriaPlata", () => {
  const r = proyectarFuturo10(user, cfg);
  const html = renderToStaticMarkup(<HistoriaPlata r={r} />);
  it("parte de lo que tienes hoy y dice qué se vende", () => {
    expect(html).toContain("Partes de");
    expect(html).toContain("Puerto Madero");
    expect(html).toContain("Se vende");
    expect(html).toContain("Por qué");
  });
  it("el portafolio después del plan distingue lo nuevo, lo aportado y lo igual", () => {
    expect(html).toContain("Nuevo · de la venta"); // BTG no es «se conserva»
    expect(html).toContain("Tenías $410"); // lote: tenías + de la venta
    expect(html).toContain("Igual que hoy");
  });
  it("el negocio que se repite aparece como motor con su ciclo", () => {
    expect(html).toContain("Negocio que se repite");
    expect(html).toContain("Motor: se repite");
    expect(html).toMatch(/Cada año: inviertes \$1\.350/);
    expect(html).toContain("Asociativos");
  });
  it("sin escenario (menos de 2 filas) no pinta nada", () => {
    expect(renderToStaticMarkup(<HistoriaPlata r={{ filas: [] }} />)).toBe("");
  });
});
