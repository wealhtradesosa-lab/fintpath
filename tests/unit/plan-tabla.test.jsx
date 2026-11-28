import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import PlanTabla, { filasDelPlan, armarPropiedadRaiz } from "../../src/components/PlanTabla.jsx";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10, cuentaPorAnio, leerPropiedadRaiz, claveIngreso } from "../../src/lib/futuro10.js";

// 26-nov-2026 — «Tu plan en una pantalla»: la tabla año por año para armar escenarios.
const Y = new Date().getFullYear();
const user = { trm: 4200, inflacionPct: 4,
  inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 8900e6 }, { id: "or", n: "Casa Orlando", tp: "Real Estate", va: 1950e6 }, { id: "ib", n: "Acciones", tp: "ETF", va: 900e6 }, { id: "ca", n: "Cuenta", tp: "Cash", va: 300e6 }],
  ingresos: [{ nombre: "Salario de Santiago", categoria: "Salario", mensual: 25e6 }, { nombre: "Salario de Ana", categoria: "Salario", mensual: 12e6 }, { nombre: "Renta Puerto Madero", categoria: "Arriendo", mensual: 28e6, activoId: "pm" }, { nombre: "Renta Casa Orlando", categoria: "Arriendo", mensual: 7e6, activoId: "or" }],
  gas: { Hogar: [{ n: "Gastos del hogar", m: 38e6 }, { n: "Colegio", m: 9e6 }] },
  deu: [{ id: "do", n: "Crédito Casa Orlando", mt: 600e6, pg: 7e6, ts: 9, la: "or" }] };
const pinta = (cfg, extra = {}) => { const r = proyectarFuturo10(user, cfg), cuenta = cuentaPorAnio(r, cfg); return renderToString(createElement(PlanTabla, { user, cfg, setCfg: () => {}, r, cuenta, ...extra })).replace(/<!-- -->/g, ""); };

describe("filasDelPlan: una fila por cosa y las sumas cuadran con el motor", () => {
  const cfg = { decisiones: { or: { accion: "termina", desde: 2 } }, nuevas: [{ nombre: "CDT", preset: "rfLargo", monto: 500e6, anio: 2, fuente: "venta", pctRecibe: 100 }] };
  const r = proyectarFuturo10(user, cfg), M = filasDelPlan(r);
  it("cada ingreso de trabajo tiene su fila", () => { expect(M.ing.map((x) => x.nombre)).toEqual(["Salario de Santiago", "Salario de Ana"]); });
  // 26-nov-2026 (Santiago: "solo agarró cesantías; ¿dónde quedó salario Sosa, salario Ana, honorarios?").
  it("los ingresos marcados como «siguen llegando aunque dejes de trabajar» también van en Ingresos, no en Inversiones", () => {
    const u2 = { ...user, ingresos: [{ nombre: "Salario Sosa", categoria: "Salario", mensual: 25e6, rentaPasiva: true }, { nombre: "Salario Ana", categoria: "Salario", mensual: 12e6, rentaPasiva: true }, { nombre: "Honorarios", categoria: "Honorarios", mensual: 8e6, rentaPasiva: true }, { nombre: "Cesantías", categoria: "Salario", mensual: 2e6 }, { nombre: "Renta Puerto Madero", categoria: "Arriendo", mensual: 28e6, activoId: "pm" }] };
    const M2 = filasDelPlan(proyectarFuturo10(u2, {}));
    expect(M2.ing.map((x) => x.nombre).sort()).toEqual(["Cesantías", "Honorarios", "Salario Ana", "Salario Sosa"]);
    expect(M2.ing.find((x) => x.nombre === "Salario Sosa").v[0]).toBeCloseTo(25e6, 0);
    expect(M2.act.some((x) => /Salario|Honorarios/.test(x.nombre))).toBe(false);
    expect(M2.ing.every((x) => x.key)).toBe(true); // todos se pueden terminar en un año
    for (let j = 0; j < 10; j++) expect([...M2.ing, ...M2.act].reduce((s, x) => s + x.v[j], 0)).toBeCloseTo(M2.entra[j], 0);
  });
  it("dos ingresos con el mismo nombre no se mezclan en una fila", () => {
    const u3 = { ...user, ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 25e6 }, { nombre: "Salario", categoria: "Salario", mensual: 12e6 }] };
    const M3 = filasDelPlan(proyectarFuturo10(u3, {}));
    expect(M3.ing.length).toBe(2);
    expect(M3.ing.map((x) => Math.round(x.v[0])).sort((a, b) => a - b)).toEqual([12e6, 25e6]);
  });
  it("ingresos + inversiones = lo que entra; gastos + cuotas = lo que sale; y queda = entra − sale", () => {
    for (let j = 0; j < 10; j++) {
      const entra = [...M.ing, ...M.act].reduce((s, x) => s + x.v[j], 0), sale = [...M.gas, ...M.deu].reduce((s, x) => s + x.v[j], 0);
      expect(entra).toBeCloseTo(M.entra[j], 0); expect(sale).toBeCloseTo(M.sale[j], 0); expect(M.queda[j]).toBeCloseTo(M.entra[j] - M.sale[j], 0);
    }
  });
  it("la inversión nueva tiene su fila y paga desde su año; la vendida deja de pagar", () => {
    const cdt = M.act.find((x) => x.nombre === "CDT"), or = M.act.find((x) => x.id === "or");
    expect(cdt.v[0]).toBe(0); expect(cdt.v[1]).toBeGreaterThan(0);
    expect(or.v[0]).toBeGreaterThan(0); expect(or.v[1]).toBe(0);
  });
  it("las inversiones de hoy siempre tienen fila, aunque no paguen", () => { expect(M.act.some((x) => x.id === "ib")).toBe(true); });
});

describe("PlanTabla: lo que se ve", () => {
  it("abre con la tabla primero, los tres pasos y sin formulario cuando no hay capital", () => {
    const h = pinta({});
    expect(h).toContain("Tu plan en una pantalla");
    expect(h.indexOf("1 · Revisa tu tabla")).toBeLessThan(h.indexOf("2 · Reparte tu capital disponible"));
    expect(h.indexOf("2 · Reparte tu capital disponible")).toBeLessThan(h.indexOf("3 · Mira cómo queda cada año"));
    expect(h).toContain(`En ${Y} no tienes capital disponible para repartir`);
    expect(h).not.toContain("¿Qué haces con esa plata?");
    expect(h).toContain("= Te queda al mes");
    expect(h).toContain("Equivale a");
    expect(h).not.toMatch(/NaN|undefined|\bMM\b|meterle/i);
  });
  it("una venta de hoy deja capital disponible con el monto ya lleno y las opciones de inversión", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } } });
    expect(h).toContain("¿Qué haces con esa plata? Puedes repartirla en varias partes.");
    expect(h).toContain("Usar todo lo que queda de " + Y);
    expect(h).toContain("Crear una inversión nueva");
    expect(h).toContain("Invertirle más dinero a una que ya tienes");
    expect(h).toContain("Pagar una deuda");
    expect(h).toContain("Vendes");
  });
  it("lo ya creado sale numerado y la fila nueva va marcada", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } }, nuevas: [{ nombre: "Bodega", preset: "rfLargo", monto: 300e6, anio: 1, fuente: "venta", pctRecibe: 100 }] });
    expect(h).toContain(`Ya repartiste en ${Y}:`);
    expect(h).toContain("Inversión nueva: Bodega");
    expect(h).toContain("Parte 2: te quedan");
    expect(h).toContain(`Nueva · ${Y}`);
  });
  // 26-nov-2026 (Santiago: "que separe rentas disponibles de lo que queda invertido"; "IBKR sale vacío").
  it("separa las inversiones que pagan al mes de las que se reinvierten, y estas muestran lo que valen", () => {
    const h = pinta({});
    expect(h.indexOf("Inversiones que te pagan al mes")).toBeLessThan(h.indexOf("Inversiones que se reinvierten"));
    const reinv = h.slice(h.indexOf("Inversiones que se reinvierten"), h.indexOf("= Te entra al mes"));
    expect(reinv).toContain("Acciones");
    expect(reinv).toContain("no te paga al mes: lo que rinde se reinvierte");
    expect(reinv).toContain("Vale");
    expect(reinv).not.toContain("Puerto Madero");
  });
  it("en demo no deja cambiar nada", () => {
    const h = pinta({ decisiones: { or: { accion: "vende" } } }, { demo: true });
    expect(h).toContain("En modo demo no se pueden hacer cambios.");
    expect(h).not.toContain(">Agregar<");
  });
});

describe("propiedad raíz desde la tabla", () => {
  it("lote y construcción: lo escrito en pesos del año llega al motor en pesos de hoy", () => {
    const f = { prTipo: "lote", nombre: "Bodega", prLote: "430.000.000", prM2: "300", prCostoM2: "2.000.000", prPlazo: "1", prValE: "20", prValA: "", prFinal: "queda", prVendeEn: "0", prRenta: "8.500.000", prRepite: "no", prDestino: "reinvierte" };
    const x = armarPropiedadRaiz(f, 2, 1.04), p = leerPropiedadRaiz(x, 10);
    expect(x.preset).toBe("fincaRaiz"); expect(x.anio).toBe(2);
    expect(p.capital * 1.04).toBeCloseTo(1030e6, -2);
    expect(p.valorEntrega * 1.04).toBeCloseTo(1236e6, -2);
    expect(p.renta * 1.04).toBeCloseTo(8.5e6, -1);
    expect(p.entrega).toBe(3);
  });
});

describe("Mi futuro con la tabla", () => {
  it("con `tabla`, crear un escenario abre la tabla y ya no ofrece los pasos de antes (un solo modelo)", () => {
    const h = renderToString(createElement(MiFuturo10, { user, guardado: {}, tabla: true })).replace(/<!-- -->/g, "");
    expect(h).toContain("Tu plan en una pantalla");
    expect(h).not.toContain("Ver el detalle paso a paso");   // 28-nov-2026 (Santiago: "veo dos modelos, por eso está todo confuso")
    expect(h).not.toContain("1. Lo que tienes");
    expect(h).toContain("Escenario nuevo: cambia algo en la tabla y aquí lo guardas.");
  });
  it("sin `tabla` sigue abriendo los pasos de siempre", () => {
    const h = renderToString(createElement(MiFuturo10, { user, guardado: {} })).replace(/<!-- -->/g, "");
    expect(h).toContain("1. Lo que tienes");
    expect(h).not.toContain("Tu plan en una pantalla");
  });
});

// 26-nov-2026 (Santiago: "¿y si uno quiere disponer de esa renta en algún año o hacer un retiro?").
describe("inversión que se reinvierte: recibir plata de ella o retirar una parte", () => {
  it("las sumas siguen cuadrando y la fila muestra lo que recibes y el retiro", () => {
    const cfg = { rentasAnio: { ib: { 3: 4e6 } }, retirosActivos: { ib: { 5: 200e6 } } };
    const r = proyectarFuturo10(user, cfg), M = filasDelPlan(r), fila = M.act.find((x) => x.id === "ib");
    expect(r.reinvierten).toContain("ib");
    expect(fila.v[1]).toBe(0); expect(fila.v[2]).toBeCloseTo(4e6 * 1.05 * 1.05, 0);
    for (let j = 0; j < 10; j++) expect([...M.ing, ...M.act].reduce((s, x) => s + x.v[j], 0)).toBeCloseTo(M.entra[j], 0);
    const html = pinta(cfg);
    expect(html).toContain("te paga al mes desde " + (Y + 2));
    expect(html).toContain("retiras una parte en " + (Y + 4));
    expect(html).toContain("lo que te paga sale de la inversión");
    expect(html).toContain("Te llega por ventas y retiros");
    expect(html).not.toMatch(/meterle/i);
  });
  it("una propiedad sin ingreso ligado no va en «se reinvierten»: va aparte y dice cómo ligar su ingreso", () => {
    const u2 = { ...user, inv: [...user.inv, { id: "di", n: "District", tp: "Real Estate", va: 1200e6 }], ingresos: [...user.ingresos, { nombre: "50% District", categoria: "Arriendo", mensual: 6e6 }] };
    const r = proyectarFuturo10(u2, {}), cuenta = cuentaPorAnio(r, {});
    const html = renderToString(createElement(PlanTabla, { user: u2, cfg: {}, setCfg: () => {}, r, cuenta })).replace(/<!-- -->/g, "");
    expect(r.reinvierten).not.toContain("di");
    expect(html).toContain("Propiedades y bienes sin ingreso ligado");
    expect(html).toContain("no tiene un ingreso ligado");
    expect(html).toContain("Activo que genera este ingreso");
    expect(html).not.toContain("¿Sale de un activo tuyo?");
  });
  // 26-nov-2026 (Santiago: "uno debería poder en cualquier sección actualizar la ficha de cada inversión").
  it("con permiso para cambiar datos, cada ingreso suelto y cada inversión traen su enlace para ligar; en demo o sin permiso, no", () => {
    const u2 = { ...user, inv: [...user.inv, { id: "di", n: "District", tp: "Real Estate", va: 1200e6 }], ingresos: [...user.ingresos, { nombre: "50% District", categoria: "Arriendo", mensual: 6e6 }] };
    const r = proyectarFuturo10(u2, {}), cuenta = cuentaPorAnio(r, {}), M = filasDelPlan(r);
    const p = (extra) => renderToString(createElement(PlanTabla, { user: u2, cfg: {}, setCfg: () => {}, r, cuenta, ...extra })).replace(/<!-- -->/g, "");
    // la clave de cada fila de «Ingresos» encuentra su ingreso en los datos
    M.ing.forEach((x) => { const k = u2.ingresos.findIndex((i, q) => claveIngreso(u2.ingresos, q) === x.key); expect(k).toBeGreaterThanOrEqual(0); expect(u2.ingresos[k].nombre).toBe(x.nombre); });
    const con = p({ onDatos: () => {} });
    expect(con).toContain('aria-label="Abrir la ficha de District"');
    expect(con).toContain("hay 1 suelto que parece de aquí");        // «50% District» parece de District
    expect(con).toContain("1 conexión: ingreso");                     // las que ya tienen su arriendo conectado
    expect(p({})).not.toContain("Abrir la ficha de");
    expect(p({ onDatos: () => {}, demo: true })).not.toContain("Abrir la ficha de");
  });
});

// 27-nov-2026 (Santiago: "quité una inversión por error… debería era más bien como apagarse, por si algo";
// el lote de la bodega mostraba 17 millones porque la renta de 8,5 estaba en dos aportes).
describe("apagar en vez de quitar, y aportes con renta repetida", () => {
  const nueva = { nombre: "CDT", preset: "rfLargo", monto: 500e6, anio: 2, fuente: "venta", pctRecibe: 100 };
  const ap1 = { activoId: "ib", monto: 100e6, anio: 2, fuente: "venta", rentaMensual: 8.5e6, rentaDesdeMes: 12 }, ap2 = { activoId: "ib", monto: 50e6, anio: 3, fuente: "venta", rentaMensual: 8.5e6, rentaDesdeMes: 24 };
  const base = { decisiones: { or: { accion: "termina", desde: 2 } } };
  const pat = (cfg) => proyectarFuturo10(user, cfg).filas.map((f) => Math.round(f.patrimonio));
  it("una inversión nueva apagada cuenta igual que si no estuviera, y guarda cómo era", () => {
    const off = { ...base, nuevas: [{ preset: "_fuera", _apagada: nueva }] };
    expect(pat(off)).toEqual(pat({ ...base, nuevas: [] }));
    const html = pinta(off);
    expect(html).toContain("Eliminadas en este escenario (1)"); expect(html).toContain("Inversión nueva: CDT"); expect(html).toContain("Recuperar");
    expect(html).not.toContain("Quitar esta inversión");
  });
  it("un aporte apagado cuenta igual que si no estuviera", () => {
    const off = { ...base, reinversiones: [ap1], aportesApagados: [ap2] };
    expect(pat(off)).toEqual(pat({ ...base, reinversiones: [ap1] }));
    expect(pinta(off)).toContain("Eliminadas en este escenario (1)");
  });
  it("dos aportes con renta nueva se suman: la tabla muestra el doble", () => {
    const r2 = proyectarFuturo10(user, { ...base, reinversiones: [ap1, ap2] }), r1 = proyectarFuturo10(user, { ...base, reinversiones: [ap1] });
    const renta = (r, t) => r.filas[t].porActivo.find((x) => x.id === "ib").renta;
    expect(renta(r2, 4) - renta(r1, 4)).toBeCloseTo(8.5e6 * 12 * Math.pow(1.05, 3), 0);
  });
  it("el creador de pasos no se cae con algo apagado", () => {
    const g = { borrador: { ...base, nuevas: [{ preset: "_fuera", _apagada: nueva }], reinversiones: [ap1], aportesApagados: [ap2] } };
    for (let paso = 0; paso <= 4; paso++) expect(() => renderToString(createElement(MiFuturo10, { user, guardado: g, pasoInicial: paso, vista: "crear" }))).not.toThrow();
    expect(() => renderToString(createElement(MiFuturo10, { user, guardado: g, tabla: true, vista: "crear" }))).not.toThrow();
  });
  // El caso real del lote de la bodega (27-nov-2026): la renta de 8,5 millones estaba en el «Cambia» del paso 1 y otra vez en el aporte
  // de la obra, y la tabla mostraba 13.387.500 y 18.742.500. Santiago: "la puse en 8.500.000 y se ve 13 millones; ¿de dónde salió?".
  // Ahora «desde este año te paga X» es el total: lo que se escribe es lo que se ve.
  it("lo que se escribe en «Cambiar lo que te paga» es lo que muestra la tabla, aunque haya un aporte con renta", () => {
    const u = { trm: 4200, inflacionPct: 4, inv: [{ id: "lo", n: "lote bodega macarena con licencia", tp: "Real Estate", va: 410e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 2000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 30e6 }], gas: { Vida: [{ n: "Mercado", m: 10e6 }] }, deu: [] };
    const aporte = { activoId: "lo", monto: 600e6, anio: 2, fuente: "liquidez", rentaMensual: 8.5e6, rentaDesdeMes: 18 };
    const fila = (c) => filasDelPlan(proyectarFuturo10(u, c)).act.find((x) => x.id === "lo").v.map(Math.round);
    // Su escenario: «Cambia» del paso 1 en 2027, el aporte, y lo que él escribió en la tabla en 2027 y 2031 (8.500.000 de cada año).
    const cfg = { decisiones: { lo: { accion: "cambia", desde: 2, mensual: 8.5e6 } }, reinversiones: [aporte], rentasAnio: { lo: { 2: 8.5e6 / 1.05, 6: 8.5e6 / Math.pow(1.05, 5) } } };
    const v = fila(cfg);
    expect(v[1]).toBe(8500000);   // 2027: lo que escribió
    expect(v[2]).toBe(8925000);   // 2028: sube 5 %, ya no 18.742.500
    expect(v[5]).toBe(8500000);   // 2031: lo que escribió
    // Solo el aporte, sin cambios: medio año en 2027 y completo desde 2028.
    expect(fila({ reinversiones: [aporte] }).slice(0, 3)).toEqual([0, 4462500, 9371250]);
    // Una renta nueva que arranca DESPUÉS del cambio sí se suma (otra obra más adelante).
    const despues = fila({ rentasAnio: { lo: { 2: 5e6 / 1.05 } }, reinversiones: [{ ...aporte, anio: 4, rentaDesdeMes: 36 }] });
    expect(despues[1]).toBe(5000000); expect(despues[3]).toBe(Math.round(5e6 * 1.05 * 1.05 + 8.5e6 * Math.pow(1.05, 3)));
    // El aporte de la obra se ve en el renglón del lote, en su año: 600 millones de hoy son 624 en 2027.
    const r = proyectarFuturo10(u, cfg), html = renderToString(createElement(PlanTabla, { user: u, cfg, setCfg: () => {}, r, cuenta: cuentaPorAnio(r, cfg) })).replace(/<!-- -->/g, "");
    expect(html).toContain("le inviertes $624.000.000 en " + (Y + 1));
    const c2 = { reinversiones: [aporte] }, r2 = proyectarFuturo10(u, c2);
    const h2 = renderToString(createElement(PlanTabla, { user: u, cfg: c2, setCfg: () => {}, r: r2, cuenta: cuentaPorAnio(r2, c2) })).replace(/<!-- -->/g, "");
    // 28-nov-2026 (Santiago: "invierto aquí un dinero que no es 8 millones; debería mostrar cuánto renta y cuánto invertí").
    expect(h2).toMatch(/>Le inviertes<\/span><span[^>]*>\$624\.000\.000<\/span><span[^>]*>Te paga al mes<\/span><span[^>]*>\$4\.462\.500</);
  });
  // 28-nov-2026: en la captura de Santiago, los años con aporte de un fondo mostraban «Inviertes —» y escondían lo que valía.
  it("una casilla con etiqueta sigue mostrando lo que vale la inversión que se reinvierte", () => {
    const cfg = { reinversiones: [{ activoId: "ib", monto: 100e6, anio: 3, fuente: "venta" }] }, r = proyectarFuturo10(user, cfg), M = filasDelPlan(r);
    const html = pinta(cfg), vale3 = "$" + Math.round(M.act.find((x) => x.id === "ib").val[2]).toLocaleString("es-CO");
    expect(html).toContain(">Le inviertes<");
    expect(html).toContain(vale3);
    expect(html).toContain("Al terminar el año");
  });
  // 28-nov-2026 (Santiago: "el local de la Macarena tiene una deuda de 437 millones, ¿cómo marca uno en qué año la paga?").
  it("marcar el año en que se paga una deuda le quita la cuota desde ese año y saca la plata del capital de ese año", () => {
    const cfg = { pagarDeudas: { do: Y + 2 } }, r = proyectarFuturo10(user, cfg), M = filasDelPlan(r), fila = M.deu.find((x) => /Orlando/.test(x.nombre));
    expect(r.deudas.find((d) => d.id === "do").pagaAnio).toBe(3);
    expect(fila.v[1]).toBeGreaterThan(0); expect(fila.v[2]).toBe(0);
    expect(cuentaPorAnio(r, cfg)[2].compromisos.some((c) => /Orlando/.test(c.nombre))).toBe(true);
  });
  // 28-nov-2026 (Santiago: "veo la Volvo encendida en Patrimonio y aquí no la muestra"; "¿por qué si la Ford vale 220 aquí la pone en 193?").
  it("lo que el escenario vende este año conserva su renglón, y la primera casilla de valor es lo que hay hoy", () => {
    const cfg = { decisiones: { ib: { accion: "vende" } } }, r = proyectarFuturo10(user, cfg), M = filasDelPlan(r);
    expect(M.act.find((x) => x.id === "ib")).toMatchObject({ vendidaHoy: true });
    const html = pinta(cfg);
    expect(html).not.toContain("Lo que vendes en " + Y);   // sin sección aparte: va en su bloque de siempre
    expect(html).toContain('aria-label="Abrir opciones de Acciones en ' + Y + '"'); expect(html).toContain("la vendes al empezar " + Y);
    const h0 = pinta({});
    expect(h0).toMatch(/>Hoy<\/span><span[^>]*>\$900\.000\.000</);      // Acciones: 900 millones hoy, igual que en Patrimonio
    expect(h0).toContain("Al empezar el año");
  });
  // 28-nov-2026 (Santiago: "un mundo de inversiones creadas que no hice yo… además que no puedo eliminar. ¿Cómo elimino Lote y construcción?").
  it("un negocio de propiedad raíz sin nombre también trae «Editar» y «Eliminar»", () => {
    const pr = armarPropiedadRaiz({ nombre: "", prTipo: "lote", prLote: "430000000", prM2: "300", prCostoM2: "2000000", prPlazo: "1", prValE: "20", prValA: "", prFinal: "vende", prVendeEn: "0", prRenta: "", prRepite: "si", prDestino: "reinvierte" }, 2, 1);
    const cfg = { decisiones: { or: { accion: "vende" } }, nuevas: [pr] }, html = pinta(cfg);
    expect(html).toContain("Lote y construcción");
    expect(html).toContain('aria-label="Eliminar Lote y construcción"'); expect(html).toContain('aria-label="Editar Lote y construcción"');
  });
});

