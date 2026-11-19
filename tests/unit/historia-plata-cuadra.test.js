// 19-nov-2026 (Santiago: "en un tablero me dice que me gasté 600 M de más y en
// otro que me sobran 751.000"). «La historia de tu plata» (paso 2) suma de
// dónde sale y a dónde va con estos campos del motor; deben cuadrar siempre
// que Tu plata diga que no te pasaste. Misma cuenta que HistoriaPlata.jsx.
import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";

const U = () => ({ inflacionPct: 4, inv: [{ id: "pm", n: "Puerto", tp: "Real Estate", va: 1000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 400e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 50e6 }], ingresos: [], gas: { V: [{ n: "x", m: 5e6 }] }, deu: [] });
const cuenta = (cfg) => {
  const r = proyectarFuturo10(U(), cfg), bd = r.bolsaDetalle;
  const ciclosLuego = (r.ciclosDetalle || []).filter((c) => c.capital > 0 && c.desde > 1 && !(c.fuente === "venta" && bd.vendido > 0.5)).reduce((s, c) => s + c.capital, 0);
  const fuentes = r.vendidos.reduce((s, v) => s + v.valor, 0) + (bd.capitalNuevoHoy ?? bd.capitalNuevo) + bd.desdeLiquidez + bd.programadas + bd.pendienteAnio1 + ciclosLuego;
  const destinos = bd.deudas + r.reinversionesDetalle.filter((x) => x.aporte > 0).reduce((s, x) => s + x.aporte, 0)
    + r.nuevasDetalle.filter((x) => x.monto > 0.5).reduce((s, x) => s + x.monto, 0)
    + r.ciclosDetalle.filter((c) => c.capital > 0).reduce((s, c) => s + c.capital, 0) + bd.obras + bd.colchon + bd.restante;
  return fuentes - destinos;
};
const v = { decisiones: { pm: { accion: "vende" } } };
const ciclo = (desde, fuente) => ({ ...v, ciclos: [{ nombre: "A", capital: 300e6, valorFinal: 400e6, meses: 12, desde, fuente }] });

describe("La historia de tu plata cuadra con Tu plata", () => {
  it.each([
    ["solo venta", v],
    ["reinversión año 1", { ...v, reinversiones: [{ activoId: "l", monto: 200e6 }] }],
    ["reinversión año 3 de lo vendido (apartada)", { ...v, reinversiones: [{ activoId: "l", monto: 200e6, anio: 3 }] }],
    ["reinversión año 3 de tus cuentas (se paga ese año)", { ...v, reinversiones: [{ activoId: "l", monto: 200e6, anio: 3, fuente: "liquidez" }] }],
    ["personalizada año 2 de tus cuentas", { ...v, nuevas: [{ preset: "custom", nombre: "X", monto: 300e6, anio: 2, fuente: "liquidez" }] }],
    ["obra del año 1", { decisiones: { pm: { accion: "vende" }, l: { accion: "modifica", inversionMonto: 600e6, inversionAnio: 1 } } }],
    ["negocio que arranca en el año 3 con plata nueva", ciclo(3, "nuevo")],
    ["negocio que arranca en el año 3 de tus cuentas", ciclo(3, "liquidez")],
    ["negocio del año 1", ciclo(1, "venta")],
    ["reinversión año 1 mayor que lo vendido", { ...v, reinversiones: [{ activoId: "l", monto: 1300e6 }] }],
  ])("%s", (_, cfg) => { expect(Math.abs(cuenta(cfg))).toBeLessThan(1); });
});
