// 22-oct-2026 — "Mire estos escenarios, los construí como yo quería;
// necesitamos que el sistema tenga esa capacidad de permitir crear escenarios
// así de completos" (Plan Patrimonial SALEM).
//
// Cuatro de sus siete planes giran sobre lo mismo: un lote más una obra que se
// vende a los ~14 meses y la utilidad vuelve a entrar a la siguiente vuelta.
// Los números de abajo son los de SU documento: si el motor deja de darlos,
// dejó de modelar lo que él modeló a mano.
import { describe, it, expect } from "vitest";
import { expandirMotor, cuentaMotor, baseDesdeUsuario, configurarEscenario, escenarioVacio, PERFIL_DEFAULT } from "../../src/lib/caminos.js";

const semiurbanas = { id: "mt", tipo: "motor", nombre: "Motor semiurbanas", mes: 0, lote: 650e6, obra: 750e6, venta: 1900e6, mesesVuelta: 14, impuestoPct: 35, vueltas: 8 };

describe("una vuelta del motor da los números del documento", () => {
  const c = cuentaMotor(semiurbanas);
  it("lote + obra = costo, y la utilidad es la del papel", () => {
    expect(c.costo).toBe(1400e6);
    expect(c.utilidad).toBe(500e6);
    expect(Math.round(c.utilidad / c.costo * 1000) / 10).toBe(35.7); // +35,7%
  });
  it("la renta de la SAS se lleva el 35% de la utilidad, no de la venta", () => {
    expect(c.impuesto).toBe(175e6);
    expect(c.queda).toBe(1725e6);
  });
  it("cada vuelta multiplica el capital por 1,232 (+23,2%)", () => {
    expect(Math.round(c.porVuelta * 10) / 10).toBe(23.2);
    expect(Math.round(c.anual)).toBe(20); // "al año, reinvirtiendo siempre, ~20%"
  });
  it("ocho vueltas llegan a $7.437 M en 112 meses", () => {
    expect(Math.round(c.final / 1e6)).toBe(7437);
    expect(c.meses).toBe(112);
  });
  it("y cuatro vueltas, a $3.227 M en el mes 56", () => {
    const c4 = cuentaMotor({ ...semiurbanas, vueltas: 4 });
    expect(Math.round(c4.final / 1e6)).toBe(3227);
    expect(c4.meses).toBe(56);
  });
});

describe("el motor se expande en lo que el simulador ya sabe hacer", () => {
  const mov = expandirMotor(semiurbanas);
  it("tres movimientos por vuelta: compra, revalúa, vende", () => {
    expect(mov).toHaveLength(24);
    expect(mov.filter((m) => m.tipo === "comprar")).toHaveLength(8);
    expect(mov.filter((m) => m.tipo === "vender")).toHaveLength(8);
  });
  it("la venta de una vuelta va antes de la compra de la siguiente", () => {
    const venta1 = mov.findIndex((m) => m.tipo === "vender");
    const compra2 = mov.findIndex((m, i) => m.tipo === "comprar" && i > 0);
    expect(venta1).toBeLessThan(compra2);
    expect(mov[venta1].mes).toBe(mov[compra2].mes);
  });
  it("cada vuelta invierte lo que quedó de la anterior", () => {
    const compras = mov.filter((m) => m.tipo === "comprar");
    expect(compras[0].costo).toBe(1400e6);
    expect(Math.round(compras[1].costo / 1e6)).toBe(1725);
  });
  it("el impuesto se cobra al vender, como % de la venta equivalente", () => {
    const v = mov.find((m) => m.tipo === "vender");
    expect(Math.round(v.netoPct * 10) / 10).toBe(90.8); // 175 de 1.900
  });
  it("sin reinversión, cada vuelta vuelve a empezar con lo mismo", () => {
    const sin = expandirMotor({ ...semiurbanas, reinvierte: false, vueltas: 3 }).filter((m) => m.tipo === "comprar");
    expect(sin.every((m) => m.costo === 1400e6)).toBe(true);
  });
});

describe("dentro de un escenario, el motor mueve el patrimonio", () => {
  const user = { trm: 4200, inv: [{ id: "caja", n: "Efectivo", tp: "Cash", va: 2000e6 }], ingresos: [{ id: "s", nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }], gas: { Hogar: [{ c: "Vida", m: 5e6, freq: "mes" }] }, deu: [] };
  const base = baseDesdeUsuario(user, PERFIL_DEFAULT, {});
  const con = configurarEscenario(base, escenarioVacio({ id: "e1", nombre: "Con motor", eventos: [semiurbanas] }), PERFIL_DEFAULT);
  it("el escenario termina con los 24 movimientos del motor adentro", () => {
    expect(con.cfg.movimientos.filter((m) => String(m.id || "").startsWith("mt_v")).length).toBe(8);
  });
});
