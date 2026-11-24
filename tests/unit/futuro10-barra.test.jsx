// 23-nov-2026 — Barra de resultado en vivo («Mi futuro a 10 años», pasos 1 a 3),
// arreglo del resultado inflado (el ahorro contaba como rendimiento) y tarjeta
// del escenario con «Lo que viene». Criterios de Finanzas, Tributario y QA.
// Datos de prueba inventados; ninguna cifra es de un usuario real.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, isValidElement, Children } from "react";
import { proyectarFuturo10, SUPUESTOS_F10, resumenBarra, desglosePatrimonio, rendimientoSinAhorro, loQueVieneDelPlan, hayVenta, hayAlertaLiquidez, aPesosDeHoy, INFLACION_PESOS_HOY_PCT, anioCal } from "../../src/lib/futuro10.js";
import BarraFuturo10 from "../../src/components/BarraFuturo10.jsx";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";
import EscenariosCreados, { mostrarAvisoCalculo, AVISO_CALCULO_HASTA } from "../../src/components/infografia/EscenariosCreados.jsx";

// Supuestos con 5 % de inflación y 4 % real en la cuenta: el caso de Finanzas.
const sup4 = JSON.parse(JSON.stringify(SUPUESTOS_F10));
sup4.presets.rfCorto.realSpread = 4; sup4.presets.rfLargo.realSpread = 4; sup4.presets.rfLargo.topeSpread = 4;
sup4.escenarios.base = { ...sup4.escenarios.base, inflacionPct: 5, ingresosSpread: 0, gastosSpread: 0, retornoSpread: 0, spRealPct: 4 };
const conAhorro = (activos, ahorroAnual) => ({ inflacionPct: 5, inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: activos }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: ahorroAnual / 12 }], gas: {}, deu: [] });

describe("futuro10: el ahorro es aporte, no rendimiento", () => {
  it("100 M en activos, 10 M de ahorro al año y 4 % real → 104 M + 10/1,05 M ≈ 113,5 M en pesos de hoy al año 1 (no 163 M)", () => {
    const r = proyectarFuturo10(conAhorro(100e6, 10e6), { supuestos: sup4 });
    const f1 = r.filas[1];
    const hoy1 = aPesosDeHoy(f1.patrimonio, 1, 5);
    // Activos: 100 M × 1,04 real = 104 M exactos. Ahorro: 10 M en pesos del año 1
    // (convención: el año 1 va a precios de hoy), medido al cierre → 10/1,05.
    expect(aPesosDeHoy(f1.activos - f1.cf, 1, 5)).toBeCloseTo(104e6, -2);
    expect(f1.cf).toBeCloseTo(10e6, -2);
    expect(hoy1).toBeCloseTo(104e6 + 10e6 / 1.05, -2); // 113.523.810
    expect(hoy1).toBeLessThan(120e6); // nunca el 163 M de aplicar el 63,5 %
    expect(desglosePatrimonio(r).despuesDelPlan).toBeCloseTo(hoy1, 0);
  });
  it("el rendimiento anual sale solo de los activos: 4 % real con o sin ahorro", () => {
    const sin = rendimientoSinAhorro(proyectarFuturo10(conAhorro(100e6, 0), { supuestos: sup4 }));
    const con = rendimientoSinAhorro(proyectarFuturo10(conAhorro(100e6, 10e6), { supuestos: sup4 }));
    expect(sin.realPct).toBeCloseTo(4, 1);
    expect(con.realPct).toBeCloseTo(4, 1);
  });
  it("patrimonio chico con mucho ahorro: el rendimiento no se infla (antes salía ~63 % al año)", () => {
    const u = { inflacionPct: 5, inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: 3e6 }, { id: "e", n: "ETF", tp: "ETF", va: 5e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 8e6 }], gas: { Vida: [{ n: "Casa", m: 3e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, {});
    const f = r.filas, fin = f[f.length - 1];
    const cagrViejo = (Math.pow(fin.patrimonio / f[0].patrimonio, 1 / fin.anio) - 1) * 100;
    expect(cagrViejo).toBeGreaterThan(40); // la cuenta vieja
    const rend = rendimientoSinAhorro(r);
    expect(rend.nominalPct).toBeLessThan(15);
    expect(rend.realPct).toBeLessThan(10);
  });
  it("el desglose cuadra: hoy + ahorro + lo que rinden los activos = patrimonio final en pesos de hoy", () => {
    const u = { inflacionPct: 5, inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: 50e6 }, { id: "e", n: "ETF", tp: "ETF", va: 80e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 9e6 }], gas: { Vida: [{ n: "Casa", m: 5e6 }] }, deu: [{ id: "d", n: "Crédito", mt: 20e6, pg: 1e6, ts: 15 }] };
    const r = proyectarFuturo10(u, { futuros: { ingresos: [{ nombre: "Pensión", mensual: 3e6, desde: 6 }], activos: [], gastos: [] } });
    const d = desglosePatrimonio(r);
    expect(d.hoy + d.ahorro + d.rendimientoReal).toBeCloseTo(d.fin, -1);
    expect(d.fin).toBeCloseTo(r.filas[10].patrimonio / Math.pow(1.05, 10), -1);
  });
  it("una pensión de «Lo que viene» es ingreso, no rendimiento de los activos", () => {
    const u = conAhorro(100e6, 0);
    const a = rendimientoSinAhorro(proyectarFuturo10(u, { supuestos: sup4 }));
    const b = rendimientoSinAhorro(proyectarFuturo10(u, { supuestos: sup4, futuros: { ingresos: [{ nombre: "Pensión", mensual: 5e6, desde: 2 }], activos: [], gastos: [] } }));
    expect(b.realPct).toBeCloseTo(a.realPct, 1);
  });
});

const uVenta = { inflacionPct: 5, inv: [{ id: "c", n: "Apartamento", tp: "Real Estate", va: 400e6 }, { id: "a", n: "Cuenta", tp: "Cash", va: 30e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "Gastos", m: 6e6 }] }, deu: [] };

describe("barra en vivo: cifras y reglas", () => {
  const rHoy = proyectarFuturo10(uVenta, {});
  const rVende = proyectarFuturo10(uVenta, { decisiones: { c: { accion: "vende" } } });
  it("las dos cifras del año 10 son patrimonio neto en pesos de hoy al 5 %", () => {
    const b = resumenBarra(rVende, rHoy);
    expect(INFLACION_PESOS_HOY_PCT).toBe(5);
    expect(b.inflacionPct).toBe(5);
    expect(b.anioCalFin).toBe(anioCal(10));
    expect(b.plan).toBeCloseTo(rVende.filas[10].patrimonio / 1.05 ** 10, 0);
    expect(b.quedarme).toBeCloseTo(rHoy.filas[10].patrimonio / 1.05 ** 10, 0);
    expect(b.diferencia).toBeCloseTo(b.plan - b.quedarme, 0);
  });
  it("vender un activo no baja el patrimonio del año 0 (solo pasa a efectivo)", () => {
    expect(rVende.filas[0].patrimonio).toBeCloseTo(rHoy.filas[0].patrimonio, 0);
    expect(resumenBarra(rVende, rHoy).hoy).toBeCloseTo(resumenBarra(rHoy, rHoy).hoy, 0);
    // con una deuda atada al activo vendido, tampoco
    const uD = { ...uVenta, deu: [{ id: "h", n: "Hipoteca", mt: 100e6, pg: 2e6, ts: 12, la: "c" }] };
    expect(proyectarFuturo10(uD, { decisiones: { c: { accion: "vende" } } }).filas[0].patrimonio).toBeCloseTo(proyectarFuturo10(uD, {}).filas[0].patrimonio, 0);
  });
  it("el punto de liquidez usa la misma regla del paso 4", () => {
    const apretado = { inflacionPct: 5, inv: [{ id: "a", tp: "Cash", va: 10e6 }], ingresos: [], gas: { Vida: [{ n: "Mercado", m: 1e6 }] }, deu: [] };
    const r = proyectarFuturo10(apretado, {});
    expect(hayAlertaLiquidez(r)).toBe(r.alertas.length > 0);
    expect(resumenBarra(r, r).alertaLiquidez).toBe(true);
    expect(resumenBarra(rHoy, rHoy).alertaLiquidez).toBe(rHoy.alertas.length > 0);
    const html = renderToStaticMarkup(createElement(BarraFuturo10, { rPlan: r, rHoy: r, onIr: () => {} }));
    expect(html).toContain('data-alerta="si"');
    expect(html).toContain("Hay alertas de liquidez");
  });
});

describe("barra en vivo: render", () => {
  const rHoy = proyectarFuturo10(uVenta, {});
  const rVende = proyectarFuturo10(uVenta, { decisiones: { c: { accion: "vende" } } });
  const rMas = proyectarFuturo10(uVenta, { decisiones: { c: { accion: "vende" } }, nuevas: [{ preset: "sp500", monto: 300e6, anio: 1, fuente: "venta" }] });
  const html = (rPlan) => renderToStaticMarkup(createElement(BarraFuturo10, { rPlan, rHoy, onIr: () => {} }));

  it("rotula la unidad y compara con «Si me quedo como estoy»", () => {
    const h = html(rHoy);
    expect(h).toContain("Patrimonio neto en pesos de hoy (inflación 5 % al año)");
    expect(h).toContain("Si me quedo como estoy");
    expect(h).toContain(`Este escenario en ${anioCal(10)}`);
  });
  it("con venta dice «antes de impuestos de la venta»", () => {
    expect(hayVenta(rVende)).toBe(true);
    expect(html(rVende)).toContain("antes de impuestos de la venta");
  });
  it("sin venta no lo dice", () => {
    expect(hayVenta(rHoy)).toBe(false);
    expect(html(rHoy)).not.toContain("antes de impuestos de la venta");
  });
  it("diferencia en verde si es positiva y en rojo si es negativa", () => {
    expect(resumenBarra(rMas, rHoy).diferencia).toBeGreaterThan(0);
    const pos = rMas;
    const apretar = proyectarFuturo10(uVenta, { futuros: { ingresos: [], activos: [], gastos: [{ nombre: "Viaje", anual: 50e6, desde: 1, anios: 3 }] } });
    expect(resumenBarra(apretar, rHoy).diferencia).toBeLessThan(0);
    const neg = html(apretar);
    expect(neg).toMatch(/data-testid="f10-barra-dif"[^>]*data-signo="neg"/);
    expect(neg).toMatch(/color:#ff5000[^>]*data-testid="f10-barra-dif"/);
    const p = html(pos);
    expect(p).toMatch(/color:#00c805[^>]*data-testid="f10-barra-dif"/);
    expect(p).toMatch(/data-signo="pos"/);
    // sin cambios: diferencia 0 → verde (no es negativa)
    expect(html(rHoy)).toMatch(/color:#00c805[^>]*data-testid="f10-barra-dif"/);
  });
  it("al tocar la barra llama a onIr (MiFuturo10 lleva al paso 4)", () => {
    let llamado = 0;
    const tree = BarraFuturo10({ rPlan: rHoy, rHoy, onIr: () => { llamado++; } });
    const buscar = (el) => { if (!isValidElement(el)) return null; if (el.type === "button") return el; let hit = null; Children.forEach(el.props.children, (c) => { hit = hit || buscar(c); }); return hit; };
    const boton = buscar(tree);
    expect(boton).toBeTruthy();
    expect(boton.props.type).toBe("button");
    boton.props.onClick();
    expect(llamado).toBe(1);
  });
  it("móvil: barra pegada abajo, respeta el borde seguro del celular y se acomoda en pantallas angostas", () => {
    const h = html(rVende);
    expect(h).toContain("position: sticky; bottom: 0");
    expect(h).toContain("env(safe-area-inset-bottom");
    expect(h).toContain("@media (max-width: 599px)");
    expect(h).toContain("touch-action: manipulation");
  });
});

describe("MiFuturo10: la barra sale en los pasos 1 a 3", () => {
  const cfg = { escenario: "base", norte: "equilibrio", decisiones: { c: { accion: "vende" } }, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [], gastos: [] } };
  [0, 1, 2, 3, 4].forEach((paso) => it(`paso ${paso + 1}`, () => {
    const h = renderToStaticMarkup(createElement(MiFuturo10, { user: uVenta, guardado: { borrador: cfg }, pasoInicial: paso }));
    if (paso <= 2) {
      expect(h).toContain('data-testid="f10-barra"');
      expect(h).toContain("antes de impuestos de la venta");
    } else expect(h).not.toContain('data-testid="f10-barra"');
  }));
  it("sin venta, la barra no muestra el rótulo de impuestos", () => {
    const h = renderToStaticMarkup(createElement(MiFuturo10, { user: uVenta, guardado: { borrador: { ...cfg, decisiones: {} } }, pasoInicial: 0 }));
    expect(h).toContain('data-testid="f10-barra"');
    expect(h).not.toContain("antes de impuestos de la venta");
  });
});

describe("tarjeta del escenario", () => {
  const futuros = { ingresos: [], activos: [{ nombre: "Casa", clase: "vivienda", valor: 300e6, entrega: 4 }], gastos: [{ nombre: "Maestría", anual: 60e6, desde: 2, anios: 2 }] };
  const rHoy = proyectarFuturo10(uVenta, {});
  const rPlan = proyectarFuturo10(uVenta, { futuros });
  const rPlanVende = proyectarFuturo10(uVenta, { futuros, decisiones: { c: { accion: "vende" } } });
  const planes = (r) => [{ nombre: "Hoy", esHoy: true, r: rHoy }, { id: "e1", nombre: "Con casa", r }];
  it("lista «Lo que viene» con su año", () => {
    const v = loQueVieneDelPlan(rPlan);
    expect(v.map((x) => x.nombre)).toEqual(["Maestría", "Casa"]);
    expect(v.find((x) => x.nombre === "Casa").anio).toBe(4);
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: planes(rPlan), inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h).toContain('data-testid="f10-card-viene"');
    expect(h).toContain(`Casa · ${anioCal(4)}`);
    expect(h).toContain(`Maestría · ${anioCal(2)}–${anioCal(3)}`);
  });
  it("su costo se resta en el año en que cae", () => {
    const sin = rHoy.filas, con = rPlan.filas;
    expect(con[1].patrimonio).toBeCloseTo(sin[1].patrimonio, 0); // año 1: nada todavía
    expect(con[2].gastoFuturo).toBeGreaterThan(0); // la maestría arranca en el año 2
    expect(con[2].patrimonio).toBeLessThan(sin[2].patrimonio);
    // La casa se paga en el año 4: ese año sale la plata (la casa entra como activo).
    expect(rPlan.pagosFuturos).toEqual([{ nombre: "Casa", anio: 4, monto: 300e6 }]);
    const casa = proyectarFuturo10(uVenta, { futuros: { ...futuros, gastos: [] } }).filas;
    [1, 2, 3].forEach((t) => expect(casa[t].liquidez).toBeCloseTo(sin[t].liquidez, 0)); // antes de 2029 nada
    expect(sin[4].liquidez - casa[4].liquidez).toBeGreaterThan(50e6); // en 2029 sale la plata
    expect(con[4].gastoFuturo).toBe(0); // la maestría ya terminó
  });
  it("cifras en pesos de hoy y rendimiento sin el ahorro", () => {
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: planes(rPlan), inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h).toContain("en pesos de hoy (inflación 5 % al año)");
    expect(h).toContain("Rinden tus activos al año (real, sin tu ahorro)");
    expect(h).toContain('data-testid="f10-card-desglose"');
    expect(h).not.toContain("Crece al año (real)");
  });
  it("con venta: «antes de impuestos de la venta» en la tarjeta", () => {
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: planes(rPlanVende), inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h).toContain('data-testid="f10-card-venta"');
    expect(h).toContain("antes de impuestos de la venta");
  });
  it("sin venta: no aparece", () => {
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: planes(rPlan), inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h).not.toContain("antes de impuestos de la venta");
  });
});

describe("compra de «Lo que viene» (Casa): chequeos de Finanzas", () => {
  const u = { inflacionPct: 5, inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: 500e6 }], ingresos: [{ nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "Gastos", m: 5e6 }] }, deu: [] };
  const fut = { ingresos: [], activos: [{ nombre: "Casa", clase: "vivienda", valor: 300e6, entrega: 4 }], gastos: [] };
  const sin = proyectarFuturo10(u, { supuestos: sup4 });
  const con = proyectarFuturo10(u, { supuestos: sup4, futuros: fut });
  const casa = (t) => (con.filas[t].porActivo || []).find((a) => a.nombre === "Casa");
  it("la compra cambia plata por un activo: el patrimonio no baja el año de la compra", () => {
    expect(con.filas[4].patrimonio).toBeCloseTo(sin.filas[4].patrimonio, -3);
    expect(casa(4).valor).toBeCloseTo(300e6, -3);
  });
  it("desde 2029 esa plata deja de rendir lo de la inversión y la casa se valoriza a su propia tasa", () => {
    const crec = con.futuros.activos[0].crec;
    expect(crec).toBeCloseTo(0.05, 6); // finca raíz: inflación + 0
    expect(casa(5).valor).toBeCloseTo(300e6 * (1 + crec), -3);
    expect(casa(6).valor).toBeCloseTo(300e6 * (1 + crec) ** 2, -3);
    // la brecha contra no comprar crece por la diferencia de tasas (la cuenta rinde 9,2 %, la casa 5 %)
    const brecha = (t) => sin.filas[t].patrimonio - con.filas[t].patrimonio;
    expect(brecha(5)).toBeGreaterThan(0);
    expect(brecha(6)).toBeGreaterThan(brecha(5));
  });
  it("sin datos de gastos de compra ni crédito: no se suman, y la tarjeta lo dice", () => {
    expect(con.filas[4].deuda).toBe(0); // no entra un crédito como pasivo
    const v = loQueVieneDelPlan(con).find((x) => x.tipo === "compra");
    expect(v.sinGastosCompra).toBe(true);
    expect(v.deContado).toBe(true);
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: [{ nombre: "Hoy", esHoy: true, r: sin }, { id: "e", nombre: "Casa", r: con }], inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h).toContain("Supuesto: las compras se pagan de contado y sin gastos de escritura, registro ni impuestos.");
    const h2 = renderToStaticMarkup(createElement(EscenariosCreados, { planes: [{ nombre: "Hoy", esHoy: true, r: sin }, { id: "e", nombre: "Igual", r: sin }], inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    expect(h2).not.toContain("Supuesto: las compras");
  });
});

describe("aviso de Soporte junto a las tarjetas", () => {
  it("sale hasta la fecha del aviso y después no", () => {
    expect(mostrarAvisoCalculo(new Date("2026-11-23T12:00:00Z"))).toBe(true);
    expect(mostrarAvisoCalculo(new Date(AVISO_CALCULO_HASTA + "T12:00:00Z"))).toBe(true);
    expect(mostrarAvisoCalculo(new Date("2027-01-15T12:00:00Z"))).toBe(false);
    expect(mostrarAvisoCalculo(new Date(), null)).toBe(false);
  });
  it("el texto va junto a las tarjetas mientras esté vigente", () => {
    const r = proyectarFuturo10(uVenta, {});
    const h = renderToStaticMarkup(createElement(EscenariosCreados, { planes: [{ nombre: "Hoy", esHoy: true, r }, { id: "e", nombre: "Uno", r }], inflacionPct: 5, onVer: () => {}, onCrear: () => {} }));
    const txt = "Ajustamos el cálculo: ahora tu ahorro se suma aparte y ya no cuenta como rendimiento, por eso la cifra puede verse más baja";
    if (mostrarAvisoCalculo()) expect(h).toContain(txt); else expect(h).not.toContain(txt);
  });
});
