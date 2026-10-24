import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";

// 24-oct-2026: «Tu plata» se cayó en producción (PARTES is not defined) con una
// inversión personalizada. Cada paso se abre con una configuración completa.
const user = { inflacionPct: 4, trm: 4000,
  inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 8700e6 }, { id: "lote", n: "Lote", tp: "Lote", va: 410e6 }, { id: "ibkr", n: "IBKR", tp: "ETF", va: 126e6 }, { id: "c", n: "Cash", tp: "Cash", va: 40e6 }],
  ingresos: [{ nombre: "Arriendo PM", categoria: "Arriendo", mensual: 47e6, activoId: "pm" }], gas: { Vida: [{ n: "Familia", m: 21e6 }] },
  deu: [{ id: "sl", n: "Saldo local", mt: 437e6, pg: 0, ts: 0, tipoInteres: "sin_interes" }, { id: "f", n: "Ford", mt: 157e6, pg: 4.5e6, ts: 20 }] };
const cfg = { escenario: "base", norte: "equilibrio", decisiones: { pm: { accion: "vende" }, lote: { accion: "modifica", inversionMonto: 600e6, rentaNuevaMensual: 8e6 } }, pagarDeudas: { f: true },
  nuevas: [{ preset: "custom", nombre: "BTG", monto: 5000e6, anio: 1, rendimientoNomPct: 10.5, pctRecibe: 100 }, { preset: "rfCorto", monto: 100e6, fuente: "nuevo" }, { preset: "custom", nombre: "Viejo", monto: "1.000.000", tipo: "valoriza" }],
  reinversiones: [{ activoId: "ibkr", monto: 1500e6, rendimientoNomPct: 20, pctRecibe: 25 }, { activoId: "noexiste", monto: 1 }],
  futuros: { ingresos: [{ nombre: "Pensión", mensual: 24e6, desde: 5, hasta: "" }], activos: [{ nombre: "Local", clase: "inmueble", valor: 800e6, cuotaInicial: 200e6, entrega: 2, rentaMensual: 5e6 }], gastos: [{ nombre: "Universidad", anual: 180e6, desde: 3, anios: 4 }] } };

describe("Mi futuro a 10: cada paso abre sin errores", () => {
  [0, 1, 2, 3, 4].forEach((paso) => it(`paso ${paso + 1}`, () => {
    const html = renderToString(createElement(MiFuturo10, { user, guardado: { borrador: cfg, escenarios: [{ id: "e1", nombre: "Uno", config: cfg }] }, pasoInicial: paso }));
    expect(html.length).toBeGreaterThan(1000);
  }));
});
