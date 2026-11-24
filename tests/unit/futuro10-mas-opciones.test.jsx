import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { MovidaEditor } from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { miles } from "../../src/lib/region.js";

// 24-nov-2026 (Santiago: "este botón de más opciones no está habilitado"). «Más opciones» abría otro panel más arriba,
// fuera de la vista. Ahora todo se abre en la fila de la movida, y la propiedad raíz trae su formulario ahí mismo.
const user = { inflacionPct: 4, trm: 4000, inv: [{ id: "ibkr", n: "IBKR", tp: "ETF", va: 126e6 }, { id: "c", n: "Cash", tp: "Cash", va: 40e6 }], ingresos: [], gas: { Vida: [{ n: "Familia", m: 10e6 }] }, deu: [] };
const base = { escenario: "base", norte: "equilibrio", decisiones: {}, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [], gastos: [] } };
const pintar = (cfg, refMov, anio) => {
  const r = proyectarFuturo10(user, cfg);
  return renderToString(createElement(MovidaEditor, { r, cfg, set: () => {}, refMov, anio, esc: r.escenario, quedaHoy: 0 }));
};

describe("«Más opciones» se abre en la fila de la movida", () => {
  it("un aporte muestra «Más opciones», con lo de más recogido hasta que se abre", () => {
    const cfg = { ...base, reinversiones: [{ activoId: "ibkr", monto: 300e6, anio: 3, fuente: "liquidez" }] };
    const html = pintar(cfg, "r0", 3);
    expect(html).toMatch(/Más opciones/);
    expect(html).toMatch(/¿Cuánto inviertes\?/);
    expect(html).not.toMatch(/¿Cuándo\?/);
  });
  it("una inversión nueva muestra «Más opciones»", () => {
    const cfg = { ...base, nuevas: [{ preset: "rfCorto", monto: 200e6, anio: 2, fuente: "liquidez" }] };
    expect(pintar(cfg, "n0", 2)).toMatch(/Más opciones/);
  });
  it("la propiedad raíz trae su formulario completo en su fila", () => {
    const cfg = { ...base, nuevas: [{ preset: "fincaRaiz", anio: 2, fuente: "liquidez", pr: { tipo: "planos", final: "vende", cuotaPct: 30, plazo: 2, valEntregaPct: 20, valAnualPct: 6, valor: 900e6 } }] };
    const html = pintar(cfg, "n0", 2);
    ["Compra en planos", "Lote y construcción", "Proyecto asociativo", "Construir para rentar", "¿Cuándo empieza?"].forEach((t) => expect(html).toContain(t));
    expect(html).not.toMatch(/Ver sus opciones/);
  });
});

describe("cifras: un resto de menos de un peso no sale como «$-0»", () => {
  it("miles(-0,4) se escribe 0", () => {
    expect(miles(-0.4)).toBe(miles(0));
    expect(miles(-0.4)).not.toMatch(/-/);
    expect(miles(-1234)).toMatch(/1.234/);
  });
});

// 24-nov-2026 (Santiago: "me sale que la plata está en un asociativo pero no me deja quitar ni cambiar"). Un proyecto que se vende y
// se repite trae en cada vuelta la referencia a su inversión, para poder editarlo y quitarlo en el año en que aparece.
import { cuentaPorAnio } from "../../src/lib/futuro10.js";
describe("las vueltas de un proyecto asociativo se pueden editar y quitar", () => {
  it("cada vuelta del proyecto lleva la referencia a su inversión nueva", () => {
    const cfg = { ...base, nuevas: [{ preset: "fincaRaiz", anio: 2, fuente: "liquidez", pr: { tipo: "asociativo", valor: 100e6, valorFinal: 130e6, meses: 12, final: "vende", repite: true } }] };
    const r = proyectarFuturo10(user, cfg);
    const c = cuentaPorAnio(r, cfg);
    const conProyecto = c.filter((y) => y.movidas.some((m) => /asociativo/i.test(m.nombre)));
    expect(conProyecto.length).toBeGreaterThan(0);
    conProyecto.forEach((y) => y.movidas.filter((m) => /asociativo/i.test(m.nombre)).forEach((m) => expect(m.ref).toBe("n0")));
  });
});
