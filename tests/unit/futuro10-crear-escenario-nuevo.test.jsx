import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// 24-nov-2026 (Santiago: "creo escenarios nuevos y todos quedan iguales"). «Crear escenario» seguía con el último escenario abierto y, si
// venías de «Editar», cada cambio se guardaba en ese escenario. Ahora termina la edición y arranca desde lo que tienes hoy.
const src = readFileSync("src/components/MiFuturo10.jsx", "utf8");
describe("crear un escenario nuevo", () => {
  it("«Crear escenario» usa crearNuevo, que termina la edición y arranca limpio", () => {
    expect(src).toMatch(/onCrear=\{crearNuevo\}/);
    const cuerpo = src.slice(src.indexOf("const crearNuevo = () => {"), src.indexOf("const descartarBorrador = () => {"));
    expect(cuerpo).toMatch(/if \(editandoId \|\| !hayBorrador\)/);
    expect(cuerpo).toMatch(/\{ \.\.\.CONFIG_INICIAL, escenario: cfg\.escenario \}/);
    expect(cuerpo).toMatch(/setEditandoId\(null\)/);
  });
  it("arriba del creador se dice que estás editando, con «Terminar de editar» y «Crear uno nuevo»", () => {
    expect(src).toContain("Estás editando este escenario: cada cambio se guarda solo en él.");
    expect(src).toMatch(/onClick=\{crearNuevo\}>\{tx\("Crear uno nuevo"/);
    expect(src).toContain("Listo: ver y comparar mis escenarios");
    expect(src).toContain("Hacer una copia y seguir en ella");
    expect(src).not.toContain("Terminar de editar");
  });
});

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import EscenariosCreados from "../../src/components/infografia/EscenariosCreados.jsx";
describe("dos escenarios que dan exactamente lo mismo", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }], ingresos: [{ nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
  const cfgA = { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "rfCorto", monto: 800e6, fuente: "venta", anio: 1 }] };
  const cfgB = { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "sp500", monto: 800e6, fuente: "venta", anio: 1 }] };
  const planes = [{ nombre: "Si me quedo como estoy", esHoy: true, r: proyectarFuturo10(u, {}) }, { id: "a", nombre: "IBKR + RENTA FIJA", r: proyectarFuturo10(u, cfgA) }, { id: "b", nombre: "IBKR MAX+RENTA", r: proyectarFuturo10(u, cfgA) }, { id: "c", nombre: "Acciones", r: proyectarFuturo10(u, cfgB) }];
  const html = renderToString(createElement(EscenariosCreados, { planes, inflacionPct: 4 })).replace(/<!-- -->/g, "");
  it("la tarjeta de la copia lo dice; la distinta no", () => {
    expect(html).toContain("Da exactamente lo mismo que «IBKR + RENTA FIJA». Si es una copia, edítalo o bórralo.");
    expect(html.match(/Da exactamente lo mismo que/g).length).toBe(1);
  });
});
