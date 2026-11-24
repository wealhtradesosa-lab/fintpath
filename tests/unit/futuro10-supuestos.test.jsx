// 24-nov-2026 — Copy de supuestos de «Mi futuro a 10 años» (Finanzas).
// Solo textos: cada % dice si es nominal o real y si va antes de impuestos;
// Acciones y ETF aclara que el supuesto es un índice amplio; «¿Cuánto te llega?»
// pasa a hablar de la parte que llega a la cuenta (no es un neto después de
// impuestos: el motor no descuenta impuestos). Los cálculos no cambian.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10, patrimonioFinalHoy, anioCal, retornoNominalPreset, resolverEscenario, SUPUESTOS_F10 } from "../../src/lib/futuro10.js";
import { fmM } from "../../src/lib/informeTheme.js";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";
import BarraFuturo10 from "../../src/components/BarraFuturo10.jsx";
import PlanInforme from "../../src/components/PlanInforme.jsx";

const uVenta = {
  inflacionPct: 4,
  inv: [{ id: "c", n: "Apartamento", tp: "Real Estate", va: 400e6 }, { id: "a", n: "Cuenta", tp: "Cash", va: 30e6 }],
  ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }],
  gas: { Vida: [{ n: "Gastos", m: 6e6 }] },
  deu: [],
};
const futuros = {
  ingresos: [],
  activos: [{ nombre: "Casa", clase: "vivienda", valor: 300e6, entrega: 4 }],
  gastos: [{ nombre: "Maestría", anual: 60e6, desde: 2, anios: 2 }],
};
const cfgRef = { escenario: "base", decisiones: { c: { accion: "vende" } }, futuros };
const htmlPaso = (paso, cfg = cfgRef) => renderToStaticMarkup(createElement(MiFuturo10, { user: uVenta, guardado: { borrador: cfg }, pasoInicial: paso }));

describe("supuestos: la cifra de referencia de la barra no cambia (solo copy)", () => {
  const rHoy = proyectarFuturo10(uVenta, {});
  const r = proyectarFuturo10(uVenta, cfgRef);
  it("2035 en pesos de hoy sigue en $1.096.083.951", () => {
    expect(anioCal(10)).toBe(2035);
    expect(Math.round(patrimonioFinalHoy(r))).toBe(1096083951);
    expect(fmM(patrimonioFinalHoy(r))).toBe("$1.096.083.951");
  });
  it("la barra muestra esa cifra en 2035 y «Si me quedo como estoy» no se mueve", () => {
    const h = renderToStaticMarkup(createElement(BarraFuturo10, { rPlan: r, rHoy, onIr: () => {} }));
    expect(h).toContain('data-testid="f10-barra-plan"');
    expect(h).toContain("$1.096.083.951");
    expect(h).toContain("2035");
    expect(Math.round(patrimonioFinalHoy(rHoy))).toBe(1074718206);
    expect(h).toContain("$1.074.718.206");
  });
});

describe("supuestos: cada % dice qué es", () => {
  it("paso 1: «Su valor sube» del inmueble es nominal y, al 4 %, no gana en pesos de hoy", () => {
    const h = htmlPaso(0);
    expect(h).toContain("Su valor sube");
    expect(h).toContain("nominal; con inflación de 4 %, no gana en pesos de hoy");
    expect(h).toContain("supuesto general, corrígelo");
    expect(h).toMatch(/Su valor sube[\s\S]{0,120}nominal \(incluye la inflación\), antes de impuestos/); // la cuenta rinde por encima de la inflación
  });
  it("paso 2: la valorización de la compra se pide en nominal", () => {
    const h = htmlPaso(1);
    expect(h).toContain("¿Cuánto sube su valor al año, nominal (incluye la inflación)? (%)");
    expect(h).toContain("Es nominal: incluye la inflación.");
    expect(h).toContain("Si el % es igual a la inflación");
    expect(h).toContain("no gana en pesos de hoy");
    expect(h).not.toContain("¿Cuánto sube su valor al año? (%)");
  });
  it("paso 3: el rendimiento de un aporte se pide nominal y antes de impuestos", () => {
    // Las inversiones nuevas salen plegadas; «Invertir en lo que ya tienes» sí muestra los campos.
    const h = htmlPaso(2, { ...cfgRef, reinversiones: [{ activoId: "a", monto: 10e6, anio: 1, fuente: "venta" }] });
    expect(h).toContain("¿Cuánto rinde al año, nominal (incluye la inflación), antes de impuestos? (%)");
    expect(h).toContain("Es nominal: incluye la inflación");
    expect(h).not.toContain("¿Cuánto rinde al año? (%)");
  });
  it("«¿Cuánto te llega?» pasa a «¿Qué parte te llega a la cuenta?» (es la parte que te pagan, no un neto de impuestos)", () => {
    const h = htmlPaso(2, { ...cfgRef, reinversiones: [{ activoId: "a", monto: 10e6, anio: 1, fuente: "venta" }] });
    expect(h).toContain("De lo que rinde, ¿qué parte te llega a la cuenta?");
    expect(h).toContain("Es la parte del rendimiento que te pagan; el resto se reinvierte y crece. Este plan no descuenta impuestos.");
    expect(h).not.toContain("¿Cuánto te llega?");
  });
  it("en el código, la inversión nueva (plegada al abrir) pide el mismo % nominal", () => {
    const src = readFileSync(new URL("../../src/components/MiFuturo10.jsx", import.meta.url), "utf8");
    expect(src).toContain("Rendimiento al año, nominal (incluye la inflación), antes de impuestos (%)");
    expect(src).toContain("¿Qué parte te llega a la cuenta?");
    expect(src).not.toContain("tx(\"Rendimiento anual (%)\"");
    expect(src).not.toContain("tx(\"¿Cuánto te llega?\"");
  });
});

describe("supuestos: Acciones y ETF es un índice amplio", () => {
  it("en la tabla de supuestos: real, nominal y que no es de acciones sueltas", () => {
    const h = htmlPaso(2);
    expect(h).toContain("Acciones y ETF");
    expect(h).toContain("El supuesto es el de un índice amplio y diversificado, no de acciones sueltas.");
    const esc = resolverEscenario("base", uVenta);
    const nom = retornoNominalPreset("sp500", esc);
    expect(nom).toBeCloseTo(10.76, 2);
    expect(h).toContain("6,5% real al año, antes de impuestos");
    expect(h).toContain("10,8% nominal (incluye la inflación)");
  });
  it("al elegir Acciones y ETF, el formulario lo vuelve a decir", () => {
    const src = readFileSync(new URL("../../src/components/MiFuturo10.jsx", import.meta.url), "utf8");
    expect(src).toContain("El rendimiento por defecto de Acciones y ETF supone un índice amplio y diversificado, no acciones sueltas.");
  });
});

describe("supuestos: el informe nombra nominal y real sin cambiar la cifra", () => {
  const r = proyectarFuturo10(uVenta, cfgRef);
  it("la ficha de rendimiento y el veredicto aclaran el %", () => {
    const h = renderToStaticMarkup(createElement(PlanInforme, { r, nombre: "Plan", inflacionPct: 4 }));
    expect(h).toContain("al año, nominal (incluye la inflación), antes de impuestos, sobre lo que tienes");
    expect(h).toContain("nominal (incluye la inflación), antes de impuestos, sin contar tu ahorro");
    expect(h).toContain('data-testid="f10-veredicto-fin"');
    expect(h).toContain("$1.096.083.951");
    expect(h).not.toContain("anual, sobre lo que tienes");
  });
});

describe("supuestos: con rendimiento = inflación, el año 10 en pesos de hoy (Finanzas)", () => {
  // Finanzas (24-nov-2026): con rendimiento igual a la inflación y flujo libre F
  // por año, el patrimonio del año 10 en pesos de hoy debería dar unos 10×F.
  // Hoy no se cumple: los flujos se deflactan con (1+i)^(t−1) y el patrimonio
  // al cierre con (1+i)^t, así que se descuenta un año de más. Con i = 4 % y
  // F = $10.000.000 el valor actual es $96.153.846,15 (exactamente 10×F / 1,04),
  // unos 3,85 % por debajo de 10×F. No se cambia el cálculo en este PR (solo copy).
  it.skip("con rendimiento igual a la inflación y flujo libre F, el año 10 en pesos de hoy da unos 10×F", () => {
    const F = 10e6;
    const inf = 4;
    const u = {
      inflacionPct: inf,
      inv: [],
      ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: F / 12 }],
      gas: {},
      deu: [],
    };
    const supuestos = {
      ...SUPUESTOS_F10,
      escenarios: {
        ...SUPUESTOS_F10.escenarios,
        base: { ...SUPUESTOS_F10.escenarios.base, ingresosSpread: 0, gastosSpread: 0, retornoSpread: 0, spRealPct: 0 },
      },
      presets: {
        ...SUPUESTOS_F10.presets,
        rfCorto: { ...SUPUESTOS_F10.presets.rfCorto, realSpread: 0 },
        rfLargo: { ...SUPUESTOS_F10.presets.rfLargo, realSpread: 0, topeSpread: 0 },
      },
    };
    const r = proyectarFuturo10(u, { escenario: "base", supuestos });
    const hoy = patrimonioFinalHoy(r);
    // Valor actual con el cálculo vigente: 96_153_846.153... === 10×F / 1,04
    expect(hoy).toBeCloseTo(10 * F, 0);
  });
});
