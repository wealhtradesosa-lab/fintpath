import { describe, it, expect } from "vitest";
import { calcularMetricas, nivelLibertad } from "../../src/lib/metrics.js";
import { metricasReales, ingresosOcultos, impuestoBase, etiquetaEscenario, pctPiso } from "../../src/lib/nivelVista.js";

// QA #58 v4 — TRM del nivel real, escenario sin cambios y regla de Déficit.
const usdUser = (trm) => ({
  trm,
  ingresos: [{ nombre: "Renta USA", categoria: "Arriendo", mensual: 1000, moneda: "USD", frecuencia: "mensual" }],
  gastos: { Vivienda: [{ c: "Mercado", m: 5_000_000, frecuencia: "mensual" }] },
  deudas: [], inv: [],
});

describe("nivel real usa la TRM que se le pasa", () => {
  it("convierte USD con la TRM pasada, no con 4200", () => {
    const m = metricasReales(usdUser(undefined), { trm: 3158 });
    expect(m.ip).toBe(3_158_000);
    expect(m.ip).not.toBe(4_200_000);
    expect(m.trm).toBe(3158);
  });
  it("sin TRM: excluye USD y marca pendiente de tasa (nunca 4200)", () => {
    const m = metricasReales(usdUser(undefined), { trm: null });
    expect(m.ip).toBe(0);
    expect(m.trmPendiente).toBe(true);
    const l = ingresosOcultos([{ nombre: "X", mensual: 100, moneda: "USD", sim: false }], null);
    expect(l[0].mensual).toBeNull();
    expect(l[0].nota).toBe("pendiente de tasa");
  });
});

describe("escenario sin cambios = nivel real", () => {
  it("mismo impuesto y mismos datos dan el mismo % y no hay caja", () => {
    const u = { trm: 3158, ingresos: [
      { nombre: "Salario", categoria: "Salario", mensual: 45_000_000, frecuencia: "mensual" },
      { nombre: "Arriendo", categoria: "Arriendo", mensual: 50_000_000, frecuencia: "mensual" }],
      gastos: { Vivienda: [{ c: "Mercado", m: 90_000_000, frecuencia: "mensual" }] }, deudas: [], inv: [] };
    const imp = impuestoBase({ detalle: [{ impBruto: 24_000_000, reteN: 0 }] });
    const real = metricasReales(u, imp);
    const esc = metricasReales(u, imp); // simT con sinCambios usa exactamente esto
    expect(pctPiso(esc.ip, esc.ob)).toBe(pctPiso(real.ip, real.ob));
    expect(etiquetaEscenario(real, esc, false)).toBeNull();
    expect(etiquetaEscenario(real, esc, true)).toBeNull();
  });
});

describe("Déficit solo con flujo negativo (Finanzas)", () => {
  it("99% con flujo positivo no es Déficit; con flujo negativo sí", () => {
    expect(nivelLibertad({ ip: 99, ob: 100, fl: 50 }).nivel).toBe(2);
    expect(nivelLibertad({ ip: 99, ob: 100, fl: -1 }).nivel).toBe(1);
    expect(nivelLibertad({ ip: 100, ob: 100, fl: 0 }).nivel).toBe(4);
    expect(nivelLibertad({ ip: 130, ob: 100, fl: 0 }).nivel).toBe(5);
    expect(nivelLibertad({ ip: 129.99, ob: 100, fl: 0 }).nivel).toBe(4);
  });
});

import { pistaEsenciales, PISTA_ESENCIALES } from "../../src/lib/nivelVista.js";
describe("pista de gastos esenciales", () => {
  it("aparece solo si no hay gastos esenciales marcados", () => {
    expect(pistaEsenciales({ ob: 100, esencialesClasificados: false })).toBe(PISTA_ESENCIALES);
    expect(pistaEsenciales({ ob: 100, esencialesClasificados: true })).toBeNull();
    expect(pistaEsenciales({ ob: 0, esencialesClasificados: false })).toBeNull();
  });
});
