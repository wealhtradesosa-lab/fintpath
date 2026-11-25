import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10, patrimonioFinalHoy, anioCal } from "../../src/lib/futuro10.js";
import { Reparto } from "../../src/components/PlanComparador.jsx";
import { fmM } from "../../src/lib/informeTheme.js";

// 24-nov-2026 (Santiago: "esta sección no está bien porque no toma la foto de cómo queda al final de los 10 años sino el primer año,
// entonces todo se ve igual"; "¿debería ser la foto del último año?"). Por defecto, el reparto es el del último año, en pesos de hoy,
// y cada franja termina en el patrimonio neto de su tarjeta.
const texto = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const user = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }, { id: "e", n: "ETF", tp: "ETF", va: 800e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };

describe("«Cómo se reparte el patrimonio» muestra cómo queda al final del plan", () => {
  const r0 = proyectarFuturo10(user, {});
  const r1 = proyectarFuturo10(user, { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "rfCorto", monto: 600e6, fuente: "venta", anio: 1 }] });
  const m = [{ nombre: "Si me quedo como estoy", k: "p0", r: r0, esHoy: true }, { nombre: "Vendo el lote", k: "p1", r: r1 }];
  const html = texto(renderToString(createElement(Reparto, { m })));
  it("por defecto es la foto del último año, con el botón para ver hoy", () => {
    expect(html).toContain(`Cómo queda repartido tu patrimonio en ${anioCal(10)}`);
    expect(html).toContain(`Al final del plan (${anioCal(10)})`);
    expect(html).toContain(`Hoy, después de tus decisiones (${anioCal(1)})`);
    expect(html).not.toContain("justo después de sus decisiones");
  });
  it("cada franja termina en el patrimonio neto de su tarjeta, en pesos de hoy", () => {
    for (const r of [r0, r1]) expect(html).toContain(fmM(Math.round(patrimonioFinalHoy(r))));
    expect(Math.round(patrimonioFinalHoy(r0))).not.toBe(Math.round(patrimonioFinalHoy(r1)));
  });
});
