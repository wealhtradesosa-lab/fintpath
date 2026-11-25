import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";
import EscenariosCreados from "../../src/components/infografia/EscenariosCreados.jsx";

// 24-nov-2026 (Santiago: "creo escenarios nuevos y todos quedan iguales"; "este cierre es muy confuso: un solo botón guardar";
// "debería ser guardar el actual o guardar como copia"; "trabajé un modelo y se me perdió"). Nada se guarda solo dentro de un
// escenario: «Guardar» guarda el abierto (o crea uno nuevo con su nombre) y «Guardar como copia» crea otro con tus cambios.
const src = readFileSync("src/components/MiFuturo10.jsx", "utf8");
const texto = (html) => html.replace(/<!-- -->/g, "");
const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }], ingresos: [{ nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
const cfgA = { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "rfCorto", monto: 800e6, fuente: "venta", anio: 1 }] };
const cfgB = { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "sp500", monto: 800e6, fuente: "venta", anio: 1 }] };

describe("guardar es explícito", () => {
  it("el guardado automático solo guarda el borrador y de qué escenario es, nunca dentro de un escenario", () => {
    const efecto = src.slice(src.indexOf("const t = setTimeout(() => {"), src.indexOf("}, 600);"));
    expect(efecto).toMatch(/borrador: cfg, borradorDe: editandoRef\.current \|\| null/);
    expect(efecto).not.toMatch(/escenarios:/);
  });
  it("«Crear escenario nuevo» pregunta antes de perder cambios y arranca desde lo que tienes hoy", () => {
    expect(src).toMatch(/onCrear=\{crearNuevo\}/);
    const cuerpo = src.slice(src.indexOf("const crearNuevo = () => {"), src.indexOf("const descartarBorrador = () => {"));
    expect(cuerpo).toMatch(/puedeDejar\(/);
    expect(cuerpo).toMatch(/\{ \.\.\.CONFIG_INICIAL, escenario: cfg\.escenario \}/);
  });
  it("ya no están «Listo: ver y comparar», «Hacer una copia» ni «cada cambio se guarda solo»", () => {
    for (const t of ["Listo: ver y comparar", "Hacer una copia", "Terminar de editar", "cada cambio se guarda solo"]) expect(src).not.toContain(t);
  });
  it("con un escenario abierto y cambios sin guardar: lo dice, con «Guardar» y «Guardar como copia»", () => {
    const html = texto(renderToString(createElement(MiFuturo10, { user: u, onGuardar: () => {}, vista: "crear", guardado: { borrador: cfgB, borradorDe: "a", escenarios: [{ id: "a", nombre: "IBKR MAX+RENTA", config: cfgA }] }, pasoInicial: 4 })));
    expect(html).toContain("Tienes cambios sin guardar en «IBKR MAX+RENTA».");
    expect(html).toContain(">Guardar</button>");
    expect(html).toContain("Guardar como copia");
    expect(html).toContain("«Guardar» actualiza «IBKR MAX+RENTA». «Guardar como copia» crea otro escenario con tus cambios y deja «IBKR MAX+RENTA» como estaba.");
  });
  it("un escenario nuevo sin guardar: nombre y «Guardar», sin copia", () => {
    const html = texto(renderToString(createElement(MiFuturo10, { user: u, onGuardar: () => {}, vista: "crear", guardado: { borrador: cfgB, escenarios: [{ id: "a", nombre: "Uno", config: cfgA }] }, pasoInicial: 4 })));
    expect(html).toContain("Estás armando un escenario nuevo: ponle nombre y guárdalo.");
    expect(html).toContain("Nombre del escenario, ej.: Conservador + casa");
    expect(html).not.toContain("Guardar como copia");
  });
  it("en «Escenarios creados», los cambios sin guardar se ven arriba", () => {
    const html = texto(renderToString(createElement(MiFuturo10, { user: u, onGuardar: () => {}, vista: "creados", guardado: { borrador: cfgB, borradorDe: "a", escenarios: [{ id: "a", nombre: "IBKR MAX+RENTA", config: cfgA }] } })));
    expect(html).toContain("Tienes cambios sin guardar en «IBKR MAX+RENTA».");
    expect(html).toContain("Seguir editando");
  });
});

describe("dos escenarios que dan exactamente lo mismo", () => {
  const planes = [{ nombre: "Si me quedo como estoy", esHoy: true, r: proyectarFuturo10(u, {}) }, { id: "a", nombre: "IBKR + RENTA FIJA", r: proyectarFuturo10(u, cfgA) }, { id: "b", nombre: "IBKR MAX+RENTA", r: proyectarFuturo10(u, cfgA) }, { id: "c", nombre: "Acciones", r: proyectarFuturo10(u, cfgB) }];
  const html = renderToString(createElement(EscenariosCreados, { planes, inflacionPct: 4 })).replace(/<!-- -->/g, "");
  it("la tarjeta de la copia lo dice; la distinta no", () => {
    expect(html).toContain("Da exactamente lo mismo que «IBKR + RENTA FIJA». Si es una copia, edítalo o bórralo.");
    expect(html.match(/Da exactamente lo mismo que/g).length).toBe(1);
  });
});
