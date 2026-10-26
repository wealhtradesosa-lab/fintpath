import { describe, it, expect } from "vitest";
import { nivelLibertad, umbralNivel, NIVELES } from "../../src/lib/metrics.js";
import { vistaNivel, estadoNivel, llevaCheck, pctPiso } from "../../src/lib/nivelVista.js";

// Caso de la captura de Luis (24-oct-2026): meta de Independencia
// $123.512.386/mes, ingreso pasivo al 136%.
// 26-oct-2026 — La meta de Abundancia estaba clavada en $160.566.101 (= 1,3×).
// Main subió ese factor a 2×, así que los montos salen ahora de umbralNivel: la
// regla vive en metrics.js y el test no se vuelve a desfasar si cambia.
const ob = 123512386;
const ip = Math.round(ob * 1.36);

describe("nivel de libertad: una sola regla para badge, barra, tarjetas y titular", () => {
  it("las metas de las tarjetas salen de umbralNivel", () => {
    expect(umbralNivel(NIVELES[3], { ob })).toBe(ob);
    expect(Math.round(umbralNivel(NIVELES[4], { ob }))).toBe(Math.round(ob * (NIVELES[4].factor || 1)));
  });
  it("136% con meta de Abundancia en 130% → Abundancia 5/5 en todos lados", () => {
    const nv = nivelLibertad({ ip, ob, fl: 1 });
    expect(nv.nivel).toBe(5);
    const v = vistaNivel({ ip, ob, nivel: nv });
    expect(v.titular).toMatch(/^Estás en Abundancia \(nivel 5\/5\)\. Tu ingreso pasivo cubre el 136\s?% de tus gastos y cuotas: te sobra un 36\s?% cada mes\.$/);
    expect(v.desborde).toMatch(/^\+36\s?% por encima$/);
    expect(v.siguiente).toBeNull();
  });
  it("120% → Independencia y dice cuánto falta para Abundancia", () => {
    const ip2 = Math.round(ob * 1.2);
    const nv = nivelLibertad({ ip: ip2, ob, fl: 1 });
    const v = vistaNivel({ ip: ip2, ob, nivel: nv });
    expect(v.nombre).toBe("Independencia");
    expect(v.siguiente).toBe("Abundancia");
    expect(Math.round(v.faltaSiguiente)).toBe(Math.round(umbralNivel(NIVELES[4], { ob }) - ip2));
    expect(v.titular).not.toMatch(/antes de impuestos/);
  });
  it("debajo de 100% no hay desborde ni «te sobra»", () => {
    const nv = nivelLibertad({ ip: ob * 0.8, ob, obEsencial: ob * 0.5, fl: 1 });
    const v = vistaNivel({ ip: ob * 0.8, ob, nivel: nv });
    expect(v.desborde).toBeNull();
    expect(v.titular).not.toMatch(/te sobra/);
  });
  it("solo una tarjeta es la actual; las de abajo quedan pasadas", () => {
    const est = [1, 2, 3, 4, 5].map((id) => estadoNivel(id, 4));
    expect(est).toEqual(["pasado", "pasado", "pasado", "actual", "pendiente"]);
    expect(est.filter((e) => e === "actual")).toHaveLength(1);
  });
  it("sin datos no hay titular", () => {
    expect(vistaNivel({ ip: 0, ob: 0, nivel: nivelLibertad({}) })).toBeNull();
  });
});

describe("auditoría ingreso pasivo", () => {
  it("salario y venta de activos no cuentan como pasivo", async () => {
    const { tipoIngreso } = await import("../../src/lib/metrics.js");
    expect(tipoIngreso({ categoria: "Salario" })).toBe("activo");
    expect(tipoIngreso({ fiscalCode: "LAB_SALARIO" })).toBe("activo");
    expect(tipoIngreso({ fiscalCode: "CAP_VENTA_ACTIVOS" })).toBe("activo");
    expect(tipoIngreso({ categoria: "Arriendo" })).toBe("pasivo");
    expect(tipoIngreso({ categoria: "Pensión" })).toBe("pasivo");
  });
});

import { leerConfirmados, confirmarRenta } from "../../src/lib/nivelVista.js";
import { posEnBarra, metaNivel, ingresosOcultos, sumaOcultos, TOPE_BARRA } from "../../src/lib/nivelVista.js";
describe("escala de la barra y metas", () => {
  it("la escala llega al factor del último nivel y nada se corta", () => {
    // 26-oct-2026 — Estaba clavado en 1,5 (escala 0–150%), de cuando Abundancia
    // valía 1,3×. El tope sale ahora del último nivel, así que el test comprueba
    // la relación, no el número.
    const factorTope = NIVELES[NIVELES.length - 1].factor || 2;
    expect(TOPE_BARRA).toBe(factorTope);
    expect(posEnBarra(1.36)).toBeGreaterThan(posEnBarra(1.3));
    expect(posEnBarra(factorTope)).toBe(100);
    expect(posEnBarra(factorTope * 1.5)).toBe(100);
    expect(posEnBarra(1)).toBeCloseTo(100 / factorTope, 1);
  });
  it("Estabilidad: meta de flujo ≥ $0; Déficit sin meta; las demás en ingreso pasivo", () => {
    expect(metaNivel(NIVELES[0])).toBeNull();
    expect(metaNivel(NIVELES[1])).toEqual({ tipo: "flujo", monto: 0 });
    expect(metaNivel(NIVELES[4], { ob })).toEqual({ tipo: "pasivo", monto: ob * (NIVELES[4].factor || 1) });
  });
  it("lista los ingresos ocultos con nombre y monto mensual (USD a COP)", () => {
    expect(ingresosOcultos([
      { nombre: "Arriendo X", sim: false, mensual: 5000000 },
      { nombre: "Salario", mensual: 9 },
      { categoria: "Dividendos", sim: false, mensual: 100, moneda: "USD" },
    ], 4000)).toEqual([{ nombre: "Arriendo X", mensual: 5000000, nota: null, revisar: false }, { nombre: "Dividendos", mensual: 400000, nota: null, revisar: false }]);
  });
  it("un anual ya cobrado no sale en $0: total/12 con nota; la suma = total del aviso", () => {
    const l = ingresosOcultos([
      { nombre: "Dividendo anual", sim: false, mensual: 12000000, frecuencia: "anual", mesPago: 3, pagos: { 2026: true } },
      { nombre: "Cupón", sim: false, mensual: 3000000, frecuencia: "trimestral", pagos: { 2026: true } },
      { nombre: "Arriendo", sim: false, mensual: 2000000 },
    ], 4000, 2026);
    expect(l[0]).toEqual({ nombre: "Dividendo anual", mensual: 1000000, nota: "anual, ya cobrado en marzo", revisar: false });
    expect(l[1].mensual).toBe(1000000);
    expect(l[1].nota).toBe("trimestral, ya cobrado este año");
    expect(sumaOcultos(l)).toBe(4000000);
  });
});

describe("registros viejos «Inversión» sin código", () => {
  it("se marcan para revisar y la confirmación se guarda solo con el nombre", () => {
    const l = ingresosOcultos([
      { nombre: "Fondo viejo", categoria: "Inversión", sim: false, mensual: 1 },
      { nombre: "Venta lote", categoria: "Inversión", fiscalCode: "CAP_VENTA_ACTIVOS", sim: false, mensual: 1 },
    ]);
    expect(l.map((x) => x.revisar)).toEqual([true, false]);
    const mem = {}; const store = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
    expect(leerConfirmados(store).has("Fondo viejo")).toBe(false);
    confirmarRenta("Fondo viejo", store);
    expect(leerConfirmados(store).has("Fondo viejo")).toBe(true);
    expect(mem.fp_inversion_confirmada).toBe('["Fondo viejo"]');
  });
});

describe("QA #58: ✓ de Déficit y % redondeado hacia abajo", () => {
  it("Déficit nunca lleva ✓, ni en Abundancia", () => {
    for (const actual of [1, 2, 3, 4, 5]) expect(llevaCheck(1, actual)).toBe(false);
    expect([2, 3, 4].map((id) => llevaCheck(id, 5))).toEqual([true, true, true]);
    expect(llevaCheck(5, 5)).toBe(false);
  });
  it("129,99% dice 129% con nivel Independencia, no 130%", () => {
    const ob2 = 100000000, ip2 = 129990000;
    const nv = nivelLibertad({ ip: ip2, ob: ob2, fl: 1 });
    expect(nv.nivel).toBe(4);
    const v = vistaNivel({ ip: ip2, ob: ob2, nivel: nv });
    expect(v.pct).toBe(129);
    expect(v.titular).toMatch(/cubre el 129\s?%/);
    expect(v.titular).not.toMatch(/130/);
  });
  it("pctPiso: justo en el umbral da el umbral", () => {
    expect(pctPiso(130000000, 100000000)).toBe(130);
    expect(pctPiso(ob * 1.3, ob)).toBe(130);
    expect(pctPiso(99.999, 100)).toBe(99);
    expect(pctPiso(1, 0)).toBe(0);
  });
});
