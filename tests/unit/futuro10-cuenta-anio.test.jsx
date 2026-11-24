import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { cuentaPorAnio } from "../../src/components/MiFuturo10.jsx";

// 23-nov-2026 — La cuenta de cada año: viene de antes + flujo libre del año anterior + lo que llega − lo que se usa.
const Y = new Date().getFullYear();
const user = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [{ id: "d", n: "Saldo local", mt: 300e6, pg: 0, tipoInteres: "sin_interes" }] };

describe("cuenta año por año", () => {
  // 24-nov-2026 — Cada año igual, también hoy: lo que tienes + lo que sobra o falta para vivir − lo comprometido − tus movidas = queda.
  it("hoy cuenta su propio flujo; cada año suma lo que traes, lo que llega y resta deudas e inversiones de ese año", () => {
    const cfg = { decisiones: { l: { accion: "vende" } }, terminan: {}, nuevas: [{ preset: "rfCorto", monto: 200e6, fuente: "liquidez", anio: 2 }], pagarDeudas: { d: Y + 1 } };
    const r = proyectarFuturo10(user, cfg);
    const c = cuentaPorAnio(r, cfg);
    const g1 = c.find((g) => g.anio === 1);
    expect(g1.llega).toBeCloseTo(1000e6, -3); // lo que vendes hoy
    expect(g1.flujo).toBeCloseTo(r.filas[1].cf, 0); // lo que sobra en el año en curso cuenta ese año
    expect(g1.queda).toBeCloseTo(g1.llega + g1.flujo - g1.comprometido - g1.movido, 0);
    const g2 = c.find((g) => g.anio === 2);
    expect(g2.antes).toBeCloseTo(Math.max(0, g1.queda), 0); // lo de hoy pasa al año siguiente
    expect(g2.flujoHoy).toBe(0);
    expect(g2.flujo).toBeCloseTo(r.filas[2].cf, 0);
    expect(g2.movidas.some((u) => u.tipo === "A" && Math.round(u.monto) === 300e6)).toBe(true); // la deuda que decides pagar ese año
    expect(g2.movidas.some((u) => u.tipo === "C" && Math.round(u.monto) === 200e6)).toBe(true);
    expect(g2.queda).toBeCloseTo(g2.antes + g2.llega + g2.flujo - g2.comprometido - g2.movido, 0);
    const g3 = c.find((g) => g.anio === 3);
    expect(g3.antes).toBeCloseTo(Math.max(0, g2.queda), 0);
  });
  it("lo que sobra cada mes con destino fijo en D no se suma al año", () => {
    const cfg = { sobraDestinos: [{ id: "c", pct: 100 }] };
    const r = proyectarFuturo10(user, cfg);
    const g = cuentaPorAnio(r, cfg).find((x) => x.anio === 2);
    expect(g.flujo).toBeCloseTo(0, 0);
    expect(g.flujoHoy).toBe(0);
  });
});

// 24-nov-2026 (Santiago: "el sistema dice que sobran 100 MM, los usa uno para la inversión y después
// dice que eran 70"). Lo que puedes usar sale de la foto del año antes de tus movidas de ese año.
import { fotosPorAnio, sinMovidasDesde } from "../../src/lib/futuro10.js";
describe("lo que puedes hacer con tu plata no se mueve al invertir", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 2000e6 }, { id: "f", n: "Fondo", tp: "ETF", va: 1500e6 }], ingresos: [{ nombre: "Salario", mensual: 40e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 25e6 }] }, deu: [{ id: "h", n: "Hipoteca", mt: 400e6, pg: 9e6, ts: 12 }] };
  const base = { decisiones: { f: { accion: "termina", desde: 3 } } };
  const cuenta = (cfg) => { const r = proyectarFuturo10(u, cfg); return cuentaPorAnio(r, cfg, fotosPorAnio(u, cfg, r)); };
  it("una inversión de 2028 que paga cada mes no cambia lo disponible de 2028; lo que paga se ve al cierre", () => {
    const sin = cuenta(base).find((g) => g.anio === 3);
    const cfg = { ...base, nuevas: [{ preset: "custom", nombre: "CDT", monto: 1000e6, anio: 3, rendimientoNomPct: 12, pctRecibe: 100 }] };
    const con = cuenta(cfg).find((g) => g.anio === 3);
    expect(con.disponible).toBeCloseTo(sin.disponible, -3);
    expect(con.porInvertir).toBeCloseTo(sin.disponible - 1000e6, -3);
    expect(con.efecto).toBeGreaterThan(100e6); // lo que el CDT alcanza a pagar ese año
    expect(con.queda).toBeCloseTo(con.porInvertir + con.efecto, -3);
    // Sin la foto, lo disponible sí cambiaba (lo que veía Santiago).
    const r = proyectarFuturo10(u, cfg);
    expect(cuentaPorAnio(r, cfg).find((g) => g.anio === 3).disponible).toBeGreaterThan(sin.disponible + 100e6);
  });
  it("pagar una deuda un año: lo disponible no cambia; la cuota que dejas de pagar llega al cierre", () => {
    const sin = cuenta(base).find((g) => g.anio === 2);
    const con = cuenta({ ...base, pagarDeudas: { h: Y + 1 } }).find((g) => g.anio === 2);
    expect(con.disponible).toBeCloseTo(sin.disponible, -3);
    expect(con.movidas.some((m) => m.tipo === "A")).toBe(true);
    expect(con.efecto).toBeCloseTo(9e6 * 12, -6);
  });
  it("la foto deja en cero solo lo de ese año en adelante", () => {
    const cfg = { nuevas: [{ preset: "rfCorto", monto: 1, anio: 1 }, { preset: "rfCorto", monto: 2, anio: 3 }], reinversiones: [{ activoId: "f", monto: 5, anio: 2, pctRecibe: 50 }], pagarDeudas: { h: Y + 3 } };
    const s3 = sinMovidasDesde(cfg, 3, 10);
    expect(s3.nuevas[0]).toEqual(cfg.nuevas[0]);
    expect(s3.nuevas[1].preset).toBe("_fuera");
    expect(s3.reinversiones[0]).toEqual(cfg.reinversiones[0]);
    expect(s3.pagarDeudas.h).toBe(false);
    const s2 = sinMovidasDesde(cfg, 2, 10);
    expect(s2.reinversiones[0].monto).toBe(0);
    expect(s2.reinversiones[0].pctRecibe).toBe(50); // cómo rinde el activo se queda
  });
  it("los gastos que empiezan después traen su año de inicio (para marcarlos en la foto)", () => {
    const r = proyectarFuturo10(u, { futuros: { gastos: [{ nombre: "Universidad Emilio", anual: 170e6, desde: 4, anios: 4 }] } });
    expect(r.filas[3].gastosFut.length).toBe(0);
    expect(r.filas[4].gastosFut[0]).toMatchObject({ nombre: "Universidad Emilio", desde: 4 });
  });
});

import { activosParaAportar } from "../../src/components/MiFuturo10.jsx";
describe("activos a los que se les puede aportar en un año", () => {
  it("no ofrece lo que ya se vendió ese año o antes, ni lo que ya tiene aporte ese año; sí ofrece aportar otra vez en otro año", () => {
    const u = { inflacionPct: 4, inv: [{ id: "pm", n: "Puerto Madero", tp: "Real Estate", va: 3000e6 }, { id: "ib", n: "IBKR", tp: "ETF", va: 500e6 }, { id: "v", n: "Carro", tp: "Vehículo", va: 100e6 }], ingresos: [], gas: {}, deu: [] };
    const cfg = { decisiones: { pm: { accion: "termina", desde: 2 } }, reinversiones: [{ activoId: "ib", monto: 100e6, anio: 2 }] };
    const r = proyectarFuturo10(u, cfg);
    const ids = (t) => activosParaAportar(r, cfg, t).map((a) => a.id);
    expect(ids(1)).toEqual(expect.arrayContaining(["pm", "ib"]));
    expect(ids(1)).not.toContain("v");
    expect(ids(2)).not.toContain("pm"); // se vende en el año 2
    expect(ids(2)).not.toContain("ib"); // ya tiene aporte en el año 2
    expect(ids(3)).toContain("ib"); // otro aporte en el año 3
    expect(ids(3)).not.toContain("pm");
  });
});

// 23-nov-2026 (Santiago: "uno puede ampliar su inversión en los fondos de renta, CDTs…").
import { proyectarFuturo10 as proyectar2, cuentaPorAnio as cuenta2 } from "../../src/lib/futuro10.js";
describe("aportes a una inversión creada en el plan", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 3000e6 }], ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} };
  const base = { nuevas: [{ preset: "custom", nombre: "CDT Bancolombia", monto: 1000e6, anio: 1, fuente: "liquidez", rendimientoNomPct: 10 }] };
  it("le meto 500 MM en 2028 a un CDT creado hoy: entra ese año, sale del saldo de ese año y sigue rindiendo igual", () => {
    const sin = proyectar2(u, base);
    const con = proyectar2(u, { ...base, reinversiones: [{ activoId: "nueva_0", monto: 500e6, anio: 3 }] });
    const v = (r, t) => r.filas[t].porActivo.find((a) => a.id === "nueva_0").valor;
    expect(v(con, 2)).toBeCloseTo(v(sin, 2), -3);
    expect(v(con, 3) - v(sin, 3)).toBeCloseTo(500e6, -3); // entra ese año
    expect(v(con, 4) - v(sin, 4)).toBeGreaterThan(500e6); // y desde ahí rinde
    const g = cuenta2(con).find((x) => x.anio === 3);
    expect(g.salen.some((s) => /CDT Bancolombia/.test(s.nombre) && Math.abs(s.monto - 500e6) < 1)).toBe(true);
    expect(con.reinversionesDetalle.some((d) => d.aNueva && d.activoId === "nueva_0" && d.anio === 3)).toBe(true);
  });
  it("la lista de «meterle más» trae lo creado en años anteriores, no lo del mismo año", () => {
    const r = proyectar2(u, { nuevas: [...base.nuevas, { preset: "custom", nombre: "Renta fija 2027", monto: 300e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 9 }] });
    const ids = (t) => activosParaAportar(r, {}, t).map((a) => a.id);
    expect(ids(1)).not.toContain("nueva_0");
    expect(ids(2)).toContain("nueva_0");
    expect(ids(2)).not.toContain("nueva_1");
    expect(ids(3)).toContain("nueva_1");
  });
  it("una inversión que empieza en 2027 también recibe aportes en años siguientes", () => {
    const cfg = { nuevas: [{ preset: "custom", nombre: "Fondo 2027", monto: 400e6, anio: 2, fuente: "liquidez", rendimientoNomPct: 9 }] };
    const sin = proyectar2(u, cfg);
    const con = proyectar2(u, { ...cfg, reinversiones: [{ activoId: "nueva_0", monto: 200e6, anio: 4 }] });
    const v = (r, t) => (r.filas[t].porActivo.find((a) => a.id === "nueva_0") || {}).valor || 0;
    expect(v(con, 4) - v(sin, 4)).toBeCloseTo(200e6, -3);
    expect(v(con, 5) - v(sin, 5)).toBeGreaterThan(200e6);
  });
});

describe("fondo de reserva", () => {
  // 24-nov-2026 (Santiago: "si sobra, qué hacer: ahorrar en un fondo de reserva para años futuros o dejarlo disponible para el año siguiente").
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 1000e6 }, { id: "l", n: "Lote", tp: "Lote", va: 600e6 }], ingresos: [{ nombre: "Salario", mensual: 30e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
  it("lo que mandas a la reserva no pasa disponible, rinde como renta corta y cubre lo que falta para vivir", () => {
    const cfg = { decisiones: { l: { accion: "vende" } }, reservaAnual: { 1: 300e6 }, futuros: { gastos: [{ nombre: "Universidad", anual: 200e6, desde: 3, anios: 4 }] } };
    const r = proyectarFuturo10(u, cfg);
    expect(r.reservaAnual).toEqual({ 1: 300e6 });
    const c = cuentaPorAnio(r, cfg);
    const g1 = c[0], g2 = c[1], g3 = c[2];
    expect(g1.aReserva).toBeCloseTo(300e6, -3);
    expect(g1.pasa).toBeCloseTo(g1.queda - 300e6, -3);
    expect(g2.antes).toBeCloseTo(g1.pasa, -3);
    expect(g2.reservaAntes).toBeCloseTo(300e6 * (1 + r.tasaReserva), -3);
    // En el año 3 falta para vivir: primero sale de lo que tienes y, si no alcanza, de tu reserva.
    expect(g3.flujoFoto).toBeLessThan(0);
    if (g3.base < 0) expect(g3.usoReserva).toBeGreaterThan(0);
    expect(g3.reservaFin).toBeCloseTo(g3.reservaAntes - g3.usoReserva + g3.aReserva, -3);
  });
  it("no se manda a la reserva más de lo que queda", () => {
    const cfg = { reservaAnual: { 2: 1e15 } };
    const g2 = cuentaPorAnio(proyectarFuturo10(u, cfg), cfg).find((g) => g.anio === 2);
    expect(g2.aReserva).toBeCloseTo(Math.max(0, g2.queda), 0);
    expect(g2.pasa).toBeCloseTo(0, 0);
  });
});

// 24-nov-2026 (Santiago: "lo que se pone en la sección dos aparece en el año que corresponde: este año
// dispone de esto después de gastos y ventas, pero debe pagar el local, debe pagar la universidad, y lo
// que sobra se invierte").
describe("los hitos de Lo que viene caen en su año", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 800e6 }, { id: "o", n: "Orlando", tp: "Real Estate", va: 900e6 }], ingresos: [{ nombre: "Salario", mensual: 50e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [{ id: "h", n: "Hipoteca Orlando", mt: 300e6, pg: 6e6, ts: 10, la: "o" }] };
  it("la deuda que se paga con la venta de su activo es un compromiso de hoy, no una movida", () => {
    const cfg = { decisiones: { o: { accion: "vende" } } };
    const g1 = cuentaPorAnio(proyectarFuturo10(u, cfg), cfg)[0];
    expect(g1.compromisos.some((c) => c.tipo === "A" && Math.round(c.monto) === 300e6)).toBe(true);
    expect(g1.movidas.some((m) => m.tipo === "A")).toBe(false);
    expect(g1.disponible).toBeCloseTo(900e6 - 300e6 + g1.flujoFoto - (g1.comprometido - 300e6), -3);
  });
  it("la compra de un local en 2028 es un compromiso de 2028; la universidad entra en lo que cuesta vivir", () => {
    const cfg = { futuros: { activos: [{ nombre: "Local", clase: "inmueble", valor: 500e6, cuotaInicial: 500e6, anioCuota: 3, entrega: 3 }], gastos: [{ nombre: "Universidad", anual: 170e6, desde: 3, anios: 4 }] } };
    const r = proyectarFuturo10(u, cfg);
    const g3 = cuentaPorAnio(r, cfg).find((g) => g.anio === 3);
    expect(g3.compromisos.some((c) => c.tipo === "F" && /Local/.test(c.nombre))).toBe(true);
    expect(g3.foto.gastosFut.some((x) => x.nombre === "Universidad" && x.desde === 3)).toBe(true);
  });
  it("hoy, lo que sale de tus cuentas o es plata nueva no resta de lo que puedes usar", () => {
    const cfg = { nuevas: [{ preset: "rfCorto", monto: 100e6, anio: 1, fuente: "liquidez" }, { preset: "rfCorto", monto: 50e6, anio: 1, fuente: "nuevo" }] };
    const g1 = cuentaPorAnio(proyectarFuturo10(u, cfg), cfg)[0];
    expect(g1.movidas.length).toBe(2);
    expect(g1.movido).toBe(0);
    expect(g1.porInvertir).toBeCloseTo(g1.disponible, 0);
  });
});

describe("validaciones de Lo que viene", () => {
  const u = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 900e6 }, { id: "loc", n: "Local Macarena", tp: "Real Estate", va: 1200e6 }, { id: "btg", n: "BTG", tp: "ETF", va: 700e6 }], ingresos: [{ nombre: "Salario", mensual: 40e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
  it("la renta de un activo que ya cambiaste en el paso 1 y vuelves a poner en Lo que viene se cuenta una vez", () => {
    const paso1 = { decisiones: { loc: { accion: "cambia", mensual: 8.5e6, desde: 2 } } };
    const doble = { ...paso1, futuros: { ingresos: [{ nombre: "Renta local", mensual: 8.5e6, desde: 2, activoId: "loc" }] } };
    const a = proyectarFuturo10(u, paso1), b = proyectarFuturo10(u, doble);
    expect(b.filas[3].ingresos).toBeCloseTo(a.filas[3].ingresos, -3);
    const otra = { ...paso1, futuros: { ingresos: [{ nombre: "Parqueadero", mensual: 1e6, desde: 2, activoId: "loc", noEsRentaDe: ["loc"] }] } };
    expect(proyectarFuturo10(u, otra).filas[3].ingresos).toBeGreaterThan(a.filas[3].ingresos + 11e6);
  });
  it("una compra pagada con una inversión elegida no resta de la plata de ese año", () => {
    const cfg = { futuros: { activos: [{ nombre: "Bodega", clase: "inmueble", valor: 500e6, entrega: 3, fuentes: [{ id: "btg", monto: 500e6 }] }] } };
    const r = proyectarFuturo10(u, cfg);
    expect(r.pagosFuturos[0].deFuentes).toBeCloseTo(500e6, -3);
    const g3 = cuentaPorAnio(r, cfg).find((g) => g.anio === 3);
    expect(g3.compromisos.some((c) => /Bodega/.test(c.nombre))).toBe(false);
  });
});
