// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Motor "Mi futuro a 10 años" (puro, sin React ni Supabase).
//
// Reglas:
//  1. Todo se proyecta en NOMINAL año a año y se lleva a pesos de hoy UNA sola
//     vez, dividiendo por (1+inflación)^t. Ningún retorno es "real" por dentro:
//     los presets se expresan como inflación + spread y se convierten a nominal.
//  2. Ingresos y gastos crecen cada uno con su propia tasa (inflación + spread
//     del escenario). Nada queda congelado en nominal.
//  3. Cada activo tiene su retorno (por clase o por decisión del usuario) y cada
//     canasta (liquidez / renta / crecimiento) el suyo.
//  4. Flujo negativo: consume liquidez → renta → crecimiento. Si no alcanza,
//     alerta. Un activo o una canasta en negativo, alerta.
//  5. Datos de hoy: calcularBase() de metrics.js (sin impuestos: este motor no
//     modela impuestos). La renta de cada activo sale de rentaNetaPorActivo,
//     que ya respeta `rentaOrigen` (manual = neta: no se restan otra vez los
//     gastos vinculados).
// Supuestos validados por Finanzas (24-oct-2026); editables en SUPUESTOS_F10.
// ═══════════════════════════════════════════════════════════════════════════
import { calcularBase, tipoActivo, esLiquido, INFLACION_DEFAULT_PCT } from "./metrics.js";

export const SUPUESTOS_F10 = {
  validadoPor: "Finpathia · Finanzas, 24-oct-2026",
  anios: 10,
  colchonMeses: 6, // colchón de liquidez, aparte de las mezclas
  escenarios: {
    pesimista: { nombre: "Pesimista", inflacionPct: 6, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3.5 },
    base: { nombre: "Base", inflacionPct: null /* = user.inflacionPct (4%) */, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 6.5 },
    optimista: { nombre: "Optimista", inflacionPct: 3, ingresosSpread: 2, gastosSpread: 0, retornoSpread: 1, spRealPct: 8 },
  },
  // Presets de retorno. realSpread = puntos sobre la inflación del escenario.
  presets: {
    rfCorto: { nombre: "Renta fija corto plazo", realSpread: 2.5 },
    rfLargo: { nombre: "Renta fija largo plazo", realSpread: 3.5, topeSpread: 4.5 },
    fincaRaiz: { nombre: "Finca raíz", rentaNetaPct: 4.5, valorizacionSpread: 0 },
    sp500: { nombre: "S&P 500 (USD)", usd: true, devaluacionRealPct: 0 /* real usa escenario.spRealPct */ },
  },
  vehiculo: { depAnios1a3Pct: -12, depDespuesPct: -8 },
  otrosRealSpread: 0, // crypto, otros: sin supuesto validado → solo inflación
  // Canasta → preset
  canastas: { liquidez: "rfCorto", renta: "rfLargo", crecimiento: "sp500" },
  nortes: {
    rentas: { nombre: "Vivir de rentas", liquidez: 10, renta: 65, crecimiento: 25 },
    equilibrio: { nombre: "Equilibrio", liquidez: 10, renta: 45, crecimiento: 45 },
    crecer: { nombre: "Crecer", liquidez: 10, renta: 20, crecimiento: 70 },
  },
};

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function resolverEscenario(clave = "base", user = {}, sup = SUPUESTOS_F10) {
  const e = sup.escenarios[clave] || sup.escenarios.base;
  const infUser = user.inflacionPct != null && user.inflacionPct !== "" ? n(user.inflacionPct) : INFLACION_DEFAULT_PCT;
  const inflacionPct = e.inflacionPct == null ? infUser : e.inflacionPct;
  return { ...e, clave, inflacionPct };
}

/** Retorno total NOMINAL anual (%) de un preset bajo un escenario. Fisher: (1+i)(1+r)−1. */
export function retornoNominalPreset(clave, esc, sup = SUPUESTOS_F10, override = {}) {
  const p = { ...sup.presets[clave], ...override };
  const i = esc.inflacionPct / 100;
  let real;
  if (clave === "sp500") real = (override.realPct ?? esc.spRealPct) + n(p.devaluacionRealPct);
  else if (clave === "fincaRaiz") {
    // renta neta (sobre el valor) + valorización = inflación + spread
    const val = (1 + i) * (1 + (n(p.valorizacionSpread)) / 100) - 1;
    return ((val + (n(p.rentaNetaPct) + esc.retornoSpread) / 100 * (1 + val)) * 100);
  } else {
    real = n(p.realSpread) + esc.retornoSpread;
    if (p.topeSpread != null) real = Math.min(real, p.topeSpread);
  }
  return ((1 + i) * (1 + real / 100) - 1) * 100;
}

export function claseActivo(a) {
  const tp = tipoActivo(a);
  if (/veh/i.test(tp)) return "vehiculo";
  if (["Real Estate", "Local Comercial", "Bodega"].includes(tp)) return "inmueble";
  if (["Acciones", "ETF"].includes(tp)) return "acciones";
  if (esLiquido(a)) return "liquido";
  return "otro";
}

/**
 * @param {object} user  datos del usuario (inv, ingresos, gas, deu, trm, inflacionPct)
 * @param {object} cfg   { escenario, decisiones:{[id]:{accion,retornoRealPct}}, norte,
 *                         mezcla:{liquidez,renta,crecimiento}, nuevas:[{nombre,preset,monto}],
 *                         reinversiones:[{activoId,monto}], supuestos }
 */
export function proyectarFuturo10(user = {}, cfg = {}) {
  const sup = cfg.supuestos || SUPUESTOS_F10;
  const esc = resolverEscenario(cfg.escenario || "base", user, sup);
  const N = n(cfg.anios) || sup.anios;
  const inf = esc.inflacionPct / 100;
  const gIng = (1 + inf) * (1 + esc.ingresosSpread / 100) - 1;
  const gGas = (1 + inf) * (1 + esc.gastosSpread / 100) - 1;
  // Sin impuestos: se omiten impuestoNeto y retencionMensual.
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm;
  const fxA = (a) => (String(a?.moneda || a?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const dec = cfg.decisiones || {};
  const rNom = (k, ov) => retornoNominalPreset(k, esc, sup, ov) / 100;

  // ── Activos que continúan ────────────────────────────────────────────────
  let bolsa = 0, rentaVendida = 0;
  const activos = [];
  (b.inv || []).forEach((a) => {
    const d = dec[a.id] || {};
    const valor = n(a.va) * fxA(a);
    const rentaAnual = n(b.rentaNetaPorActivo[a.id]) * 12;
    if (d.accion === "vende") { bolsa += valor; rentaVendida += rentaAnual; return; }
    const clase = claseActivo(a);
    // Crecimiento del VALOR (la renta vinculada ya entra al flujo de ingresos).
    let crec;
    if (d.accion === "modifica" && d.retornoRealPct !== "" && d.retornoRealPct != null) crec = (1 + inf) * (1 + n(d.retornoRealPct) / 100) - 1;
    else if (clase === "vehiculo") crec = null; // depreciación por año
    else if (clase === "inmueble") crec = a.valorizacionPct != null && a.valorizacionPct !== "" ? n(a.valorizacionPct) / 100 : (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1;
    else if (rentaAnual > 0) crec = inf; // el rendimiento ya lo paga como ingreso
    else if (clase === "liquido") crec = rNom("rfCorto");
    else if (clase === "acciones") crec = rNom("sp500");
    else crec = (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
    activos.push({ id: a.id, nombre: a.n || a.nombre || "Activo", clase, valor, crec, usd: fxA(a) !== 1, invertible: clase !== "vehiculo" });
  });

  // ── Bolsa: colchón → reinversiones / nuevas → resto según la mezcla ─────
  const obAnual = b.ob * 12;
  const metaColchon = (b.ob * n(sup.colchonMeses));
  const liquidosQueQuedan = activos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
  const canasta = { liquidez: 0, renta: 0, crecimiento: 0 };
  let colchon = Math.min(bolsa, Math.max(0, metaColchon - liquidosQueQuedan));
  bolsa -= colchon;
  const nuevas = [];
  (cfg.reinversiones || []).forEach((r) => {
    const m = Math.min(bolsa, Math.max(0, n(r.monto))); const a = activos.find((x) => x.id === r.activoId);
    if (a && m > 0) { a.valor += m; bolsa -= m; }
  });
  (cfg.nuevas || []).forEach((x, k) => {
    const m = Math.min(bolsa, Math.max(0, n(x.monto)));
    if (m <= 0 || !sup.presets[x.preset]) return;
    bolsa -= m;
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || sup.presets[x.preset].nombre, clase: "nueva", valor: m, crec: rNom(x.preset), usd: !!sup.presets[x.preset].usd, invertible: true });
  });
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = bolsa * mezcla[k] / 100; });
  const rCan = { liquidez: rNom(sup.canastas.liquidez), renta: rNom(sup.canastas.renta), crecimiento: rNom(sup.canastas.crecimiento) };

  // ── Deuda: la cuota sigue nominal fija hasta saldar; saldo lineal ───────
  let deuda = b.deudaTotal; const cuotaAnual = b.sd * 12;
  const aniosDeuda = cuotaAnual > 0 ? deuda / cuotaAnual : 0;

  let ingresos = (b.ia + b.ip) * 12 - rentaVendida;
  let gastos = (b.ob - b.sd) * 12;
  const todos = [...activos, ...nuevas];
  const valorTotal = () => todos.reduce((s, a) => s + a.valor, 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const invertible = () => todos.filter((a) => a.invertible).reduce((s, a) => s + a.valor, 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const filas = [];
  const alertas = [];
  const fila0 = { anio: 0, ingresos, gastos: gastos + (deuda > 0 ? cuotaAnual : 0), cf: 0, activos: valorTotal(), invertible: invertible(), deuda, liquidez: colchon + canasta.liquidez + liquidosQueQuedan };
  fila0.patrimonio = fila0.activos - deuda; fila0.deflactor = 1;
  fila0.patrimonioReal = fila0.patrimonio; fila0.invertibleReal = fila0.invertible;
  filas.push(fila0);
  let liqAgotadaAnio = null;
  for (let t = 1; t <= N; t++) {
    // 1) rendimientos y depreciación del año
    todos.forEach((a) => {
      if (a.crec == null) { const p = t <= 3 ? sup.vehiculo.depAnios1a3Pct : sup.vehiculo.depDespuesPct; a.valor *= 1 + p / 100; }
      else a.valor *= 1 + a.crec;
    });
    colchon *= 1 + rCan.liquidez;
    Object.keys(canasta).forEach((k) => { canasta[k] *= 1 + rCan[k]; });
    // 2) flujo del año (ingresos y gastos ya crecidos)
    if (t > 1) { ingresos *= 1 + gIng; gastos *= 1 + gGas; }
    const cuota = deuda > 0 ? Math.min(cuotaAnual, cuotaAnual * Math.max(0, aniosDeuda - (t - 1))) : 0;
    deuda = Math.max(0, deuda - cuota);
    const cf = ingresos - gastos - cuota;
    if (cf >= 0) {
      Object.keys(canasta).forEach((k) => { canasta[k] += cf * mezcla[k] / 100; });
    } else {
      let falta = -cf;
      const sacar = (v) => { const u = Math.min(Math.max(0, v), falta); falta -= u; return v - u; };
      colchon = sacar(colchon);
      canasta.liquidez = sacar(canasta.liquidez);
      // luego activos líquidos existentes
      todos.filter((a) => a.clase === "liquido").forEach((a) => { a.valor = sacar(a.valor); });
      canasta.renta = sacar(canasta.renta);
      canasta.crecimiento = sacar(canasta.crecimiento);
      if (falta > 0) { canasta.liquidez -= falta; if (liqAgotadaAnio == null) liqAgotadaAnio = t; }
      alertas.push({ tipo: "cf_negativo", anio: t, texto: `En el año ${t} sale más de lo que entra; se usa tu liquidez.` });
    }
    const liquidez = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
    const deflactor = Math.pow(1 + inf, t);
    const activosT = valorTotal();
    const f = { anio: t, ingresos, gastos: gastos + cuota, cf, activos: activosT, invertible: invertible(), deuda, liquidez, deflactor };
    f.patrimonio = activosT - deuda;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.ingresosReal = ingresos / deflactor; f.gastosReal = f.gastos / deflactor;
    if (liquidez < 0 || todos.some((a) => a.valor < 0)) alertas.push({ tipo: "activo_negativo", anio: t, texto: `En el año ${t} un activo o tu liquidez queda en negativo.` });
    else if (obAnual > 0 && liquidez < metaColchon) alertas.push({ tipo: "liquidez_baja", anio: t, texto: `En el año ${t} tu liquidez cubre menos de ${sup.colchonMeses} meses de gastos.` });
    filas.push(f);
  }
  const fin = filas[filas.length - 1];
  return {
    escenario: esc, mezcla, filas, alertas, liqAgotadaAnio,
    hoy: { patrimonio: b.patrimonioNeto, ingresoMensual: b.ia + b.ip, salidaMensual: b.ob, flujoMensual: b.fl, liquidos: b.liquidos, colchonMeses: b.colchonMeses },
    activos: activos.map(({ id, nombre, clase, usd }) => ({ id, nombre, clase, usd })),
    hayUSD: [...activos, ...nuevas].some((a) => a.usd) || mezcla.crecimiento > 0,
    final: fin,
    // Comparativo contra la inflación: solo lo invertible (sin vehículos).
    vsInflacionReal: fila0.invertible > 0 ? (fin.invertibleReal / fila0.invertible - 1) * 100 : null,
  };
}

export function normalizarMezcla(m = {}) {
  const l = Math.max(0, n(m.liquidez)), r = Math.max(0, n(m.renta)), c = Math.max(0, n(m.crecimiento));
  const s = l + r + c;
  if (s <= 0) return { liquidez: 100, renta: 0, crecimiento: 0 };
  return { liquidez: (l / s) * 100, renta: (r / s) * 100, crecimiento: (c / s) * 100 };
}

/** Paso 6: cuánto dan $100M (u otro monto) a 3, 5 y 10 años, nominal y en pesos de hoy. */
export function cienMillones(presetClave, esc, monto = 100e6, sup = SUPUESTOS_F10) {
  const r = retornoNominalPreset(presetClave, esc, sup) / 100;
  const inf = esc.inflacionPct / 100;
  return [3, 5, 10].map((a) => { const nom = monto * Math.pow(1 + r, a); return { anios: a, nominal: nom, hoy: nom / Math.pow(1 + inf, a) }; });
}
