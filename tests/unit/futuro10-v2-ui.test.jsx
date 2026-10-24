import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import MiFuturo10, { LoQueViene, Obra, agruparAlertas, ESTADO_GUARDADO, TablaSupuestos, RendimientoPreset } from "../../src/components/MiFuturo10.jsx";
import { resolverEscenario, estimadoPreset, retornoNominalPreset, proyectarFuturo10, SUPUESTOS_F10 } from "../../src/lib/futuro10.js";

const txt = (h) => h.replace(/<!-- -->/g, "");
const esc = resolverEscenario("base", { inflacionPct: 5 });
const user = { inflacionPct: 5, inv: [{ id: "l", n: "Lote", tp: "Real Estate", va: 300e6 }], ingresos: [], gas: {}, deu: [] };

describe("Mi futuro a 10 v2 · pantalla", () => {
  it("«Lo que viene»: ingresos primero, tipos nuevos y aviso de pensión con «Mover a Ingresos futuros»", () => {
    const cfg = { futuros: { ingresos: [], activos: [{ nombre: "Pensión Colpensiones", clase: "otro", valor: 1e8, entrega: 3 }] } };
    const h = txt(renderToString(<LoQueViene cfg={cfg} set={() => {}} esc={esc} owners={[]} />));
    expect(h.indexOf("Ingresos futuros")).toBeLessThan(h.indexOf("Activos futuros"));
    expect(h).toContain("arriendo con contrato");
    ["Finca raíz", "Local / comercial", "Lote", "Negocio", "Inversión financiera", "Vehículo", "Otro"].forEach((t) => expect(h).toContain(t));
    expect(h).toContain("Mover a Ingresos futuros");
    const sin = txt(renderToString(<LoQueViene cfg={{ futuros: { activos: [{ nombre: "Apto", clase: "inmueble", valor: 1e8 }] } }} set={() => {}} esc={esc} owners={[]} />));
    expect(sin).not.toContain("Mover a Ingresos futuros");
  });

  it("«Construir o mejorar» muestra inversión por año, año lista, renta, valor estimado y tipo", () => {
    const h = txt(renderToString(<Obra a={user.inv[0]} d={{ accion: "construye", obra: { inversiones: [{ monto: 100e6, anio: 2 }] } }} setD={() => {}} />));
    ["¿En qué año queda lista?", "Renta neta al mes desde ese año", "Valor estimado cuando quede lista", "¿Cambia el tipo de activo?", "$400.000.000"].forEach((t) => expect(h).toContain(t));
    const dec = txt(renderToString(<MiFuturo10 user={user} pasoInicial={1} />));
    expect(dec).toContain("Construir o mejorar");
    expect(dec).not.toContain("Se modifica");
  });

  it("Resultado: columna Renta pasiva/mes, nota del Simulador y sin «Reinvertir en lo que ya tienes»", () => {
    const h = txt(renderToString(<MiFuturo10 user={user} pasoInicial={3} />));
    expect(h).toContain("Renta pasiva/mes*");
    expect(h).toContain("Patrimonio (hoy)*");
    expect(h).toContain("no coincide con el Simulador");
    expect(txt(renderToString(<MiFuturo10 user={user} pasoInicial={2} />))).not.toContain("Reinvertir en lo que ya tienes");
  });

  it("borrador: retoma el mismo paso con los mismos datos; en demo no", () => {
    const guardado = { borrador: { paso: 3, cfg: { escenario: "pesimista", decisiones: { l: { accion: "vende", anioVenta: 2 } } } } };
    const h = txt(renderToString(<MiFuturo10 user={user} guardado={guardado} />));
    expect(h).toContain("Resultado a 10 años");
    expect(h).toMatch(/inflación 7(,0)?%/);
    const d = txt(renderToString(<MiFuturo10 user={user} guardado={guardado} demo />));
    expect(d).not.toContain("Resultado a 10 años");
    expect(Object.values(ESTADO_GUARDADO)).toEqual(["Guardando…", "Guardado hace un momento", "Sin conexión, se guarda al volver"]);
  });

  it("alertas agrupadas y supuestos con fuente y fecha, sin «validados por Finanzas»", () => {
    const g = agruparAlertas([{ tipo: "faltante", texto: "a" }, { tipo: "tasa_estimada", texto: "b" }, { tipo: "faltante", texto: "c" }]);
    expect(g.map((x) => x[0])).toEqual(["Plata que falta", "Revisa tus datos"]);
    const h = txt(renderToString(<TablaSupuestos esc={esc} />));
    expect(h).toContain("Fuente:");
    expect(h).toContain("valor manual");
    expect(h).toContain("ajustado a valuaciones actuales");
    expect(h.toLowerCase()).not.toContain("validado");
    expect(txt(renderToString(<TablaSupuestos esc={esc} mercado={{ ipc: { pct: 5.1, fuente: "BanRep", fecha: "sep-2026" } }} />))).toContain("BanRep, sep-2026");
  });
});

describe("Inversión predefinida: rendimiento estimado prellenado", () => {
  it("cada preset muestra un % nominal del escenario con fuente; nunca vacío", () => {
    for (const e of ["pesimista", "base", "optimista"]) {
      const es = resolverEscenario(e, { inflacionPct: 5 });
      Object.keys(SUPUESTOS_F10.presets).forEach((k) => {
        const est = estimadoPreset(k, es);
        expect(est.pct).toBeCloseTo(retornoNominalPreset(k, es), 1);
        expect(est.fuente.length).toBeGreaterThan(5);
        const h = txt(renderToString(<RendimientoPreset x={{ preset: k, monto: 1e6 }} esc={es} up={() => {}} />));
        expect(h).toMatch(new RegExp(`value="${String(est.pct).replace(".", "\\.")}|value="${String(est.pct).replace(".", ",")}`));
        expect(h).toContain("Fuente:");
        expect(h).not.toContain("restaurar estimado");
      });
    }
    expect(estimadoPreset("rfCorto", resolverEscenario("pesimista", {})).pct).not.toBe(estimadoPreset("rfCorto", resolverEscenario("optimista", {})).pct);
  });
  it("si el usuario lo edita se respeta, el motor lo usa y aparece «restaurar estimado»", () => {
    const h = txt(renderToString(<RendimientoPreset x={{ preset: "rfLargo", rendimientoNomPct: 12 }} esc={esc} up={() => {}} />));
    expect(h).toContain("restaurar estimado");
    expect(h).toMatch(/value="12"/);
    const u = { inflacionPct: 5, inv: [{ id: "c", n: "Apto", tp: "Real Estate", va: 300e6 }], ingresos: [], gas: {}, deu: [] };
    const cfg = (x) => ({ decisiones: { c: { accion: "vende", anioVenta: 1 } }, mezcla: { liquidez: 100, renta: 0, crecimiento: 0 }, nuevas: [{ preset: "rfLargo", monto: 100e6, ...x }] });
    const est = proyectarFuturo10(u, cfg({}));
    const vacio = proyectarFuturo10(u, cfg({ rendimientoNomPct: "" }));
    const mio = proyectarFuturo10(u, cfg({ rendimientoNomPct: 20 }));
    expect(vacio.final.patrimonio).toBeCloseTo(est.final.patrimonio, 0);
    expect(mio.final.patrimonio).toBeGreaterThan(est.final.patrimonio);
  });
});

import { CampoRendimiento, BarraReinvertir, InversionesNuevas } from "../../src/components/MiFuturo10.jsx";
import { resumenReinvertir, tasaDeuda } from "../../src/lib/futuro10.js";

describe("Bug BTG Pactual: inversión nueva más grande que la plata disponible", () => {
  const u = { inflacionPct: 5, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 200e6 }], ingresos: [{ nombre: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "x", m: 8e6 }] }, deu: [] };
  const btg = { preset: "custom", nombre: "BTG Pactual", monto: 6.5e9, rendimientoNomPct: 14, anio: 1, tipo: "renta" };
  it("aparece en Resultado con su línea, su renta y su valor a 10 años, y alerta roja «te faltan»", () => {
    const sin = proyectarFuturo10(u, {}), r = proyectarFuturo10(u, { nuevas: [btg] });
    const d = r.nuevasDetalle.find((x) => x.nombre === "BTG Pactual");
    expect(d).toBeTruthy();
    expect(d.monto).toBe(6.5e9);
    expect(d.faltante).toBeCloseTo(6.5e9 - r.disponible[0].antesDeAsignar, 0); // faltante = monto − disponible del año
    expect(d.rentaMensual).toBeGreaterThan(0);
    // «Paga renta»: el 14% es NOMINAL sobre el capital; el capital queda nominal y se erosiona en pesos de hoy.
    expect(d.valorFinal).toBeCloseTo(6.5e9 / 1.05 ** 10, -6);
    expect(r.filas[1].rentaPasivaReal - sin.filas[1].rentaPasivaReal).toBeCloseTo(r.nuevasDetalle[0].rentaMensualFondeada * 12, -6); // año 1: solo la parte con plata
    expect(r.filas[2].rentaPasivaReal - sin.filas[2].rentaPasivaReal).toBeCloseTo(r.nuevasDetalle[0].rentaMensualFondeada * 12 / 1.05, -6);
    const a = r.alertas.find((x) => x.tipo === "nueva_sin_plata");
    expect(a.texto).toMatch(/BTG Pactual: te faltan \$/);
    const h = txt(renderToString(<InversionesNuevas items={r.nuevasDetalle} />));
    expect(h).toContain("BTG Pactual"); expect(h).toMatch(/Faltan \$[\d.]+ para BTG Pactual\. Quedaron invertidos \$[\d.]+; esa parte renta \$[\d.]+\/mes\./); expect(h).toContain("Valor a 10 años");
  });
  it("una predefinida más grande que lo disponible no se recorta", () => {
    const r = proyectarFuturo10(u, { nuevas: [{ preset: "rfLargo", monto: 5e9 }] });
    const d = r.nuevasDetalle[0];
    expect(d.monto).toBe(5e9); expect(d.faltante).toBeGreaterThan(0);
    expect(r.alertas.some((x) => x.tipo === "nueva_sin_plata")).toBe(true);
  });
});

describe("Campo de rendimiento prellenado", () => {
  it("«X% anual antes de impuestos», «Estimado…», sin NaN, restaurar cuando se edita", () => {
    const h = txt(renderToString(<CampoRendimiento estimado={7.625} value="" onChange={() => {}} fuente="F" />));
    expect(h).toContain("7,6% anual antes de impuestos"); expect(h).toContain("Estimado. Si tienes una tasa real, ponla.");
    expect(h).not.toContain("NaN"); expect(h).not.toContain("restaurar");
    const h2 = txt(renderToString(<CampoRendimiento estimado={7.6} value={NaN} onChange={() => {}} />));
    expect(h2).not.toContain("NaN");
    const h3 = txt(renderToString(<CampoRendimiento estimado={7.6} value={11} onChange={() => {}} />));
    expect(h3).toMatch(/11(,0)?% anual antes de impuestos/); expect(h3).toContain("restaurar estimado");
  });
  it("cripto: 0% real, sin supuesto, aviso de volatilidad", () => {
    const h = txt(renderToString(<MiFuturo10 user={{ inflacionPct: 5, inv: [{ id: "b", n: "Bitcoin", tp: "Crypto", va: 50e6 }], ingresos: [], gas: {}, deu: [] }} />));
    expect(h).toContain("sin supuesto de valorización, ajústalo");
    expect(h).toContain("muy volátiles");
    expect(h).toMatch(/>5(,0)?% anual antes de impuestos/); // = inflación, 0% real
  });
  it("renta fija corto en el escenario base sale del supuesto (inflación 5%), sin valores fijos", () => {
    expect(estimadoPreset("rfCorto", resolverEscenario("base", {})).pct).toBe(7.5); // 5 + 2,5, suma simple
  });
});

describe("Barra de Reinvierte y tasa UVR", () => {
  it("disponible = ventas + caja; te queda = disponible − asignado", () => {
    const u = { inflacionPct: 5, inv: [{ id: "c", n: "Apto", tp: "Real Estate", va: 300e6 }], ingresos: [], gas: {}, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { c: { accion: "vende", anioVenta: 1 } }, nuevas: [{ preset: "rfLargo", monto: 400e6 }] });
    const b = resumenReinvertir(r.disponible);
    expect(b.deVentas).toBe(300e6);
    expect(b.disponible).toBeCloseTo(b.deVentas + b.deCaja, 2);
    expect(b.queda).toBeCloseTo(b.disponible - b.asignado, 2);
    expect(b.queda).toBeLessThan(0);
    const h = txt(renderToString(<BarraReinvertir disponible={r.disponible} />));
    expect(h).toMatch(/Tienes \$[\d.]+ para invertir/); expect(h).toMatch(/Te faltan \$/); expect(h).toContain("de ventas"); expect(h).toContain("de tu caja"); expect(h).toContain("position:sticky");
    expect(h).toContain("no incluye costos de venta ni impuestos");
  });
  it("UVR: 8,95% real, Superfinanciera vía agregador, 25-sep-2026", () => {
    const t = tasaDeuda({ tp: "Mortgage" }, { uvr: true });
    expect(t.pct).toBe(8.95); expect(t.fecha).toBe("25-sep-2026"); expect(t.fuente).toMatch(/vía agregador/);
    expect(t.etiqueta).toContain("Es un promedio, no tu tasa.");
  });
});

import { SIN_PLATA_ANIO } from "../../src/components/MiFuturo10.jsx";
describe("Disponible del paso 3 (datos tipo QA Pro)", () => {
  const qa = { inflacionPct: 5, inv: [{ id: "cdt", n: "CDT", tp: "CDT", va: 300e6 }, { id: "apto", n: "Apto", tp: "Real Estate", va: 800e6 }],
    ingresos: [{ nombre: "Salario", mensual: 25e6 }], gas: { Vida: [{ n: "Gastos", m: 10e6 }] }, deu: [] };
  it("sin ventas: liquidez sobre el colchón + flujo, no 0; fórmula por año", () => {
    const r = proyectarFuturo10(qa, {});
    const d1 = r.disponible[0];
    expect(d1.ventas).toBe(0);
    expect(d1.antesDeAsignar).toBeGreaterThan(0);
    r.disponible.forEach((d) => expect(d.antesDeAsignar).toBeCloseTo(d.liquidezHoy + d.ventas - d.colchon + d.flujo - d.adicionales - d.pagosFuturos, 2));
    expect(d1.liquidezHoy).toBeCloseTo(Math.max(0, 300e6 - r.metaColchon), 0);
    const b = resumenReinvertir(r.disponible);
    expect(b.disponible).toBeGreaterThan(0);
    expect(b.disponible).toBeCloseTo(r.disponible.reduce((s, d) => s + d.antesDeAsignar, 0), 0);
  });
  it("con venta y Construir o mejorar: ventas brutas suman y lo comprometido resta", () => {
    const r = proyectarFuturo10(qa, { decisiones: { apto: { accion: "vende", anioVenta: 1 } } });
    const r2 = proyectarFuturo10({ ...qa, inv: [...qa.inv, { id: "lote", n: "Lote", tp: "Real Estate", va: 100e6 }] }, { decisiones: { apto: { accion: "vende", anioVenta: 1 }, lote: { accion: "construye", obra: { inversiones: [{ monto: 200e6, anio: 1 }], anioLista: 2 } } } });
    expect(resumenReinvertir(r.disponible).deVentas).toBe(800e6);
    expect(resumenReinvertir(r2.disponible).comprometido).toBeCloseTo(200e6, 0);
  });
  it("disponible ≤ 0 en el año: aviso de faltante", () => {
    const pobre = { inflacionPct: 5, inv: [], ingresos: [{ nombre: "Salario", mensual: 5e6 }], gas: { Vida: [{ n: "Gastos", m: 6e6 }] }, deu: [] };
    const h = txt(renderToString(<MiFuturo10 user={pobre} pasoInicial={2} />));
    expect(h).not.toContain(SIN_PLATA_ANIO); // sin inversión, sin aviso
    expect(SIN_PLATA_ANIO).toBe("No tienes plata disponible este año; esta inversión queda como faltante.");
    const r = proyectarFuturo10(pobre, { nuevas: [{ preset: "custom", nombre: "X", monto: 10e6, anio: 1 }] });
    expect(r.disponible[0].antesDeAsignar).toBeLessThanOrEqual(0);
    expect(r.alertas.some((a) => a.tipo === "nueva_sin_plata")).toBe(true);
  });
});

describe("Gastos vinculados a un activo vendido", () => {
  it("el predial deja de correr desde el año de venta", () => {
    const u = { inflacionPct: 5, inv: [{ id: "casa", n: "Casa", tp: "Real Estate", va: 500e6 }], ingresos: [{ nombre: "Salario", mensual: 20e6 }],
      gas: { Vivienda: [{ n: "Predial", m: 500000, activoId: "casa" }], Vida: [{ n: "x", m: 5e6 }] }, deu: [] };
    const r = proyectarFuturo10(u, { decisiones: { casa: { accion: "vende", anioVenta: 3 } } });
    expect(r.filas[1].gastosVinculados).toBeCloseTo(6e6, 0);
    expect(r.filas[2].gastosVinculados).toBeGreaterThan(0);
    expect(r.filas[3].gastosVinculados).toBe(0);
    expect(r.filas[10].gastosVinculados).toBe(0);
    const sigue = proyectarFuturo10(u, {});
    expect(sigue.filas[10].gastosVinculados).toBeGreaterThan(0);
  });
});

describe("Inversión nueva: una sola renta, un solo faltante, sin aviso USD para COP", () => {
  const u = { inflacionPct: 5, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 200e6 }], ingresos: [{ nombre: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "x", m: 8e6 }] }, deu: [] };
  const btg = { preset: "custom", nombre: "BTG", monto: 6.5e9, rendimientoNomPct: 14, anio: 1, tipo: "renta", moneda: "COP" };
  it("renta ≈ $75,8M/mes en pesos de hoy, tasa visible, ingreso incluye la renta", () => {
    const sin = proyectarFuturo10(u, {}), r = proyectarFuturo10(u, { nuevas: [btg] });
    const d = r.nuevasDetalle[0];
    expect(d.rentaMensual).toBeCloseTo(6.5e9 * 0.14 / 12, 0);
    expect(d.rendimientoPct).toBeCloseTo(14, 6);
    expect((r.filas[1].ingresosReal - sin.filas[1].ingresosReal) / 12).toBeCloseTo(d.rentaMensualFondeada, -3);
    const h = txt(renderToString(<InversionesNuevas items={r.nuevasDetalle} />));
    expect(h).toMatch(/14,0% anual/); expect(h).toContain("/mes en pesos del año 1");
    expect(r.hayUSD).toBe(false);
  });
  it("faltante: mismo número en la inversión, la alerta y la barra", () => {
    const r = proyectarFuturo10(u, { nuevas: [btg] });
    const d = r.nuevasDetalle[0], b = resumenReinvertir(r.disponible), a = r.alertas.find((x) => x.tipo === "nueva_sin_plata");
    expect(b.faltan).toBeCloseTo(d.faltante, 0);
    expect(a.monto).toBeCloseTo(d.faltante, 0);
    expect(r.alertas.some((x) => x.tipo === "faltante" || x.tipo === "exceso")).toBe(false);
    const h = txt(renderToString(<BarraReinvertir disponible={r.disponible} />));
    expect(h).toMatch(/Te faltan \$[\d.]+/);
  });
});
