// «La historia de tu plata» (7-nov-2026): la sección cuenta la historia completa
// del escenario: lo que tienes hoy, qué se vende, cómo queda el portafolio y qué
// pasa con cada destino, incluidos los negocios que se repiten (asociativos).
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { proyectarFuturo10, anioCal } from "../../src/lib/futuro10.js";
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
    expect(html).toContain("Hoy tienes");
    expect(html).toContain("Puerto Madero");
    expect(html).toContain("Se vende");
    expect(html).toContain("Por qué");
  });
  it("el portafolio al terminar el año distingue lo nuevo, lo aportado y lo igual", () => {
    expect(html).toContain("Nueva este año"); // BTG no es «sigue igual»
    expect(html).toContain("Tenías $410"); // lote: tenías + le pones
    expect(html).toContain("Sigue igual");
  });
  it("el negocio que se repite aparece como motor con su ciclo", () => {
    expect(html).toContain("Proyecto que se repite");
    expect(html).toContain("Motor: se repite");
    expect(html).toMatch(/Cada año: inviertes \$1\.350/);
    expect(html).toContain("Asociativos");
  });
  // 23-nov-2026 (Santiago: "en Qué haces con tu plata, puntos 1 al 4, solo está mostrando 2026").
  it("sigue el año elegido: en 2027 empieza donde terminó 2026 y la cuenta viene del año anterior", () => {
    const h2 = renderToStaticMarkup(<HistoriaPlata r={r} anio={2} />);
    expect(h2).toContain(`Al empezar ${anioCal(2)}`);
    expect(h2).toContain(`Al terminar ${anioCal(2)}`);
    expect(h2).toContain(`Viene de ${anioCal(1)}`);
    expect(h2).toMatch(/Entra .*usas .*queda para/);
  });
  it("la renta que empieza después sale apagada con su año, y se prende ese año", () => {
    // El lote renta desde el mes 18 (2027): hoy aparece como «Empieza en 2027».
    expect(html).toContain(`Empieza en ${anioCal(2)}`);
    const h2 = renderToStaticMarkup(<HistoriaPlata r={r} anio={2} />);
    expect(h2).toMatch(/Lote bodega.*Empieza este año/s);
    expect(h2).toContain("Promedio de los 10 años");
  });
  it("sin escenario (menos de 2 filas) no pinta nada", () => {
    expect(renderToStaticMarkup(<HistoriaPlata r={{ filas: [] }} />)).toBe("");
  });
});

describe("HistoriaPlata · inversiones de años siguientes", () => {
  it("una inversión de 2027 dice desde cuándo y no sale en $0 ×0,0", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tipo: "liquidez", va: 9000e6 }], ingresos: [{ nombre: "Salario", mensual: 50e6, frecuencia: "mensual" }], gas: {} };
    const r = proyectarFuturo10(u, { nuevas: [{ preset: "custom", nombre: "SKANDIA", monto: 4000e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 14 }] });
    const h1 = renderToStaticMarkup(<HistoriaPlata r={r} anio={1} />);
    expect(h1).toContain("SKANDIA");
    expect(h1).toContain(`Se invierte en ${anioCal(2)}`);
    expect(h1).not.toContain("×0,0");
    const h5 = renderToStaticMarkup(<HistoriaPlata r={r} anio={5} />);
    expect(h5).toContain(`Vale en ${anioCal(5)}`);
    expect(h5).not.toMatch(/Vale en \d{4}<\/div><div[^>]*>\$0</);
  });
});

describe("HistoriaPlata · renta que cambias en el paso 1", () => {
  it("el local que arriendas desde 2027 sale en «Lo que cambia en tu bolsillo» desde ese año", () => {
    const u = { inflacionPct: 4, inv: [{ id: "loc", n: "Local comercial", tipo: "inmueble", va: 1500e6 }, { id: "c", n: "Cuenta", tipo: "liquidez", va: 200e6 }], ingresos: [{ nombre: "Salario", mensual: 50e6, frecuencia: "mensual" }], gas: {} };
    const r = proyectarFuturo10(u, { decisiones: { loc: { accion: "cambia", mensual: 8.5e6, desde: 2 } } });
    const h1 = renderToStaticMarkup(<HistoriaPlata r={r} anio={1} />);
    expect(h1).toMatch(/Local comercial.*Empieza en/s);
    expect(h1).toContain(`Empieza en ${anioCal(2)}`);
    const h2 = renderToStaticMarkup(<HistoriaPlata r={r} anio={2} />);
    expect(h2).toMatch(/¿Qué cambia en tu bolsillo.*Local comercial.*\+\$8\.\d{3}\.\d{3}/s);
  });
});
