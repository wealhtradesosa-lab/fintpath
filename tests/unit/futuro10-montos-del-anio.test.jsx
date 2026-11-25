import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10, anioCal } from "../../src/lib/futuro10.js";
import { cuentaPorAnio, MovidaEditor, montoHoyQueCabe } from "../../src/components/MiFuturo10.jsx";

// 24-nov-2026 (Santiago: "invierto 600 MM y pone 624 MM"; "Te pasaste $1"). Lo que escribes para un año va en pesos de ese año: es la
// cifra de su cuenta. El plan lo guarda en pesos de hoy, así que lo ya escrito no cambia de valor.
const texto = (html) => html.replace(/<!-- -->/g, "");
const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 1000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 600e6 }, { id: "e", n: "ETF", tp: "ETF", va: 300e6 }], ingresos: [{ nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };

describe("los montos de un año van en pesos de ese año", () => {
  it("una inversión de 2027 que guarda 576.923.077 en pesos de hoy se ve y se escribe como 600.000.000", () => {
    const cfg = { decisiones: { l: { accion: "vende" } }, reinversiones: [{ activoId: "e", monto: 600e6 / 1.04, anio: 2, fuente: "liquidez" }] };
    const r = proyectarFuturo10(u, cfg);
    const html = texto(renderToString(createElement(MovidaEditor, { r, cfg, set: () => {}, refMov: "r0", anio: 2, esc: r.escenario, quedaHoy: 0, factor: 1.04 })));
    expect(html).toContain(`¿Cuánto inviertes? (pesos de ${anioCal(2)})`);
    expect(html).toMatch(/value="600[.,]000[.,]000"/);
    expect(html).not.toContain("pesos de hoy");
    const g = cuentaPorAnio(r, cfg).find((y) => y.anio === 2);
    expect(Math.round(g.movidas.find((m) => m.ref === "r0").monto)).toBe(600000000);
  });
  it("lo que viene lleno con lo que queda deja el año en cero, sin pasarse por un peso", () => {
    const base = { decisiones: { l: { accion: "vende" } } };
    const c0 = cuentaPorAnio(proyectarFuturo10(u, base), base);
    const q = montoHoyQueCabe(c0, 2);
    expect(q).toBeGreaterThan(0);
    const cfg = { ...base, nuevas: [{ preset: "rfCorto", monto: q, fuente: "liquidez", anio: 2 }] };
    const g = cuentaPorAnio(proyectarFuturo10(u, cfg), cfg).find((y) => y.anio === 2);
    expect(g.porInvertir).toBeGreaterThanOrEqual(-1e-6);
    expect(g.porInvertir).toBeLessThan(1);
  });
});
