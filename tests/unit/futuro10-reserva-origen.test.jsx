import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { proyectarFuturo10, anioCal } from "../../src/lib/futuro10.js";
import { cuentaPorAnio, partesReserva, origenReserva, ReservaAnio, SumaCierre } from "../../src/components/MiFuturo10.jsx";
import { plata } from "../../src/lib/region.js";

// 24-nov-2026 (Santiago: "¿me quedan 228 o 292, o una es la suma de la otra?"; "y esos 592, ¿de qué son, de dónde vienen? Cada valor
// debemos entender qué es y de dónde proviene"; "¿me quedó de tu mes 446 MM? Eso es incorrecto: me queda a fin de año").
const texto = (html) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// Su 2029: empieza con 228.000.000 (200.000.000 al terminar 2028, más 14 %), guarda 292.166.737 de su capital y rinde 14 %.
const g2029 = { anio: 4, reservaAntes: 228e6, apartadoAntes: 0, llegan: [], sacasReserva: 0, usoReserva: 0, reservaFin: 228e6 + 292166737, apartadoFin: 0, reservaDeAqui: 292166737, repartoReserva: 0, mesAReserva: false, aReserva: 292166737, libre: 1 };
const g2030 = { anio: 5, reservaAntes: (228e6 + 292166737) * 1.14, apartadoAntes: 0, llegan: [] };

describe("tu reserva de un año es una suma que cuadra exacto", () => {
  it("con las cifras de Santiago: 228.000.000 + 292.166.737 + 72.823.343 = 592.990.080", () => {
    const p = partesReserva(g2029, g2030);
    expect(p.empieza).toBe(228000000);
    expect(p.deCapital).toBe(292166737);
    expect(p.rinde).toBe(72823343);
    expect(p.fin).toBe(592990080);
    expect(p.empieza - p.vuelve - p.sacas - p.uso + p.guardas + p.rinde).toBe(p.fin);
  });
  it("la caja dice qué es cada cifra y de dónde sale, y solo el total va resaltado", () => {
    const html = texto(renderToString(createElement(ReservaAnio, { g: g2029, sig: g2030, cuenta: [g2029, g2030], cfg: { reservaTasaPct: 14 }, set: () => {}, anio: 4, tasaR: "14,0%" })));
    const A = anioCal(4);
    expect(html).toContain(`Tienes al empezar ${A}`);
    expect(html).toContain(`Es lo que tenías al terminar ${A - 1}.`);
    expect(html).toContain(`+ Guardas de tu capital disponible de ${A}`);
    expect(html).toContain(`+ Rinde en ${A} (14,0% al año)`);
    expect(html).toContain(`= Tienes al terminar ${A}`);
    expect(html).toContain(`Con esto empiezas ${A + 1}.`);
    expect(html).toContain(`¿De dónde salen los ${plata(592990080)}?`);
    expect(html).not.toMatch(/Este año \(/);
  });
  it("cada año empieza con lo que terminó el anterior, y el origen desde el inicio del plan suma exacto", () => {
    const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 1000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 600e6 }], ingresos: [{ nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
    const cfg = { decisiones: { l: { accion: "vende" } }, reservaAnual: { 1: 300e6, 4: 100e6 }, usarReserva: { 3: 50e6 }, reservaTasaPct: 14, mesReparto: { 2: [{ tipo: "reserva", mensual: 2e6 }] } };
    const c = cuentaPorAnio(proyectarFuturo10(u, cfg), cfg);
    for (let k = 0; k < c.length - 1; k++) {
      const p = partesReserva(c[k], c[k + 1]), q = partesReserva(c[k + 1], c[k + 2] || null);
      expect(p.empieza - p.vuelve - p.sacas - p.uso + p.guardas + p.rinde).toBe(p.fin);
      expect(q.empieza).toBe(p.fin);
    }
    const o = origenReserva(c, 5), t = o.total;
    expect(o.inicial + t.capital + t.mes + t.otros + t.rinde - t.sacas - t.uso - t.vuelve).toBe(o.fin);
    expect(o.fin).toBe(partesReserva(c[4], c[5]).fin);
    expect(o.capital.map((x) => x.anio)).toEqual([1, 4]);
    expect(o.mes.map((x) => x.anio)).toEqual([2]);
    expect(o.sacas.map((x) => x.anio)).toEqual([3]);
    expect(t.capital).toBeGreaterThan(390e6);
  });
});

describe("el cierre del año dice que lo de tu mes es de todo el año", () => {
  it("«Te sobró en 2029, mes a mes» con su promedio al mes, y lo que pasa a 2030 como capital disponible", () => {
    const g = { ...g2029, disponible: 1000e6, movido: 707833263, movidas: [{ cuenta: true }], mes: 446702716, repartoFuera: 0, flujo: 446702716, queda: 738869453, pasa: 446702716, faltaSinCubrir: 0 };
    const html = texto(renderToString(createElement(SumaCierre, { g, sig: g2030, anio: 4, cf: 446702716 })));
    const A = anioCal(4);
    expect(html).toContain(`+ Te sobró en ${A}, mes a mes`);
    expect(html).toContain(`En promedio, ${plata(37225226)} al mes durante los 12 meses.`);
    expect(html).toContain(`= Pasa a ${A + 1} como capital disponible`);
    expect(html).toContain(plata(446702716));
    expect(html).toContain(`Tienes al terminar ${A}`);
    expect(html).toContain(`Tenías ${plata(228e6)} al empezar ${A}, guardas ${plata(292166737)} y rinde ${plata(72823343)}.`);
    expect(html).not.toMatch(/Te quedó de tu mes/);
  });
});
