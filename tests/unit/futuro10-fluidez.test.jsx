import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { proyectarFuturo10, montosAPesosDeHoy, montosANominal, migrarDuplicados, resumenBarra, cuentaPorAnio, inflacionDelPlan } from "../../src/lib/futuro10.js";
import { calcularBase } from "../../src/lib/metrics.js";
import MiFuturo10, { FUENTE_NUEVA, textoObra } from "../../src/components/MiFuturo10.jsx";
import PlanInforme from "../../src/components/PlanInforme.jsx";
import BarraFuturo10 from "../../src/components/BarraFuturo10.jsx";
import HistoriaPlata from "../../src/components/infografia/HistoriaPlata.jsx";

// 24-nov-2026 — PR fluidez de «Mi futuro a 10 años» (Soporte · QA · Finanzas).
const Y = new Date().getFullYear();
const user = {
  inflacionPct: 4,
  inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 900e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }, { id: "a", n: "Apto", tp: "Real Estate", va: 800e6 }, { id: "f", n: "Fondo", tp: "ETF", va: 300e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 30e6 }, { nombre: "Arriendo apto", categoria: "Arriendo", mensual: 4e6, activoId: "a" }],
  gas: { Vida: [{ n: "Mercado", m: 15e6 }] },
};
const plan = (u, c) => resumenBarra(proyectarFuturo10(u, c), proyectarFuturo10(u, { escenario: c.escenario })).plan;
const html = (props) => renderToStaticMarkup(createElement(MiFuturo10, { user, ...props })).replace(/<!-- -->/g, "");

describe("1 · origen por defecto de una inversión nueva", () => {
  it("las nuevas arrancan «De mis cuentas de hoy»", () => { expect(FUENTE_NUEVA).toBe("liquidez"); });
  it("un escenario guardado conserva su origen y su cifra no se mueve", () => {
    // Guardado antes del cambio: sin `fuente` (el motor lo leía «De lo que vendo») y con «venta» explícito.
    const viejo = { decisiones: { l: { accion: "vende" } }, nuevas: [{ preset: "rfCorto", monto: 400e6, anio: 1 }, { preset: "rfCorto", monto: 100e6, anio: 1, fuente: "venta" }] };
    const antes = plan(user, viejo);
    expect(plan(user, viejo)).toBe(antes); // el motor no cambió su default
    const abierto = montosAPesosDeHoy(viejo, user); // lo que hace la pantalla al abrirlo
    expect(abierto.nuevas[0].fuente).toBeUndefined();
    expect(abierto.nuevas[1].fuente).toBe("venta");
    expect(plan(user, abierto)).toBeCloseTo(antes, 0);
    // Una nueva con el default nuevo sí cambia de dónde sale (cambio esperado, solo para escenarios nuevos).
    const nuevo = { ...viejo, nuevas: [{ ...viejo.nuevas[0], fuente: FUENTE_NUEVA }, viejo.nuevas[1]] };
    const r = proyectarFuturo10(user, nuevo);
    expect(r.bolsaDetalle.usos.find((u) => u.monto === 400e6).deVenta).toBe(0);
  });
});

describe("pesos de hoy (Finanzas): todo monto que escribes va en pesos de hoy", () => {
  const nominal = { nuevas: [{ preset: "rfCorto", monto: 200e6, anio: 3, fuente: "liquidez" }], reinversiones: [{ activoId: "a", monto: 100e6, anio: 2, valorAlTerminar: 1200e6, rentaMensual: 6e6, rentaDesdeMes: 24 }],
    futuros: { ingresos: [], gastos: [], activos: [{ nombre: "Casa", clase: "vivienda", valor: 900e6, cuotaInicial: 300e6, anioCuota: 2, entrega: 4, fuentes: [{ id: "f", monto: 150e6 }] }] } };
  it("un escenario viejo (pesos de cada año) abierto en pesos de hoy da la misma cifra", () => {
    const hoy = montosAPesosDeHoy(nominal, user);
    expect(hoy.montosHoy).toBe(true);
    expect(hoy.nuevas[0].monto).toBeCloseTo(200e6 / 1.04 ** 2, 0);
    expect(plan(user, hoy)).toBeCloseTo(plan(user, nominal), 0);
    const ida = montosANominal(hoy, inflacionDelPlan(user, hoy));
    expect(ida.futuros.activos[0].valor).toBeCloseTo(900e6, 0);
    expect(ida.futuros.activos[0].cuotaInicial).toBeCloseTo(300e6, 0);
  });
  it("con montos en pesos de hoy, el motor los lleva al año con la inflación del escenario", () => {
    const cfg = { montosHoy: true, nuevas: [{ preset: "rfCorto", monto: 100e6, anio: 3, fuente: "liquidez" }] };
    const r = proyectarFuturo10(user, cfg);
    expect(r.bolsaDetalle.usos.find((u) => u.anio === 3).monto).toBeCloseTo(100e6 * 1.04 ** 2, 0);
    // y la cuenta del paso 3 lo muestra otra vez en pesos de hoy: lo mismo que escribiste
    const g3 = cuentaPorAnio(r, cfg).find((g) => g.anio === 3);
    expect(g3.salen.find((u) => u.tipo === "C").monto).toBeCloseTo(100e6, 0);
  });
});

describe("2 · se nota que quedó guardado", () => {
  it("con borrador dice «Borrador guardado» (no «Sin guardar»)", () => {
    const h = html({ guardado: { borrador: { nuevas: [{ preset: "rfCorto", monto: 1e6, anio: 1 }] } }, onGuardar: () => {}, pasoInicial: 1 });
    expect(h).toContain("Borrador guardado");
    expect(h).toContain('data-testid="f10-guardado"');
    expect(h).not.toContain("Sin guardar");
    expect(h).not.toContain("cambios sin guardar");
  });
  it("en demo no promete guardar", () => {
    expect(html({ demo: true, guardado: { borrador: { nuevas: [{ preset: "rfCorto", monto: 1e6 }] } }, pasoInicial: 1 })).not.toContain("Borrador guardado");
  });
});

describe("3 y 4 · palabras claras y unidades en cada monto", () => {
  it("paso 1: sin «Liquidez» ni «Fees»; «Acciones y ETF» con un solo nombre", () => {
    const h = html({ pasoInicial: 0 });
    expect(h).toContain("Plata disponible (ahorros y efectivo)");
    expect(h).not.toMatch(/>Liquidez</);
    expect(h).not.toContain("Fees");
    expect(h).not.toContain("Bolsa: acciones y ETF");
  });
  it("canastas, mezcla, informe e historia dicen «Plata disponible», no «Liquidez»", () => {
    const palabra = /(^|[^A-Za-z_])[Ll]iquidez([^A-Za-z_]|$)/;
    const r = proyectarFuturo10(user, {});
    const nombres = r.filas.flatMap((f) => (f.porActivo || []).filter((a) => a.id === "c_liquidez").map((a) => a.nombre));
    expect(nombres.length).toBeGreaterThan(0);
    expect(new Set(nombres)).toEqual(new Set(["Plata disponible"]));
    expect(JSON.stringify(r.destinoSobraLista)).not.toMatch(palabra);
    expect(r.destinoSobra).not.toMatch(palabra);
    expect((r.alertas || []).every((a) => !palabra.test(a.texto || ""))).toBe(true);
    const informe = renderToStaticMarkup(createElement(PlanInforme, { r, inflacionPct: 4 }));
    expect(informe).toContain("Plata disponible");
    expect(informe).not.toMatch(palabra);
    expect(renderToStaticMarkup(createElement(HistoriaPlata, { r }))).not.toMatch(palabra);
    const paso3 = renderToStaticMarkup(createElement(MiFuturo10, { user, guardado: { borrador: {} }, pasoInicial: 3 })).replace(/<!-- -->/g, "");
    expect(paso3).not.toMatch(palabra);
  });
  it("paso 3: cada monto dice una sola vez / pesos de hoy, y nunca «pesos de AAAA»", () => {
    const cfg = { nuevas: [{ preset: "rfCorto", monto: 50e6, anio: 1, fuente: "liquidez" }], reinversiones: [{ activoId: "a", monto: 10e6, anio: 1, fuente: "liquidez", obraAnios: 0 }] };
    const h = renderToStaticMarkup(createElement(MiFuturo10, { user, guardado: { borrador: cfg }, pasoInicial: 2 })).replace(/<!-- -->/g, "");
    expect(h).toContain("¿Cuánto cuesta la obra? ($, una sola vez, pesos de hoy)");
    expect(h).not.toContain("¿Cuánto? ($)");
    expect(h).not.toMatch(/pesos de 20\d\d/);
    expect(h).toContain("Plata disponible");
    expect(h).toContain("Genera ingreso");
  });
  it("paso 2: la compra pide montos en pesos de hoy y su renta trae año de inicio", () => {
    const cfg = { futuros: { ingresos: [], gastos: [], activos: [{ nombre: "Local", clase: "inmueble", valor: 500e6, entrega: 2 }] } };
    const h = renderToStaticMarkup(createElement(MiFuturo10, { user, guardado: { borrador: cfg }, pasoInicial: 1 })).replace(/<!-- -->/g, "");
    expect(h).toContain("¿Cuánto cuesta en total? ($, una sola vez, pesos de hoy)");
    expect(h).toContain("¿Desde qué año renta?");
    expect(h).toMatch(/Te (quedan|faltan) \$[\d.]+ en cuentas (después de|para) este pago/);
  });
});

describe("5 y 7 · Resultado en pesos de hoy y la barra lleva al paso siguiente", () => {
  it("PlanInforme abre en pesos de hoy", () => {
    const r = proyectarFuturo10(user, {});
    const h = renderToStaticMarkup(createElement(PlanInforme, { r, inflacionPct: 4 }));
    expect(h).toMatch(/aria-pressed="true"[^>]*>En pesos de hoy|>En pesos de hoy \(inflación/);
  });
  it("la barra en celular dice «inflación X % al año» y el botón dice el paso siguiente", () => {
    const r = proyectarFuturo10(user, {});
    const h = renderToStaticMarkup(createElement(BarraFuturo10, { rPlan: r, rHoy: r, onIr: () => {}, irTexto: "Siguiente: Lo que viene →" }));
    expect(h).toContain("En pesos de hoy · inflación 4 % al año");
    expect(h).toContain("Siguiente: Lo que viene →");
    expect(h).not.toContain("Ver resultado →");
  });
});

describe("6 · cada dato una vez (migración sin perder datos)", () => {
  it("la valorización de un inmueble puesta al invertirle pasa al paso 1 y la cifra no cambia", () => {
    const cfg = { reinversiones: [{ activoId: "a", monto: 50e6, anio: 1, fuente: "liquidez", valorizacionNomPct: 8 }] };
    const m = migrarDuplicados(cfg, user);
    expect(m.crecHoy.a).toBe(8);
    expect(m.reinversiones[0].valorizacionNomPct).toBeUndefined();
    expect(m.reinversiones[0].monto).toBe(50e6);
    expect(plan(user, m)).toBeCloseTo(plan(user, cfg), 0);
  });
  it("si el paso 1 ya tiene otro %, no se toca nada", () => {
    const cfg = { crecHoy: { a: 5 }, reinversiones: [{ activoId: "a", monto: 50e6, anio: 1, valorizacionNomPct: 8 }] };
    expect(migrarDuplicados(cfg, user)).toBe(cfg);
  });
  it("el paso 1 ya no vuelve a pedir el monto de la obra: muestra el resumen y lleva al paso 3", () => {
    const cfg = { decisiones: { l: { accion: "cambia", desde: 1, mensual: "" } }, reinversiones: [{ activoId: "l", monto: 600e6, anio: 1, fuente: "liquidez", obraAnios: 1, rentaMensual: 20e6, rentaDesdeMes: 12 }] };
    const h = html({ guardado: { borrador: cfg }, pasoInicial: 0 });
    expect(h).toContain('data-testid="f10-obra-linea-l"');
    expect(h).toContain(`lista en ${Y + 1}`);
    expect(h).toContain(`desde ${Y + 1}`);
    expect(h).toContain('data-testid="f10-obra-ir-l"');
    expect(h).not.toContain("¿Cuánto le vas a invertir? ($) — obra");
  });
});

describe("9 · Construir o mejorar (la bodega de Luis)", () => {
  const bodega = { reinversiones: [{ activoId: "l", monto: 600e6, anio: 1, fuente: "liquidez", obraAnios: 1, rentaMensual: 20e6, rentaDesdeMes: 12 }] };
  it("600 M en un año: no renta en el año de la obra; renta desde el año 2", () => {
    const r = proyectarFuturo10(user, bodega), r0 = proyectarFuturo10(user, {});
    const extra = (t) => r.filas[t].rentaNueva - r0.filas[t].rentaNueva;
    expect(extra(1)).toBeCloseTo(0, 0);
    expect(extra(2)).toBeCloseTo(20e6 * 12 * 1.04 ** 2, 0); // pesos de hoy, sube con la inflación
    expect(extra(2) / r.filas[2].deflactor).toBeCloseTo(240e6, 0);
    expect(r.reinversionesDetalle[0].deLiquidez).toBe(600e6); // sale del origen elegido
    expect(r.filas[1].porActivo.find((a) => a.id === "l").valor).toBeGreaterThan(1000e6 + 600e6 - 1); // el lote vale más con la obra
    expect(textoObra(bodega.reinversiones[0])).toContain(`lista en ${Y + 1}`);
  });
  it("el valor nuevo entra el año en que queda lista", () => {
    const c = { reinversiones: [{ ...bodega.reinversiones[0], valorAlTerminar: 2500e6, rentaMensual: "" }] };
    const r = proyectarFuturo10(user, c);
    expect(r.alertas.some((a) => a.tipo === "valorizacion_obra" && a.anio === 2)).toBe(true);
  });
});

describe("10 · Renta pasiva al mes, año por año", () => {
  it("hoy es la misma renta pasiva neta de Nivel de patrimonio, sin sueldo ni valorización", () => {
    const r = proyectarFuturo10(user, {});
    const ip = calcularBase(user, {}).ip;
    expect(ip).toBeGreaterThan(0);
    expect(r.filas[0].rentas / 12).toBeCloseTo(ip, 0);
    const h = renderToStaticMarkup(createElement(PlanInforme, { r, inflacionPct: 4 }));
    expect(h).toContain("Renta pasiva (al mes)");
    expect(h).toContain("Llega a la cuenta (al año)");
    expect(h).toContain("Sobra (al mes, se reinvierte)");
    const celda = h.match(/data-testid="f10-renta-pasiva-0"[^>]*>([^<]+)</)[1];
    expect(celda.replace(/\D/g, "")).toBe(String(Math.round(ip)));
  });
  it("suma la renta de la obra desde que queda lista e intereses que te pagan", () => {
    const cfg = { reinversiones: [{ activoId: "l", monto: 600e6, anio: 1, fuente: "liquidez", obraAnios: 1, rentaMensual: 20e6, rentaDesdeMes: 12 }], nuevas: [{ preset: "rfCorto", monto: 100e6, anio: 1, fuente: "liquidez", pctRecibe: 100 }] };
    const r = proyectarFuturo10(user, cfg), r0 = proyectarFuturo10(user, {});
    const pasivaHoy = (rr, t) => (rr.filas[t].rentas - (rr.filas[t].cicloFlujo || 0)) / 12 / rr.filas[t].deflactor;
    expect(pasivaHoy(r, 1)).toBeGreaterThan(pasivaHoy(r0, 1)); // intereses del CDT que te llegan
    expect(pasivaHoy(r, 2) - pasivaHoy(r0, 2)).toBeGreaterThan(20e6 - 1); // + la renta de la bodega
  });
});
