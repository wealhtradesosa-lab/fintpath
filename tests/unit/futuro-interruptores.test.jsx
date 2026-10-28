// 28-oct-2026 — Año futuro con interruptores propios por escenario.
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import SimuladorFuturo, { construirBase, aplicarCambios } from "../../src/components/SimuladorFuturo.jsx";

const user = {
  trm: 4000,
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 20e6, sim: true }],
  gastos: {
    Vivienda: [{ c: "Arriendo", m: 5e6, sim: true }],
    Hogar: [{ c: "Mayordomos", m: 3e6, sim: false }, { c: "Administración Óscar", m: 3.9e6 }],
  },
  deudas: [],
  owners: [{ id: "own_1", name: "Yo", type: "natural" }],
};

describe("año futuro: interruptores por escenario", () => {
  it("claves estables por nombre y lo apagado aparece como apagado", () => {
    const base = construirBase(user);
    const keys = base.map((b) => b.key);
    expect(keys).toContain("gas:Hogar:mayordomos");
    expect(keys).toContain("gas:Hogar:administracion oscar");
    const may = base.find((b) => b.key === "gas:Hogar:mayordomos");
    expect(may.vig.apagado).toBe(true);
  });
  it("incluidos manda: un gasto apagado hoy cuenta si el escenario lo prende", () => {
    const base = construirBase(user);
    const inc = new Set(base.filter((b) => b.key !== "gas:Vivienda:arriendo").map((b) => b.key));
    const filas = aplicarCambios(base, [], 2027, inc);
    expect(filas.some((f) => f.nombre === "Mayordomos")).toBe(true);
    expect(filas.some((f) => f.nombre === "Arriendo")).toBe(false);
  });
  it("render: muestra apagados tachados y lo nuevo en «Nuevos en tus datos de hoy»", () => {
    const esc = { id: "e1", nombre: "Mi 2027", año: 2027, cambios: [], activos: {}, conocidos: ["ing:salario", "gas:Vivienda:arriendo", "gas:Hogar:mayordomos"] };
    const html = renderToString(createElement(SimuladorFuturo, { user, escenarios: [esc], onUpdate: () => {} }));
    expect(html).toContain("Mayordomos");
    expect(html).toContain("apagado en el simulador de hoy");
    expect(html).toContain("cosa nueva");          // Administración Óscar no estaba al crear el escenario
    expect(html).toContain("Administración Óscar");
    expect(html).toContain("propios interruptores");
  });
});
