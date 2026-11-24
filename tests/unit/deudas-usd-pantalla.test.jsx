// 24-nov-2026 — deudas-usd-en-pantalla. La pantalla de Deudas sumaba los USD
// como pesos. Ahora: TRM de hoy para el total y el plan («TRM de hoy: $X»);
// sin tasa, «pendiente de tasa» y la deuda en USD queda fuera del total en
// pesos (nunca 4200). El aviso del año gravable nombra la TRM del 31-dic de ese
// año. Datos de prueba inventados; ninguna cifra es de un usuario real.
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  resumenDeudasPantalla, sumaCOP, etiquetaTrmHoy, avisoDeudasAnoGravable,
  deudasParaPlan, subLineaDeudaUSD, aCOP,
} from "../../src/lib/deudasPantalla.js";
import { TRM_CIERRE_ANO, TRM_PROVISIONAL } from "../../src/lib/trm.js";
import { setRegion } from "../../src/lib/region.js";
import DeudasModule from "../../src/components/DeudasModule.jsx";

const cop = { id: "d1", n: "Crédito", mt: 5_000_000, pg: 500_000, ts: 20 };
const usd = { id: "d2", n: "Tarjeta exterior", mt: 1_000, pg: 100, ts: 24, moneda: "USD" };

describe("total de Deudas: COP + USD convertido", () => {
  it("1.000 USD a TRM 4.000 + 5 M COP → 9 M", () => {
    const r = resumenDeudasPantalla([cop, usd], 4000);
    expect(r.totalCOP).toBe(9_000_000);
    expect(r.pendienteTasa).toBe(false);
    expect(r.tasa).toBe(4000);
  });
  it("moneda en minúscula también se convierte", () => {
    expect(sumaCOP([{ ...usd, moneda: "usd" }], 4000)).toBe(4_000_000);
  });
  it("cuotas en USD también pasan a pesos", () => {
    expect(sumaCOP([cop, usd], 4000, (d) => d.pg)).toBe(500_000 + 400_000);
  });
});

describe("sin TRM: pendiente de tasa, nunca 4200", () => {
  for (const sinTasa of [0, null, undefined, TRM_PROVISIONAL]) {
    it(`trm=${sinTasa} → la deuda en USD queda fuera, ni como pesos ni con 4200`, () => {
      const r = resumenDeudasPantalla([cop, usd], sinTasa);
      expect(r.totalCOP).toBe(5_000_000);
      expect(r.totalCOP).not.toBe(5_000_000 + 1_000);
      expect(r.totalCOP).not.toBe(5_000_000 + 1_000 * 4200);
      expect(r.pendienteTasa).toBe(true);
      expect(r.usdPendiente).toBe(1_000);
      expect(aCOP(usd, usd.mt, sinTasa)).toBeNull();
      expect(subLineaDeudaUSD(usd, sinTasa)).toBe("pendiente de tasa");
      expect(etiquetaTrmHoy(sinTasa)).toBe("TRM de hoy: pendiente de tasa");
      expect(deudasParaPlan([cop, usd], sinTasa)).toEqual([cop]);
    });
  }
  it("con tasa, el plan recibe todas", () => {
    expect(deudasParaPlan([cop, usd], 4000)).toEqual([cop, usd]);
  });
});

describe("«TRM de hoy» del plan de pago", () => {
  it("muestra la tasa con dos decimales", () => {
    expect(etiquetaTrmHoy(4012.5)).toBe("TRM de hoy: $4.012,50");
  });
});

describe("aviso del año gravable", () => {
  it("AG 2026 sin TRM del 31-dic-2026 → nombra 31-dic-2026 y dice pendiente de tasa", () => {
    expect(TRM_CIERRE_ANO[2026]).toBeUndefined();
    const a = avisoDeudasAnoGravable({ trm: 4100 }, 2026);
    expect(a.pendienteTasa).toBe(true);
    expect(a.texto).toContain("AG 2026");
    expect(a.texto).toContain("TRM del 31-dic-2026");
    expect(a.texto).toContain("pendiente de tasa");
    expect(a.texto).not.toContain("2025");
    expect(a.texto).not.toContain("4.100");
  });
  it("cuando la tasa existe (AG 2025) la muestra", () => {
    const a = avisoDeudasAnoGravable({}, 2025);
    expect(a.pendienteTasa).toBe(false);
    expect(a.texto).toContain("TRM del 31-dic-2025 ($3.757,08)");
  });
});

describe("pantalla de Deudas (render)", () => {
  beforeEach(() => setRegion({ idioma: "es", pais: "CO" }));
  const render = (trm) => renderToStaticMarkup(createElement(DeudasModule, {
    deudas: [cop, usd], owners: [], inversiones: [], onUpdate: () => {}, user: { deu: [cop, usd] }, plan: "pro", trm,
  }));
  it("con TRM: total convertido, US$ + equivalente en pesos y «TRM de hoy»", () => {
    const html = render(4000);
    expect(html).toContain("$9.000.000");
    expect(html).toContain("US$1.000");
    expect(html).toContain("≈ $4.000.000");
    expect(html).toContain("TRM de hoy: $4.000,00");
    expect(html).toContain(`TRM del 31-dic-${new Date().getFullYear()}`);
  });
  it("sin TRM: pendiente de tasa y el total es solo pesos", () => {
    const html = render(0);
    expect(html).toContain("TRM de hoy: pendiente de tasa");
    expect(html).toContain("sin tus USD");
    expect(html).not.toContain("$4.200.000");
    expect(html).not.toContain("$5.001.000");
  });
});
