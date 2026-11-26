import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import PlanTabla, { filasDelPlan, armarPropiedadRaiz } from "../../src/components/PlanTabla.jsx";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10, cuentaPorAnio, leerPropiedadRaiz } from "../../src/lib/futuro10.js";

// 26-nov-2026 — «Tu plan en una pantalla»: la tabla año por año para armar escenarios.
const Y = new Date().getFullYear();
const user = { trm: 4200, inflacionPct: 4,
  inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 8900e6 }, { id: "or", n: "Casa Orlando", tp: "Real Estate", va: 1950e6 }, { id: "ib", n: "Acciones", tp: "ETF", va: 900e6 }, { id: "ca", n: "Cuenta", tp: "Cash", va: 300e6 }],
  ingresos: [{ nombre: "Salario de Santiago", categoria: "Salario", mensual: 25e6 }, { nombre: "Salario de Ana", categoria: "Salario", mensual: 12e6 }, { nombre: "Renta Puerto Madero", categoria: "Arriendo", mensual: 28e6, activoId: "pm" }, { nombre: "Renta Casa Orlando", categoria: "Arriendo", mensual: 7e6, activoId: "or" }],
  gas: { Hogar: [{ n: "Gastos del hogar", m: 38e6 }, { n: "Colegio", m: 9e6 }] },
  deu: [{ id: "do", n: "Crédito Casa Orlando", mt: 600e6, pg: 7e6, ts: 9, la: "or" }] };
const pinta = (cfg, extra = {}) => { const r = proyectarFuturo10(user, cfg), cuenta = cuentaPorAnio(r, cfg); return renderToString(createElement(PlanTabla, { user, cfg, setCfg: () => {}, r, cuenta, ...extra })).replace(/<!-- -->/g, ""); };

describe("filasDelPlan: una fila por cosa y las sumas cuadran con el motor", () => {
  const cfg = { decisiones: { or: { accion: "termina", desde: 2 } }, nuevas: [{ nombre: "CDT", preset: "rfLargo", monto: 500e6, anio: 2, fuente: "venta", pctRecibe: 100 }] };
  const r = proyectarFuturo10(user, cfg), M = filasDelPlan(r);
  it("cada ingreso de trabajo tiene su fila", () => { expect(M.ing.map((x) => x.nombre)).toEqual(["Salario de Santiago", "Salario de Ana"]); });
  // 26-nov-2026 (Santiago: "solo agarró cesantías; ¿dónde quedó salario Sosa, salario Ana, honorarios?").
  it("los ingresos marcados como «siguen llegando aunque dejes de trabajar» también van en Ingresos, no en Inversiones", () => {
    const u2 = { ...user, ingresos: [{ nombre: "Salario Sosa", categoria: "Salario", mensual: 25e6, rentaPasiva: true }, { nombre: "Salario Ana", categoria: "Salario", mensual: 12e6, rentaPasiva: true }, { nombre: "Honorarios", categoria: "Honorarios", mensual: 8e6, rentaPasiva: true }, { nombre: "Cesantías", categoria: "Salario", mensual: 2e6 }, { nombre: "Renta Puerto Madero", categoria: "Arriendo", mensual: 28e6, activoId: "pm" }] };
    const M2 = filasDelPlan(proyectarFuturo10(u2, {}));
    expect(M2.ing.map((x) => x.nombre).sort()).toEqual(["Cesantías", "Honorarios", "Salario Ana", "Salario Sosa"]);
    expect(M2.ing.find((x) => x.nombre === "Salario Sosa").v[0]).toBeCloseTo(25e6, 0);
    expect(M2.act.some((x) => /Salario|Honorarios/.test(x.nombre))).toBe(false);
    expect(M2.ing.every((x) => x.key)).toBe(true); // todos se pueden terminar en un año
    for (let j = 0; j < 10; j++) expect([...M2.ing, ...M2.act].reduce((s, x) => s + x.v[j], 0)).toBeCloseTo(M2.entra[j], 0);
  });
  it("dos ingresos con el mismo nombre no se mezclan en una fila", () => {
    const u3 = { ...user, ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 25e6 }, { nombre: "Salario", categoria: "Salario", mensual: 12e6 }] };
    const M3 = filasDelPlan(proyectarFuturo10(u3, {}));
    expect(M3.ing.length).toBe(2);
    expect(M3.ing.map((x) => Math.round(x.v[0])).sort((a, b) => a - b)).toEqual([12e6, 25e6]);
  });
  it("ingresos + inversiones = lo que entra; gastos + cuotas = lo que sale; y queda = entra − sale", () => {
    for (let j = 0; j < 10; j++) {
      const entra = [...M.ing, ...M.act].reduce((s, x) => s + x.v[j], 0), sale = [...M.gas, ...M.deu].reduce((s, x) => s + x.v[j], 0);
      expect(entra).toBeCloseTo(M.entra[j], 0); expect(sale).toBeCloseTo(M.sale[j], 0); expect(M.queda[j]).toBeCloseTo(M.entra[j] - M.sale[j], 0);
    }
  });
  it("la inversión nueva tiene su fila y paga desde su año; la vendida deja de pagar", () => {
    const cdt = M.act.find((x) => x.nombre === "CDT"), or = M.act.find((x) => x.id === "or");
    expect(cdt.v[0]).toBe(0); expect(cdt.v[1]).toBeGreaterThan(0);
    expect(or.v[0]).toBeGreaterThan(0); expect(or.v[1]).toBe(0);
  });
  it("las inversiones de hoy siempre tienen fila, aunque no paguen", () => { expect(M.act.some((x) => x.id === "ib")).toBe(true); });
});

describe("PlanTabla: lo que se ve", () => {
  it("abre con la tabla primero, los tres pasos y sin formulario cuando no hay capital", () => {
    const h = pinta({});
    expect(h).toContain("Tu plan en una pantalla");
    expect(h.indexOf("1 · Revisa tu tabla")).toBeLessThan(h.indexOf("2 · Reparte tu capital disponible"));
    expect(h.indexOf("2 · Reparte tu capital disponible")).toBeLessThan(h.indexOf("3 · Mira cómo queda cada año"));
    expect(h).toContain(`En ${Y} no tienes capital disponible para repartir`);
    expect(h).not.toContain("¿Qué haces con esa plata?");
    expect(h).toContain("= Te queda al mes");
    expect(h).toContain("Equivale a");
    expect(h).not.toMatch(/NaN|undefined|\bMM\b|meterle/i);
  });
  it("una venta de hoy deja capital disponible con el monto ya lleno y las opciones de inversión", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } } });
    expect(h).toContain("¿Qué haces con esa plata? Puedes repartirla en varias partes.");
    expect(h).toContain("Usar todo lo que queda de " + Y);
    expect(h).toContain("Crear una inversión nueva");
    expect(h).toContain("Invertirle más dinero a una que ya tienes");
    expect(h).toContain("Pagar una deuda");
    expect(h).toContain("Vendes");
  });
  it("lo ya creado sale numerado y la fila nueva va marcada", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } }, nuevas: [{ nombre: "Bodega", preset: "rfLargo", monto: 300e6, anio: 1, fuente: "venta", pctRecibe: 100 }] });
    expect(h).toContain(`Ya repartiste en ${Y}:`);
    expect(h).toContain("Inversión nueva: Bodega");
    expect(h).toContain("Parte 2: te quedan");
    expect(h).toContain(`Nueva · ${Y}`);
  });
  // 26-nov-2026 (Santiago: "que separe rentas disponibles de lo que queda invertido"; "IBKR sale vacío").
  it("separa las inversiones que pagan al mes de las que se reinvierten, y estas muestran lo que valen", () => {
    const h = pinta({});
    expect(h.indexOf("Inversiones que te pagan al mes")).toBeLessThan(h.indexOf("Inversiones que se reinvierten"));
    const reinv = h.slice(h.indexOf("Inversiones que se reinvierten"), h.indexOf("= Te entra al mes"));
    expect(reinv).toContain("Acciones");
    expect(reinv).toContain("no te paga al mes: lo que rinde se reinvierte");
    expect(reinv).toContain("Vale");
    expect(reinv).not.toContain("Puerto Madero");
  });
  it("en demo no deja cambiar nada", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } } }, { demo: true });
    expect(h).toContain("En modo demo no se pueden hacer cambios.");
    expect(h).not.toContain(">Agregar<");
  });
});

describe("propiedad raíz desde la tabla", () => {
  it("lote y construcción: lo escrito en pesos del año llega al motor en pesos de hoy", () => {
    const f = { prTipo: "lote", nombre: "Bodega", prLote: "430.000.000", prM2: "300", prCostoM2: "2.000.000", prPlazo: "1", prValE: "20", prValA: "", prFinal: "queda", prVendeEn: "0", prRenta: "8.500.000", prRepite: "no", prDestino: "reinvierte" };
    const x = armarPropiedadRaiz(f, 2, 1.04), p = leerPropiedadRaiz(x, 10);
    expect(x.preset).toBe("fincaRaiz"); expect(x.anio).toBe(2);
    expect(p.capital * 1.04).toBeCloseTo(1030e6, -2);
    expect(p.valorEntrega * 1.04).toBeCloseTo(1236e6, -2);
    expect(p.renta * 1.04).toBeCloseTo(8.5e6, -1);
    expect(p.entrega).toBe(3);
  });
});

describe("Mi futuro con la tabla", () => {
  it("con `tabla`, crear un escenario abre la tabla y deja el detalle paso a paso a un toque", () => {
    const h = renderToString(createElement(MiFuturo10, { user, guardado: {}, tabla: true })).replace(/<!-- -->/g, "");
    expect(h).toContain("Tu plan en una pantalla");
    expect(h).toContain("Ver el detalle paso a paso");
    expect(h).not.toContain("1. Lo que tienes");
    expect(h).toContain("Escenario nuevo: cambia algo en la tabla y aquí lo guardas.");
  });
  it("sin `tabla` sigue abriendo los pasos de siempre", () => {
    const h = renderToString(createElement(MiFuturo10, { user, guardado: {} })).replace(/<!-- -->/g, "");
    expect(h).toContain("1. Lo que tienes");
    expect(h).not.toContain("Tu plan en una pantalla");
  });
});
