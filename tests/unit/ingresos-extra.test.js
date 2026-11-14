// 14-nov-2026 — Ingresos únicos (herencia, venta de un activo): entran en su mes
// y en el total del año; no en promedios ni en el nivel. Caso real: herencia de
// 45 MM que entra en noviembre a nombre de la esposa.
import { describe, it, expect } from "vitest";
import { extrasIngresoDelMes, extrasIngresoDelAño, registrarExtraIngreso, crearIngresoConExtra, editarExtraIngreso, eliminarExtraIngreso, convertirEnUnicoIngreso, montoDeUnPago } from "../../src/lib/ingresosExtra.js";
import { eliminarExtra, crearConExtra } from "../../src/lib/gastosExtra.js";
import { grupoIngreso, ingresosPorConfirmar } from "../../src/lib/metrics.js";
import { claseIngreso } from "../../src/lib/clasesListado.js";
import { montoPromedioMensual } from "../../src/lib/flowHelpers.js";

const hoy = new Date("2026-11-14T12:00:00");
const base = [{ id: "ing_1", nombre: "Salario", categoria: "Salario", mensual: 30e6, frecuencia: "mensual", owner: "o1" }];
const herencia = { año: 2026, mes: 11, monto: 45e6, moneda: "COP", nota: "" };

describe("ingreso único nuevo (herencia)", () => {
  const out = crearIngresoConExtra(base, { nombre: "Herencia", categoria: "Herencia o donación", owner: "o2" }, herencia, hoy);
  const h = out.find((i) => i.soloExtras);
  it("crea un ingreso sin monto recurrente, del dueño elegido", () => {
    expect(h).toMatchObject({ nombre: "Herencia", categoria: "Herencia o donación", owner: "o2", mensual: 0, soloExtras: true });
  });
  it("entra solo en noviembre y en el total del año", () => {
    expect(extrasIngresoDelMes(h, 2026, 11, 4000)).toBe(45e6);
    expect(extrasIngresoDelMes(h, 2026, 10, 4000)).toBe(0);
    expect(extrasIngresoDelAño(h, 2026, 4000)).toBe(45e6);
    expect(extrasIngresoDelAño(h, 2027, 4000)).toBe(0); // no se repite el año siguiente
  });
  it("no entra en el promedio mensual ni se pregunta para el nivel", () => {
    expect(montoPromedioMensual(h)).toBe(0);
    expect(grupoIngreso(h)).toBe("unica");
    expect(ingresosPorConfirmar(out).map((x) => x.i.id)).not.toContain(h.id);
  });
  it("va en el grupo «Ingresos únicos» de la lista", () => {
    expect(claseIngreso(h).id).toBe("unicos");
    expect(claseIngreso(base[0]).id).toBe("trabajo");
  });
  it("corregir cambia valor, mes, nombre y dueño sin duplicar", () => {
    const x = h.extras[0];
    const c = editarExtraIngreso(out, h.id, x.id, { año: 2026, mes: 10, monto: 46.5e6, moneda: "COP", nota: "papá de Ana" }, { nombre: "Herencia papá", categoria: "Herencia o donación", owner: "o1" });
    const h2 = c.find((i) => i.id === h.id);
    expect(h2.extras).toHaveLength(1);
    expect(h2.extras[0]).toMatchObject({ id: x.id, mes: 10, monto: 46.5e6, nota: "papá de Ana" });
    expect(h2).toMatchObject({ nombre: "Herencia papá", owner: "o1" });
  });
  it("quitar el último ingreso único borra el ingreso que solo existía por él", () => {
    const sin = eliminarExtraIngreso(out, h.id, h.extras[0].id);
    expect(sin.map((i) => i.id)).toEqual(["ing_1"]);
  });
});

describe("ingreso único asociado a uno que ya existe", () => {
  const out = registrarExtraIngreso(base, "ing_1", { año: 2026, mes: 12, monto: 5000, moneda: "USD" }, hoy);
  const s = out[0];
  it("se suma en su mes, convertido a pesos, sin cambiar el promedio", () => {
    expect(extrasIngresoDelMes(s, 2026, 12, 4000)).toBe(20e6);
    expect(montoPromedioMensual(s)).toBe(30e6);
    expect(grupoIngreso(s)).toBe(grupoIngreso(base[0]));
  });
  it("corregir no cambia el nombre ni el dueño del ingreso recurrente", () => {
    const c = editarExtraIngreso(out, "ing_1", s.extras[0].id, { año: 2026, mes: 12, monto: 6000, moneda: "USD" }, { nombre: "X", owner: "o2" });
    expect(c[0]).toMatchObject({ nombre: "Salario", owner: "o1" });
    expect(c[0].extras[0].monto).toBe(6000);
  });
  it("quitar el ingreso único deja el ingreso recurrente", () => {
    expect(eliminarExtraIngreso(out, "ing_1", s.extras[0].id)).toHaveLength(1);
  });
});

describe("gasto de pago único", () => {
  it("quitar el último pago borra el gasto que solo existía por él", () => {
    const g = crearConExtra({}, { cat: "Viajes", nombre: "Vacaciones" }, { año: 2026, mes: 7, monto: 8000, moneda: "USD" });
    const cat = Object.keys(g)[0];
    const x = g[cat][0].extras[0];
    expect(eliminarExtra(g, cat, 0, x.id)[cat]).toHaveLength(0);
  });
});

describe("convertir un ingreso registrado como «una vez al año» en ingreso único (caso real)", () => {
  const anual = { id: "ing_3", nombre: "INGRESO EXTRA PACAMANA (TOPACO)", categoria: "Otros ingresos", mensual: 45e6, frecuencia: "anual", mesPago: 1, tipo: "fijo", owner: "o2", fiscalCode: "NOL_OTROS" };
  const antes = [...base, anual];
  it("antes inflaba el promedio: 45 MM cada enero = 3,75 MM/mes", () => {
    expect(montoPromedioMensual(anual)).toBe(3.75e6);
    expect(montoDeUnPago(anual)).toBe(45e6);
  });
  const out = convertirEnUnicoIngreso(antes, "ing_3", { nombre: anual.nombre, categoria: "Herencia o donación", owner: "o2" }, { año: 2026, mes: 11, monto: 45e6, moneda: "COP" }, hoy);
  const h = out.find((i) => i.id === "ing_3");
  it("queda una sola vez, en noviembre, sin promedio ni repetición", () => {
    expect(h).toMatchObject({ soloExtras: true, mensual: 0, categoria: "Herencia o donación", fiscalCode: "GO_HERENCIA", owner: "o2" });
    expect(h.mesPago).toBeUndefined();
    expect(montoPromedioMensual(h)).toBe(0);
    expect(extrasIngresoDelMes(h, 2026, 11, 4000)).toBe(45e6);
    expect(extrasIngresoDelMes(h, 2026, 1, 4000)).toBe(0);
    expect(extrasIngresoDelAño(h, 2027, 4000)).toBe(0);
    expect(grupoIngreso(h)).toBe("unica");
  });
  it("no toca los demás ingresos", () => { expect(out[0]).toBe(antes[0]); });
});
