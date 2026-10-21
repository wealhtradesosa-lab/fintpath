// 21-oct-2026 — Escenarios inflaba el ingreso pasivo en $193,8 M/mes.
//
// Santiago, mirando el paso 1: "de dónde salió o por qué aparece BTG en 7 mil,
// ¿dónde lo puse?". No lo había puesto: BTG Pactual no está en sus
// Inversiones. La pantalla arma una posición con CUALQUIER ingreso que declare
// un capital y una tasa, y la armaba con `capital × tasa nominal` — sin mirar
// la vigencia que él había cargado. Su ingreso de $122,5 M que solo corre en
// DICIEMBRE aparecía como $122,5 M todos los meses.
//
// Medido sobre su cuenta, siete renglones: $258,1 M/mes mostrados contra
// $64,2 M/mes que de verdad entran.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario } from "../../src/lib/caminos.js";

const BTG = {
  id: "btg", nombre: "BTG PACTUAL", categoria: "Intereses bancarios",
  capital: 7000e6, tasa: 21, mensual: 122.5e6,
  frecuencia: "mensual", desdeMes: 12, hastaMes: 12, vigenciaModo: "limitada",
};
const usuario = (ingreso) => ({ trm: 4200, inv: [], ingresos: [ingreso], gas: {}, deu: [] });
const posDe = (ingreso) => baseDesdeUsuario(usuario(ingreso)).posiciones.find((p) => p.soloIngreso);
// Lo mismo que calcula la columna "Recibes / mes" (MiPlan → produce).
const recibeMes = (p) => p.capital * p.tasa / 100 / 12 * (p.pagaPct / 100);

describe("un ingreso con vigencia no se cobra los doce meses", () => {
  it("el que solo corre en diciembre entra promediado, no completo", () => {
    const p = posDe(BTG);
    expect(Math.round(recibeMes(p))).toBe(Math.round(122.5e6 / 12)); // $10,2 M, no $122,5 M
  });

  it("y se dice de dónde salió el cambio, en vez de reescribir su tasa a escondidas", () => {
    const p = posDe(BTG);
    expect(p.tasaDeclarada).toBe(21);
    expect(p.tasa).toBeCloseTo(1.75, 2);
  });

  it("sin vigencia limitada, la tasa que escribió se respeta tal cual", () => {
    const p = posDe({ ...BTG, desdeMes: 1, hastaMes: 12 });
    expect(p.tasa).toBe(21);
    expect(p.tasaDeclarada).toBeNull();
    expect(Math.round(recibeMes(p))).toBe(Math.round(7000e6 * 0.21 / 12));
  });

  it("un ingreso variable vale lo que tiene cargado mes a mes, no su tasa", () => {
    const meses = [0, 0, 0, 0, 0, 0, 0, 0, 0, 30e6, 30e6, 30e6];
    const p = posDe({ ...BTG, frecuencia: "variable", desdeMes: 1, hastaMes: 12, montosMensuales: meses });
    expect(Math.round(recibeMes(p))).toBe(Math.round(90e6 / 12));
  });

  it("un redondeo a mano no le reescribe la tasa (10% escrito, 9,996% calculado)", () => {
    const p = posDe({ ...BTG, capital: 200e6, tasa: 10, mensual: 1.666e6, desdeMes: 1, hastaMes: 12 });
    expect(p.tasa).toBe(10);
    expect(p.tasaDeclarada).toBeNull();
  });
});

describe("lo que la pantalla deriva queda marcado como derivado", () => {
  it("una posición que salió de un ingreso se puede distinguir de un activo", () => {
    const p = posDe(BTG);
    expect(p.soloIngreso).toBe(true);
    expect(p.tipo).toBe("Capital");
    expect(p.id).toBe("cap_btg");
  });

  it("si ese capital SÍ está en Inversiones, no se duplica", () => {
    const user = {
      trm: 4200,
      inv: [{ id: "a1", n: "BTG PACTUAL", tp: "Fondo de Inversión", va: 7000e6, tasa: 21 }],
      ingresos: [BTG], gas: {}, deu: [],
    };
    const pos = baseDesdeUsuario(user).posiciones;
    expect(pos.filter((p) => p.soloIngreso)).toHaveLength(0);
    expect(pos).toHaveLength(1);
    // y el activo real también queda medido por la plata que entra
    expect(pos[0].tasaDeclarada).toBe(21);
    expect(Math.round(recibeMes(pos[0]))).toBe(Math.round(122.5e6 / 12));
  });
});

describe("el caso real completo", () => {
  // Los siete renglones de rendimiento de la cuenta, con su vigencia.
  const reales = [
    { id: "r1", nombre: "BTG PACTUAL", categoria: "Intereses bancarios", capital: 7000e6, tasa: 21, mensual: 122.5e6, frecuencia: "mensual", desdeMes: 12, hastaMes: 12 },
    { id: "r3", nombre: "RAPICREDIT", categoria: "Intereses bancarios", capital: 800e6, tasa: 21, mensual: 14e6, frecuencia: "mensual", desdeMes: 10, hastaMes: 12 },
    { id: "r4", nombre: "—", categoria: "Intereses bancarios", capital: 2000e6, tasa: 21, mensual: 35e6, frecuencia: "mensual", desdeMes: 12, hastaMes: 12 },
    { id: "r5", nombre: "—", categoria: "Intereses bancarios", capital: 730e6, tasa: 21, mensual: 12.775e6, frecuencia: "mensual", desdeMes: 10, hastaMes: 12 },
    { id: "r6", nombre: "—", categoria: "Intereses bancarios", capital: 400e6, tasa: 21, mensual: 7e6, frecuencia: "mensual", desdeMes: 10, hastaMes: 12 },
    { id: "r7", nombre: "rapicredit", categoria: "Dividendos", capital: 900e6, tasa: 8.7, mensual: 6529592, frecuencia: "mensual", desdeMes: 7, hastaMes: 12 },
  ];

  it("deja de mostrar seis veces más plata de la que entra", () => {
    const pos = baseDesdeUsuario({ trm: 4200, inv: [], ingresos: reales, gas: {}, deu: [] }).posiciones;
    const ahora = pos.reduce((s, p) => s + recibeMes(p), 0);
    const nominal = reales.reduce((s, i) => s + i.capital * i.tasa / 100 / 12, 0);
    expect(Math.round(nominal / 1e6)).toBe(198);   // lo que mostraba
    expect(Math.round(ahora / 1e6)).toBe(25);      // lo que de verdad entra
    expect(ahora).toBeLessThan(nominal / 5);
  });
});
