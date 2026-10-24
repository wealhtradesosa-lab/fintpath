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
// Supuestos de referencia definidos con Finpathia · Finanzas (24-oct-2026); centralizados en SUPUESTOS_F10.
// ═══════════════════════════════════════════════════════════════════════════
import { calcularBase, tipoActivo, esLiquido } from "./metrics.js";

export const INFLACION_F10_PCT = 5; // base a 10 años (Finanzas, 24-oct-2026)
export const RETORNO_REAL_ALTO_PCT = 12; // aviso suave, no bloquea
export const SUPUESTOS_F10 = {
  version: 2,
  anios: 10,
  colchonMeses: 6, // de obligaciones (gastos + cuotas); Metas › Fondo de emergencia manda si existe
  escenarios: {
    pesimista: { nombre: "Pesimista", inflacionPct: 7, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3, devaluacionRealPct: 0 },
    base: { nombre: "Base", inflacionPct: null /* = user.inflacionPct o 5% */, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 5.5, devaluacionRealPct: 0 },
    optimista: { nombre: "Optimista", inflacionPct: 3.5, ingresosSpread: 2, gastosSpread: 0, retornoSpread: 1, spRealPct: 7.5, devaluacionRealPct: 0 },
  },
  // Fuente y fecha de cada supuesto (se muestran en pantalla).
  fuentes: {
    inflacion: "Inflación implícita TES 10 años 5,95% (16-oct-2026) y encuesta de expectativas BanRep (oct-2026)",
    rfCorto: "Banco de la República, DTF 90 días 10,44% E.A. (19–25 oct 2026)",
    rfLargo: "TES UVR 10 años (16-oct-2026)",
    fincaRaiz: "Aptología (18-oct-2026) y Global Property Guide (Q3 2026), neto de costos",
    sp500: "UBS Global Investment Returns Yearbook 2026; promedio largo plazo ajustado a valuaciones actuales",
    devaluacion: "Sin fuente directa: paridad de poder de compra. TRM 3.158,43 (24-oct-2026)",
    vehiculo: "Estimación interna, sin fuente oficial",
    colchon: "BBVA y Bancolombia recomiendan de 3 a 6 meses",
  },
  // Tasa cuando la deuda no tiene la suya: promedio publicado por modalidad (E.A.).
  // ACTUALIZAR CADA TRIMESTRE (Superfinanciera, tasas de interés por modalidad). Próxima revisión: ene-2027.
  // hipotecarioUVR es tasa REAL sobre UVR (el saldo ya se indexa con la inflación): no usar la nominal en pesos.
  tasasDeuda: {
    hipotecario: { pct: 13.94, fecha: "25-sep-2026", fuente: "Superfinanciera, tasa promedio por modalidad (vivienda No VIS en pesos)" },
    // hipotecarioUVR: el dataset oficial kett-344s (datos.gov.co) no devolvió filas desde el servidor el 24-oct-2026; valor de un agregador.
    hipotecarioUVR: { pct: 8.95, real: true, fecha: "25-sep-2026", fuente: "Superfinanciera vía agregador, promedio No VIS en UVR (real sobre UVR)" },
    vehiculo: { pct: 21.06, fecha: "25-sep-2026", fuente: "Superfinanciera, tasa promedio por modalidad (vehículo)" },
    consumo: { pct: 19.06, fecha: "25-sep-2026", fuente: "Superfinanciera, tasa promedio por modalidad (consumo)" },
    tarjeta: { pct: 24.85, fecha: "25-sep-2026", fuente: "Superfinanciera, tasa promedio por modalidad (tarjeta de crédito)" },
  },
  // Presets de retorno. realSpread = puntos sobre la inflación del escenario.
  presets: {
    rfCorto: { nombre: "Renta fija corto plazo", realSpread: 2.5 },
    rfLargo: { nombre: "Renta fija largo plazo", realSpread: 3.5, topeSpread: 4.5 },
    fincaRaiz: { nombre: "Finca raíz", rentaNetaPct: 5, valorizacionSpread: -0.5 /* puntos: inflación − 0,5 */ },
    sp500: { nombre: "S&P 500 (USD)", usd: true /* real: escenario.spRealPct; devaluación: escenario */ },
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
  const infUser = user.inflacionPct != null && user.inflacionPct !== "" ? n(user.inflacionPct) : INFLACION_F10_PCT;
  const inflacionPct = e.inflacionPct == null ? infUser : e.inflacionPct;
  const devaluacionRealPct = user.devaluacionRealPct != null && user.devaluacionRealPct !== "" ? n(user.devaluacionRealPct) : n(e.devaluacionRealPct);
  return { ...e, clave, inflacionPct, devaluacionRealPct };
}

/** Retorno total NOMINAL anual (%) de un preset bajo un escenario. Fisher: (1+i)(1+r)−1. */
export function retornoNominalPreset(clave, esc, sup = SUPUESTOS_F10, override = {}) {
  const p = { ...sup.presets[clave], ...override };
  const i = esc.inflacionPct / 100;
  let real;
  if (clave === "sp500") real = (override.realPct ?? esc.spRealPct) + n(esc.devaluacionRealPct);
  else if (clave === "fincaRaiz") {
    // renta neta (sobre el valor) + valorización = inflación + spread
    const val = i + n(p.valorizacionSpread) / 100; // inflación − 0,5 puntos
    return ((val + (n(p.rentaNetaPct) + esc.retornoSpread) / 100 * (1 + val)) * 100);
  } else {
    real = n(p.realSpread) + esc.retornoSpread;
    if (p.topeSpread != null) real = Math.min(real, p.topeSpread);
  }
  return i * 100 + real; // suma simple: renta fija corto = 5 + 2,5 = 7,5% (decisión de Finanzas, oct-2026)
}

/** Estimado de una inversión predefinida: % NOMINAL anual del escenario + su fuente. Nunca vacío. */
export function estimadoPreset(clave, esc, sup = SUPUESTOS_F10) {
  if (!sup.presets[clave]) return null;
  const pct = Math.round(retornoNominalPreset(clave, esc, sup) * 10) / 10;
  const F = sup.fuentes;
  const fuente = clave === "sp500" ? `${F.sp500}; devaluación: ${F.devaluacion}` : F[clave] || "Supuesto interno";
  return { pct, fuente: `${fuente} · escenario ${esc.nombre || esc.clave}, inflación ${String(esc.inflacionPct).replace(".", ",")}%` };
}
/** % nominal que usa el motor para una inversión predefinida: el del usuario si lo editó; si no, el estimado. */
export const rendimientoNuevaPct = (x, esc, sup = SUPUESTOS_F10) =>
  (x && x.rendimientoNomPct !== "" && x.rendimientoNomPct != null && Number.isFinite(Number(x.rendimientoNomPct)) ? Number(x.rendimientoNomPct) : retornoNominalPreset(x.preset, esc, sup));

/** Barra de «Reinvierte» (10 años, pesos de hoy). Disponible = liquidez sobre el colchón + ventas brutas + flujo libre − comprometido en el paso 2. */
export function resumenReinvertir(disp = []) {
  const s = (f) => disp.reduce((t, d) => t + n(f(d)), 0);
  const deVentas = s((d) => d.ventas);
  const deCaja = s((d) => d.liquidezHoy - d.colchon + d.flujo);
  const comprometido = s((d) => d.adicionales + d.pagosFuturos); // paso 2: Construir o mejorar, pagos de activos futuros
  const asignado = s((d) => d.asignado); // paso 3: inversiones nuevas
  const disponible = deVentas + deCaja - comprometido; // = Σ antesDeAsignar
  // Faltante = Σ por año de max(0, asignado − disponible de ese año). Es el MISMO número de
  // «te faltan» en cada inversión y en la alerta: la plata de años futuros no paga una inversión de hoy.
  const faltan = disp.reduce((t, d) => t + Math.max(0, n(d.asignado) - n(d.liquidezHoy + d.ventas - d.colchon + d.flujo - d.adicionales - d.pagosFuturos)), 0);
  return { deVentas, deCaja, comprometido, disponible, asignado, queda: disponible - asignado, faltan };
}
export const esCripto = (a = {}) => /crypt|cripto|btc|bitcoin|ethereum|\beth\b/i.test(`${a.tp || a.tipo || ""} ${a.n || a.nombre || ""}`);

export function claseActivo(a) {
  const tp = tipoActivo(a);
  if (/veh/i.test(tp)) return "vehiculo";
  if (["Real Estate", "Local Comercial", "Bodega"].includes(tp)) return "inmueble";
  if (["Acciones", "ETF"].includes(tp)) return "acciones";
  if (esLiquido(a)) return "liquido";
  return "otro";
}

const vacioM = (v) => v === "" || v == null;
const anioOk = (v, d = 1) => Math.min(10, Math.max(1, Math.round(n(v) || d)));

/** Colchón: Metas › Fondo de emergencia si existe; si no, 6 meses de obligaciones (gastos + cuotas). Igual que Patrimonio. */
export function metaColchonF10(user = {}, b = null, sup = SUPUESTOS_F10) {
  const meta = (user.metas || []).find((m) => m && (m.type === "emergency" || /emergencia/i.test(String(m.name || m.nombre || ""))) && n(m.target) > 0);
  if (meta) return n(meta.target);
  const base = b || calcularBase({ ...user, gastos: user.gastos || user.gas }, {});
  return base.ob * n(sup.colchonMeses);
}

/** Tasa anual (%) de una deuda: la suya o la promedio publicada para su modalidad. Nunca 0%.
 *  Con UVR la tasa es REAL sobre UVR (el saldo se indexa aparte con la inflación). */
export function tasaDeuda(d = {}, override = {}, sup = SUPUESTOS_F10) {
  const uvr = !!override.uvr;
  if (!vacioM(override.tasaPct) && n(override.tasaPct) > 0) return { pct: n(override.tasaPct), estimada: false, real: uvr };
  if (!vacioM(d.ts) && n(d.ts) > 0) return { pct: n(d.ts), estimada: false, real: uvr };
  const tp = String(d.tp || d.tipo || "").toLowerCase();
  let k = /mortg|hipot|vivienda|leasing/.test(tp) ? "hipotecario" : /veh|carro|auto/.test(tp) ? "vehiculo" : /tarj|card|credit/.test(tp) ? "tarjeta" : "consumo";
  if (uvr) k = "hipotecarioUVR"; // en UVR solo hay tasa real publicada (vivienda)
  const t = sup.tasasDeuda[k];
  return { pct: t.pct, estimada: true, tipo: k, real: uvr, fuente: t.fuente, fecha: t.fecha, etiqueta: uvr ? `UVR + ${fmtPct(t.pct)} (Superfinanciera, promedio No VIS en UVR, ${t.fecha}). Es un promedio, no tu tasa.` : `${fmtPct(t.pct)} E.A.` };
}

/** Retorno real (%) a partir del nominal: (1+n)/(1+i)−1, una sola vez. */
export const realDesdeNominal = (nomPct, esc) => ((1 + n(nomPct) / 100) / (1 + esc.inflacionPct / 100) - 1) * 100;
/** Aviso suave B: real por encima de ~12%. */
export const avisoRetornoAlto = (nomPct, esc) => (!vacioM(nomPct) && realDesdeNominal(nomPct, esc) > RETORNO_REAL_ALTO_PCT ? "Supuesto alto, revisa." : null);

/** Un «activo futuro» que en realidad es un ingreso (pensión, jubilación). */
export const pareceIngresoFuturo = (nombre) => /pensi[oó]n|jubilaci[oó]n|mesada/i.test(String(nombre || ""));

/**
 * Migra un escenario guardado a version 2 (idempotente).
 * - reinversiones[] → decisiones[id] «Construir o mejorar» con inversión año 1 (se suma).
 * - «Se modifica» (valorizacionNomPct / retornoRealPct / inversionMonto / rentaNuevaMensual) → rendimientoPct + obra.
 */
export function migrarConfigF10(cfg = {}, user = {}) {
  if (!cfg || cfg.version === 2) return cfg || {};
  const esc = resolverEscenario(cfg.escenario || "base", user);
  const decisiones = {};
  Object.entries(cfg.decisiones || {}).forEach(([id, d]) => {
    if (!d || d.accion !== "modifica") { decisiones[id] = { ...d }; return; }
    const m = leerModifica(d, esc);
    const x = { accion: "continua" };
    if (m.valorizacionNomPct != null) x.rendimientoPct = Math.round(m.valorizacionNomPct * 100) / 100;
    const inversiones = m.inversionMonto > 0 ? [{ monto: m.inversionMonto, anio: m.inversionAnio }] : [];
    if (inversiones.length || m.rentaNuevaMensual > 0) {
      x.accion = "construye";
      x.obra = { inversiones, anioLista: m.rentaNuevaMensual > 0 ? m.rentaNuevaDesde : m.inversionAnio, rentaMensual: m.rentaNuevaMensual || "", renta: "retira", valorFinal: "", tipoNuevo: "" };
    }
    decisiones[id] = x;
  });
  (cfg.reinversiones || []).forEach((r) => {
    if (!r || !(n(r.monto) > 0) || !r.activoId) return;
    const d = decisiones[r.activoId] || { accion: "continua" };
    if (d.accion === "vende") return;
    const obra = d.obra || { inversiones: [], anioLista: 1, rentaMensual: "", renta: "retira", valorFinal: "", tipoNuevo: "" };
    decisiones[r.activoId] = { ...d, accion: "construye", obra: { ...obra, inversiones: [...obra.inversiones, { monto: n(r.monto), anio: 1 }] } };
  });
  const { reinversiones, ...resto } = cfg;
  return { ...resto, decisiones, version: 2 };
}

const CLASE_FUTURO = { inmueble: "inmueble", local: "inmueble", lote: "inmueble", negocio: "otro", financiera: "liquido", vehiculo: "vehiculo", otro: "otro" };
export const TIPOS_ACTIVO_FUTURO = [["inmueble", "Finca raíz"], ["local", "Local / comercial"], ["lote", "Lote"], ["negocio", "Negocio"], ["financiera", "Inversión financiera"], ["vehiculo", "Vehículo"], ["otro", "Otro"]];
export const TIPOS_OBRA = [["", "Igual que hoy"], ["inmueble", "Finca raíz (casa, apto)"], ["local", "Local / bodega"], ["negocio", "Negocio"], ["otro", "Otro"]];

/**
 * @param {object} user  datos del usuario (inv, ingresos, gas, deu, metas, trm, inflacionPct)
 * @param {object} cfg   escenario v2 (o v1: se migra)
 */
export function proyectarFuturo10(user = {}, cfgIn = {}) {
  const cfg = migrarConfigF10(cfgIn, user);
  const sup = cfg.supuestos || SUPUESTOS_F10;
  const esc = resolverEscenario(cfg.escenario || "base", { ...user, devaluacionRealPct: cfg.devaluacionRealPct ?? user.devaluacionRealPct }, sup);
  const N = n(cfg.anios) || sup.anios;
  const inf = esc.inflacionPct / 100;
  const dev = n(esc.devaluacionRealPct) / 100;
  const gIng = (1 + inf) * (1 + esc.ingresosSpread / 100) - 1;
  const gGas = (1 + inf) * (1 + esc.gastosSpread / 100) - 1;
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm;
  const fxA = (a) => (String(a?.moneda || a?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const dec = cfg.decisiones || {};
  const prefs = cfg.activos || {};
  const rNom = (k, ov) => retornoNominalPreset(k, esc, sup, ov) / 100;
  const alertas = [];
  const disp = Array.from({ length: N }, (_, i) => ({ anio: i + 1, liquidezHoy: 0, ventas: 0, colchon: 0, flujo: 0, adicionales: 0, pagosFuturos: 0, asignado: 0, asignaciones: [] }));

  // ── Activos existentes ─────────────────────────────────────────────────
  let bolsa = 0;
  const activos = [];
  (b.inv || []).forEach((a) => {
    const d = dec[a.id] || {};
    const pr = prefs[a.id] || {};
    const valor = n(a.va) * fxA(a);
    const rentaAnual = n(b.rentaNetaPorActivo[a.id]) * 12;
    const anioVenta = d.accion === "vende" ? anioOk(d.anioVenta) : null;
    if (anioVenta === 1) { bolsa += valor; activos.push({ id: a.id, nombre: a.n || a.nombre || "Activo", clase: claseActivo(a), valor: 0, vendido: true, rentaAnual, rentaModo: "fuera", usd: false, invertible: true }); return; }
    const clase = claseActivo(a);
    let crec = crecimientoDefault(a, esc, sup, rentaAnual);
    const pct = !vacioM(d.rendimientoPct) ? d.rendimientoPct : pr.rendimientoPct;
    if (!vacioM(pct) && clase !== "vehiculo") {
      crec = n(pct) / 100;
      const av = avisoRetornoAlto(pct, esc);
      if (av) alertas.push({ tipo: "retorno_alto", anio: 0, texto: `${a.n || a.nombre || "Un activo"}: ${fmtPct(pct)} al año. ${av}` });
    }
    const obra = d.accion === "construye" ? leerObra(d.obra) : null;
    activos.push({ id: a.id, nombre: a.n || a.nombre || "Activo", clase, valor, crec, usd: fxA(a) !== 1, invertible: clase !== "vehiculo",
      rentaAnual, rentaModo: rentaAnual > 0 && pr.renta === "reinvierte" ? "reinvierte" : "retira", anioVenta, obra });
  });

  // ── Colchón y bolsa de hoy ───────────────────────────────────────────────
  const metaColchon = metaColchonF10(user, b, sup);
  const liquidosQueQuedan = activos.filter((a) => a.clase === "liquido" && !a.vendido).reduce((s, a) => s + a.valor, 0);
  const canasta = { liquidez: 0, renta: 0, crecimiento: 0 };
  let colchon = Math.min(bolsa, Math.max(0, metaColchon - liquidosQueQuedan));
  disp[0].liquidezHoy = Math.max(0, liquidosQueQuedan - metaColchon); disp[0].ventas = bolsa; disp[0].colchon = colchon;
  bolsa -= colchon;
  const nuevas = [], personalizadas = [];
  let faltaInicial = 0; // inversiones del año 1 más grandes que la plata disponible: nunca se recortan en silencio
  (cfg.nuevas || []).forEach((x, k) => {
    if (x.preset === "custom") { const c = leerPersonalizada(x, esc, sup); if (c.monto > 0) personalizadas.push({ ...c, id: "nueva_" + k }); return; }
    const m = Math.min(bolsa, Math.max(0, n(x.monto)));
    if (n(x.monto) > 0 && sup.presets[x.preset]) { disp[0].asignado += n(x.monto); disp[0].asignaciones.push({ tipo: "nueva", idx: k, nombre: x.nombre || sup.presets[x.preset].nombre, monto: n(x.monto) }); }
    if (!(n(x.monto) > 0) || !sup.presets[x.preset]) return;
    bolsa -= m;
    const p = sup.presets[x.preset];
    const falta = n(x.monto) - m;
    if (falta > 0) faltaInicial += falta;
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || p.nombre, rendPct: rendimientoNuevaPct(x, esc, sup), monto: n(x.monto), anio: 1, faltante: falta, clase: x.preset === "rfCorto" ? "liquido" : "nueva", valor: n(x.monto), crec: rendimientoNuevaPct(x, esc, sup) / 100, usd: !!p.usd, invertible: true });
  });
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  const repartir = (m) => ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] += m * mezcla[k] / 100; });
  repartir(bolsa);
  const rCan = { liquidez: rNom(sup.canastas.liquidez), renta: rNom(sup.canastas.renta), crecimiento: rNom(sup.canastas.crecimiento) };

  // ── Deudas: cuota fija nominal (UVR: indexada), interés sobre saldo ─────
  const deudas = (user.deu || []).filter(Boolean).map((d) => {
    const ov = (cfg.deudas || {})[d.id] || {};
    const t = tasaDeuda(d, ov, sup);
    const saldo = n(d.mt) * fxA(d), cuota = n(d.pg ?? d.pago) * fxA(d);
    if (t.estimada && saldo > 0) alertas.push({ tipo: "tasa_estimada", anio: 0, texto: `${d.n || d.nombre || "Una deuda"}: tasa estimada, agrégala. Usamos ${t.real ? t.etiqueta : `${t.etiqueta} (${t.fuente}, ${t.fecha})`}` });
    if (saldo <= 0 && cuota > 0) alertas.push({ tipo: "deuda_sin_saldo", anio: 0, texto: `${d.n || d.nombre || "Una deuda"} tiene cuota pero no saldo: la cuota se mantiene los 10 años. Agrega el saldo.` });
    return { nombre: d.n || d.nombre || "Deuda", saldo, cuota, tasa: t.pct / 100, uvr: !!ov.uvr, sinSaldo: saldo <= 0 && cuota > 0 };
  }).filter((d) => d.saldo > 0 || d.cuota > 0);
  const deudaTotal = () => deudas.reduce((s, d) => s + d.saldo, 0);
  const cuotasHoy = deudas.reduce((s, d) => s + d.cuota, 0) * 12;

  let ingresosBase = (b.ia + b.ip) * 12;
  let rentaExist = activos.reduce((s, a) => s + (a.rentaAnual > 0 && !(a.vendido) && a.rentaModo === "retira" ? a.rentaAnual : 0), 0);
  // Las rentas de activos existentes se modelan aparte (para venta / reinversión).
  const rentaTodas = activos.reduce((s, a) => s + a.rentaAnual, 0);
  let otrosIngresos = Math.max(0, ingresosBase - rentaTodas);
  const ipOtros = Math.max(0, b.ip * 12 - rentaTodas); // pasiva no vinculada a activos
  // Gastos vinculados a un activo (predial, administración sin renta que los netee): salen de G
  // y se suman aparte mientras el activo no se haya vendido; desde el año de venta dejan de correr.
  const gVinc = b.gastoVinculadoEnG || {};
  const gVincTotal = Object.values(gVinc).reduce((s, m) => s + (n(m) || 0) * 12, 0);
  let gastos = (b.ob - b.sd) * 12 - gVincTotal;
  const todos = [...activos, ...nuevas];
  let deficit = faltaInicial; // faltante acumulado (nunca se vende finca raíz sola)
  const valorTotal = () => todos.reduce((s, a) => s + a.valor, 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento - deficit;
  const invertible = () => todos.filter((a) => a.invertible).reduce((s, a) => s + a.valor, 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento - deficit;
  const filas = [];
  const fila0 = { anio: 0, ingresos: ingresosBase, gastos: gastos + gVincTotal + cuotasHoy, cf: 0, activos: valorTotal(), invertible: invertible(), deuda: deudaTotal(),
    liquidez: colchon + canasta.liquidez + liquidosQueQuedan, rentaPasiva: b.ip * 12 - rentaTodas + rentaExist };
  fila0.patrimonio = fila0.activos - fila0.deuda; fila0.deflactor = 1;
  fila0.patrimonioReal = fila0.patrimonio; fila0.invertibleReal = fila0.invertible; fila0.rentaPasivaReal = fila0.rentaPasiva;
  filas.push(fila0);
  let liqAgotadaAnio = null, hayVentas = bolsa + colchon > 0 || activos.some((a) => a.anioVenta);

  const fut = leerFuturos(cfg.futuros, esc, sup);
  fut.activos.forEach((x, k) => todos.push({ id: "futuro_" + k, nombre: x.nombre, clase: x.clase, valor: 0, crec: x.crec, entrega: x.entrega, pagos: x.pagos, usd: false, invertible: x.clase !== "vehiculo", rentaFutura: x.rentaMensual * 12, rentaDesde: x.rentaDesde }));
  let expUSD = canasta.crecimiento > 0;
  for (let t = 1; t <= N; t++) {
    // Convención única: base = pesos de hoy (inicio del año 1).
    // Flujos del año t (ingresos, rentas, cuotas, inversiones) → factor (1+i)^(t-1): el año 1 vale 1.
    // Saldos al cierre del año t (patrimonio, metas, valor final) → deflactor (1+i)^t.
    const idx = Math.pow(1 + inf, t); // saldos al cierre del año t
    const fIdx = Math.pow(1 + inf, t - 1); // flujos durante el año t
    const dA = disp[t - 1];
    // Retiro en orden: colchón → liquidez → activos líquidos (fondos, CDT, acciones). Nunca finca raíz ni ilíquidos.
    const retirar = (monto) => {
      let falta = monto;
      const sacar = (v) => { const u = Math.min(Math.max(0, v), falta); falta -= u; return v - u; };
      colchon = sacar(colchon);
      canasta.liquidez = sacar(canasta.liquidez);
      todos.filter((a) => a.clase === "liquido").forEach((a) => { a.valor = sacar(a.valor); });
      canasta.renta = sacar(canasta.renta);
      canasta.crecimiento = sacar(canasta.crecimiento);
      todos.filter((a) => a.clase === "acciones").forEach((a) => { a.valor = sacar(a.valor); });
      if (falta > 0) { deficit += falta; if (liqAgotadaAnio == null) liqAgotadaAnio = t; }
    };
    const depositar = (m) => {
      if (m <= 0) return;
      if (deficit > 0) { const u = Math.min(deficit, m); deficit -= u; m -= u; }
      const liq = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
      const falta = Math.max(0, metaColchon * idx - liq);
      const c = Math.min(falta, m); colchon += c; m -= c; if (dA && t > 1) dA.colchon += c / fIdx;
      repartir(m);
    };
    // 0) inversiones personalizadas del año
    personalizadas.forEach((c) => {
      if (c.anio !== t) return;
      const antes = deficit;
      retirar(c.monto);
      const sinPlata = Math.min(c.monto, deficit - antes);
      todos.push({ id: c.id, nombre: c.nombre, monto: c.monto, anio: t, faltante: (deficit - antes) / fIdx, fondeado: c.monto > 0 ? 1 - sinPlata / c.monto : 1, clase: "nueva", valor: c.monto, crec: c.pagaRenta ? 0 : c.rendNom, rentaPct: c.pagaRenta ? c.rendNom : 0, /* paga renta: % NOMINAL sobre el capital, capital nominal */ rendPct: c.rendNom * 100, usd: c.usd, invertible: true });
    });
    // 1) ventas en su año (valor bruto, sin costos ni impuestos)
    activos.forEach((a) => {
      if (a.anioVenta && a.anioVenta === t && !a.vendido) {
        const v = a.valor; a.valor = 0; a.vendido = true;
        if (dA) dA.ventas += v / Math.pow(1 + inf, t - 1);
        depositar(v);
      }
    });
    // 2) valorización / depreciación del año (el % es SOLO valorización)
    todos.forEach((a) => {
      if (a.vendido) return;
      if (a.entrega && t <= a.entrega) return;
      if (a.crec == null || a.clase === "vehiculo") { const p = t <= 3 ? sup.vehiculo.depAnios1a3Pct : sup.vehiculo.depDespuesPct; a.valor *= 1 + p / 100; }
      else a.valor *= 1 + a.crec;
      if (a.usd && a.clase !== "acciones") a.valor *= 1 + dev; // caja y activos en USD: devaluación del escenario
    });
    colchon *= 1 + rCan.liquidez;
    Object.keys(canasta).forEach((k) => { canasta[k] *= 1 + rCan[k]; });
    // 3) obras («Construir o mejorar»): inversión por año sale de la plata disponible
    activos.forEach((a) => {
      if (!a.obra || a.vendido) return;
      a.obra.inversiones.forEach((iv) => {
        if (iv.anio !== t || iv.monto <= 0) return;
        const m = iv.monto * fIdx; // monto en pesos de hoy → pesos del año en que se gasta
        retirar(m); a.valor += m;
        if (dA) dA.adicionales += iv.monto;
        alertas.push({ tipo: "inversion_adicional", anio: t, texto: `En el año ${t} pasas plata de tu liquidez a ${a.nombre}.` });
      });
      if (a.obra.anioLista === t) {
        if (a.obra.valorFinal > 0) a.valor = Math.max(0, a.obra.valorFinal * idx);
        if (a.obra.tipoNuevo) { a.clase = CLASE_FUTURO[a.obra.tipoNuevo] || a.clase; if (vacioM((dec[a.id] || {}).rendimientoPct) && vacioM((prefs[a.id] || {}).rendimientoPct)) a.crec = a.clase === "inmueble" ? inf + n(sup.presets.fincaRaiz.valorizacionSpread) / 100 : inf; }
      }
    });
    // 4) flujo del año
    if (t > 1) { otrosIngresos *= 1 + gIng; gastos *= 1 + gGas; }
    const gR = Math.pow(1 + gIng, t - 1);
    const gastosVinculados = activos.reduce((s, a) => s + (!a.vendido && gVinc[a.id] > 0 ? gVinc[a.id] * 12 * Math.pow(1 + gGas, t - 1) : 0), 0);
    let rentaRetirada = 0;
    activos.forEach((a) => {
      if (a.vendido || !(a.rentaAnual > 0)) return;
      // Inmueble: el arriendo se indexa. Activo financiero que paga renta: cupón nominal fijo.
      const r = a.rentaAnual * (a.clase === "inmueble" ? gR : 1);
      if (a.rentaModo === "reinvierte") a.valor += r; else rentaRetirada += r;
    });
    let rentaNueva = 0;
    activos.forEach((a) => {
      if (!a.obra || a.vendido || !(a.obra.rentaMensual > 0) || t < a.obra.anioLista) return;
      const r = a.obra.rentaMensual * 12 * fIdx;
      if (a.obra.renta === "reinvierte") a.valor += r; else rentaNueva += r;
    });
    // 24-oct-2026 (QA PR #56): la renta de una inversión nueva solo entra al flujo por la parte
    // que tiene plata cuando entra (convención Finanzas: lo que falta no está invertido y no rinde).
    rentaNueva += todos.reduce((s, a) => s + (a.rentaPct ? a.valor / (1 + a.crec) * a.rentaPct * (a.fondeado ?? 1) : 0), 0);
    const ingFuturo = fut.ingresos.reduce((s, x) => s + (t >= x.desde && t <= x.hasta ? x.mensual * 12 * (x.fijo ? 1 : fIdx) : 0), 0);
    const rentaFut = todos.reduce((s, a) => s + (a.rentaFutura > 0 && t >= a.rentaDesde ? a.rentaFutura * fIdx : 0), 0);
    rentaNueva += ingFuturo + rentaFut;
    let cuota = 0;
    deudas.forEach((d) => {
      const c = d.uvr ? d.cuota * 12 * fIdx : d.cuota * 12;
      if (d.sinSaldo) { cuota += c; return; }
      if (d.saldo <= 0) return;
      if (d.uvr) d.saldo *= 1 + inf;
      const interes = d.saldo * d.tasa;
      const pago = Math.min(c, d.saldo + interes);
      d.saldo = Math.max(0, d.saldo + interes - pago); cuota += pago;
    });
    const ingresos = otrosIngresos + rentaRetirada;
    const cf = ingresos + rentaNueva - gastos - gastosVinculados - cuota;
    if (cf >= 0) depositar(cf);
    else retirar(-cf);
    // 5) pagos de activos futuros
    todos.forEach((a) => (a.pagos || []).forEach((pg) => {
      if (pg.anio !== t || pg.monto <= 0) return;
      retirar(pg.monto); a.valor += pg.monto;
      if (dA) dA.pagosFuturos += pg.monto / fIdx;
      alertas.push({ tipo: "pago_futuro", anio: t, texto: `En el año ${t} pagas parte de ${a.nombre} con tu liquidez.` });
    }));
    if (canasta.crecimiento > 0) expUSD = true;
    const deflactor = Math.pow(1 + inf, t);
    if (deficit > 0) alertas.push({ tipo: "faltante", anio: t, monto: deficit / deflactor, texto: `Faltante de ${fmtPlata(deficit / deflactor)} en el año ${t} (pesos de hoy). No vendemos nada por ti: decide en el paso 2 si vendes algo.` });
    if (cf < 0) alertas.push({ tipo: "cf_negativo", anio: t, texto: `En el año ${t} sale más de lo que entra; se usa tu liquidez.` });
    const liquidez = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0) - deficit;
    if (dA) {
      dA.flujo = cf / fIdx;
      personalizadas.forEach((c) => { if (c.anio === t) { dA.asignado += c.monto / fIdx; dA.asignaciones.push({ tipo: "nueva", idx: Number(String(c.id).split("_")[1]), nombre: c.nombre, monto: c.monto / fIdx }); } });
    }
    const activosT = valorTotal();
    const deuda = deudaTotal();
    const rentaPasiva = ipOtros * Math.pow(1 + gIng, t - 1) + rentaRetirada + rentaNueva - ingFuturo + fut.ingresos.reduce((s, x) => s + (x.renta && t >= x.desde && t <= x.hasta ? x.mensual * 12 * (x.fijo ? 1 : fIdx) : 0), 0);
    const f = { anio: t, ingresos: ingresos + rentaNueva, rentaNueva, rentaPasiva, gastos: gastos + gastosVinculados + cuota, gastosVinculados, cf, activos: activosT, invertible: invertible(), deuda, liquidez, deflactor, faltante: deficit };
    f.patrimonio = activosT - deuda;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.factorFlujo = fIdx;
    f.ingresosReal = f.ingresos / fIdx; f.gastosReal = f.gastos / fIdx; f.rentaPasivaReal = rentaPasiva / fIdx;
    if (deficit <= 0 && metaColchon > 0 && liquidez < metaColchon * idx) alertas.push({ tipo: "liquidez_baja", anio: t, texto: `En el año ${t} tu liquidez queda por debajo de tu colchón.` });
    filas.push(f);
  }
  const fin = filas[filas.length - 1];
  disp.forEach((d) => {
    d.antesDeAsignar = d.liquidezHoy + d.ventas - d.colchon + d.flujo - d.adicionales - d.pagosFuturos;
    d.queda = d.antesDeAsignar - d.asignado;
    d.exceso = d.asignado > 0 && d.queda < 0 ? -d.queda : 0;
    // Reparte el exceso del año entre sus inversiones nuevas, en orden: una sola fórmula de faltante.
    let resto = Math.max(0, d.antesDeAsignar);
    d.asignaciones.filter((x) => x.tipo === "nueva").forEach((x) => {
      const usa = Math.min(resto, x.monto); resto -= usa;
      const id = "nueva_" + x.idx, inv = todos.find((a) => a.id === id && a.anio === d.anio);
      if (inv) inv.faltante = x.monto - usa;
    });
  });
  todos.filter((a) => String(a.id).startsWith("nueva_") && a.faltante > 0).forEach((a) => alertas.unshift({ tipo: "nueva_sin_plata", anio: a.anio, monto: a.faltante,
    texto: `${a.nombre}: te faltan ${fmtPlata(a.faltante)} para invertir ${fmtPlata(a.monto)} en el año ${a.anio}. La incluimos completa; lo que falta queda como faltante.` }));
  const hayNuevaSinPlata = alertas.some((x) => x.tipo === "nueva_sin_plata");
  if (hayNuevaSinPlata) for (let k = alertas.length - 1; k >= 0; k--) if (alertas[k].tipo === "faltante") alertas.splice(k, 1); // el faltante ya está dicho por inversión
  disp.filter((d) => d.exceso > 0 && !hayNuevaSinPlata).forEach((d) => alertas.push({ tipo: "exceso", anio: d.anio, texto: `Te pasas por ${fmtPlata(d.exceso)} en el año ${d.anio}. Saldría de tu colchón y luego de tus inversiones.` }));
  return {
    escenario: esc, mezcla, filas, alertas, liqAgotadaAnio, disponible: disp, metaColchon, hayVentas,
    hoy: { patrimonio: b.patrimonioNeto, ingresoMensual: b.ia + b.ip, salidaMensual: b.ob, flujoMensual: b.fl, liquidos: b.liquidos, colchonMeses: b.colchonMeses, rentaPasivaMensual: b.ip },
    activos: activos.filter((a) => a.anioVenta !== 1 || true).map(({ id, nombre, clase, usd, rentaAnual }) => ({ id, nombre, clase, usd, rentaMensual: rentaAnual / 12 })),
    nuevasDetalle: todos.filter((a) => String(a.id).startsWith("nueva_")).map((a) => ({ id: a.id, nombre: a.nombre, monto: a.monto, anio: a.anio, faltante: a.faltante || 0, valorFinal: a.valor / fin.deflactor, rentaMensual: rentaMensualNuevaAnioN(a), rentaMensualFondeada: rentaMensualNuevaAnioN(a) * (a.fondeado ?? 1), rendimientoPct: a.rendPct, usd: !!a.usd })),
    // Aviso cambiario solo por activos/inversiones en USD; lo del norte (S&P 500) se avisa aparte.
    hayUSD: todos.some((a) => a.usd && a.valor > 0) || personalizadas.some((a) => a.usd), usdPorNorte: expUSD,
    final: fin,
    vsInflacionReal: fila0.invertible > 0 ? (fin.invertibleReal / fila0.invertible - 1) * 100 : null,
  };
}

const fmtPct = (v) => String(Math.round(n(v) * 10) / 10).replace(".", ",") + "%";
const fmtPlata = (v) => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("es-CO");

/** «Construir o mejorar»: inversión por año, año en que queda lista, renta desde ahí, valor final y tipo nuevo. */
export function leerObra(o = {}) {
  const inversiones = (o?.inversiones || []).map((x) => ({ monto: Math.max(0, n(x.monto)), anio: anioOk(x.anio) })).filter((x) => x.monto > 0);
  const ultima = inversiones.reduce((m, x) => Math.max(m, x.anio), 1);
  return { inversiones, anioLista: vacioM(o?.anioLista) ? ultima : anioOk(o.anioLista), rentaMensual: Math.max(0, n(o?.rentaMensual)), renta: o?.renta === "reinvierte" ? "reinvierte" : "retira",
    valorFinal: Math.max(0, n(o?.valorFinal)), tipoNuevo: o?.tipoNuevo || "" };
}


/** Valorización NOMINAL anual por defecto (fracción) de un activo según su clase. */
export function crecimientoDefault(a, esc, sup = SUPUESTOS_F10, rentaAnual = 0) {
  const inf = esc.inflacionPct / 100;
  const clase = claseActivo(a);
  if (clase === "vehiculo") return null; // depreciación por año
  if (clase === "inmueble") return a.valorizacionPct != null && a.valorizacionPct !== "" ? n(a.valorizacionPct) / 100 : inf + n(sup.presets.fincaRaiz.valorizacionSpread) / 100;
  if (rentaAnual > 0) return 0; // paga renta: el capital queda nominal (se erosiona en pesos de hoy); la renta va al flujo
  if (clase === "liquido") return retornoNominalPreset("rfCorto", esc, sup) / 100;
  if (clase === "acciones") return retornoNominalPreset("sp500", esc, sup) / 100;
  return (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
}

/** Hint en % nominal para «¿Cuánto crees que se valoriza al año?». Vehículo: depreciación años 1–3. */
export function valorizacionHintPct(a, esc, sup = SUPUESTOS_F10) {
  const c = crecimientoDefault(a, esc, sup);
  return c == null ? sup.vehiculo.depAnios1a3Pct : c * 100;
}

const vacio = (v) => v === "" || v == null;
/**
 * Normaliza una decisión «Se modifica». Compatibilidad: escenarios guardados con
 * `retornoRealPct` (real, sobre la inflación) se convierten a nominal con Fisher.
 */
export function leerModifica(d = {}, esc) {
  const inf = esc.inflacionPct / 100;
  let valorizacionNomPct = null;
  if (!vacio(d.valorizacionNomPct)) valorizacionNomPct = n(d.valorizacionNomPct);
  else if (!vacio(d.retornoRealPct)) valorizacionNomPct = ((1 + inf) * (1 + n(d.retornoRealPct) / 100) - 1) * 100;
  const anio = (v) => Math.min(10, Math.max(1, Math.round(n(v) || 1)));
  return {
    valorizacionNomPct,
    inversionMonto: Math.max(0, n(d.inversionMonto)), inversionAnio: anio(d.inversionAnio),
    rentaNuevaMensual: Math.max(0, n(d.rentaNuevaMensual)), rentaNuevaDesde: anio(d.rentaNuevaDesde),
  };
}

/** Renta mensual NOMINAL de una inversión nueva que paga renta, en pesos del año en que entra
 *  (Finanzas, 24-oct-2026): monto × % nominal / 12, sin deflactar. Única fuente para el detalle. */
export function rentaMensualNuevaAnioN(x) {
  const pct = x.rentaPct != null ? x.rentaPct : (x.pagaRenta ? x.rendNom : 0);
  return pct > 0 ? n(x.monto) * pct / 12 : 0;
}

/** Hint (% nominal) para una inversión personalizada: renta fija corto plazo del escenario. */
export function rendimientoHintPct(esc, sup = SUPUESTOS_F10) { return retornoNominalPreset("rfCorto", esc, sup); }

/** Normaliza una inversión «Otra (personalizada)». Rendimiento en % NOMINAL. */
export function leerPersonalizada(x = {}, esc, sup = SUPUESTOS_F10) {
  const rend = vacio(x.rendimientoNomPct) ? rendimientoHintPct(esc, sup) : n(x.rendimientoNomPct);
  return {
    nombre: String(x.nombre || "").trim() || "Inversión personalizada",
    monto: Math.max(0, n(x.monto)), anio: Math.min(10, Math.max(1, Math.round(n(x.anio) || 1))),
    rendNom: rend / 100, usd: String(x.moneda || "COP").toUpperCase() === "USD", pagaRenta: x.tipo === "renta",
  };
}

/**
 * «Lo que viene». ingresos: [{nombre, mensual (pesos de hoy), desde, hasta?, titular?}]
 * activos: [{nombre, clase: "inmueble"|"otro", valor, cuotaInicial, anioCuota, entrega,
 *            pagos?:[{monto, anio}], rentaMensual (pesos de hoy), rentaDesde, valorizacionNomPct}]
 * Pagos en pesos de cada año. Si no hay `pagos`, se arma: cuota inicial en su año y el resto en la entrega.
 */
export function leerFuturos(f = {}, esc, sup = SUPUESTOS_F10) {
  const inf = esc.inflacionPct / 100;
  const anio = (v, d = 1) => Math.min(10, Math.max(1, Math.round(n(v) || d)));
  const ingresos = (f?.ingresos || []).map((x, k) => {
    const desde = anio(x.desde);
    return { nombre: String(x.nombre || "").trim() || `Ingreso futuro ${k + 1}`, mensual: Math.max(0, n(x.mensual)), desde, hasta: vacio(x.hasta) ? 99 : Math.max(desde, anio(x.hasta)), titular: x.titular || null, fijo: !!x.fijo, renta: !!x.renta };
  }).filter((x) => x.mensual > 0);
  const activos = (f?.activos || []).map((x, k) => {
    const entrega = anio(x.entrega);
    let pagos;
    if (Array.isArray(x.pagos) && x.pagos.length) pagos = x.pagos.map((p) => ({ monto: Math.max(0, n(p.monto)), anio: anio(p.anio) }));
    else {
      const valor = Math.max(0, n(x.valor)), cuota = Math.min(valor, Math.max(0, n(x.cuotaInicial)));
      pagos = [{ monto: cuota, anio: Math.min(anio(x.anioCuota), entrega) }, { monto: valor - cuota, anio: entrega }];
    }
    const clase = CLASE_FUTURO[x.clase] || "otro";
    const def = clase === "vehiculo" ? null : clase === "liquido" ? retornoNominalPreset("rfCorto", esc, sup) / 100 : clase === "inmueble" ? inf + n(sup.presets.fincaRaiz.valorizacionSpread) / 100 : (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
    return { nombre: String(x.nombre || "").trim() || `Activo futuro ${k + 1}`, clase, tipo: x.clase || "otro", entrega, pagos,
      crec: vacio(x.valorizacionNomPct) || clase === "vehiculo" ? def : n(x.valorizacionNomPct) / 100,
      rentaMensual: Math.max(0, n(x.rentaMensual)), rentaDesde: anio(x.rentaDesde, entrega) };
  }).filter((x) => x.pagos.some((p) => p.monto > 0));
  return { ingresos, activos };
}

/** Mezcla personalizada: debe sumar 100%. Devuelve null o el mensaje para mostrar. */
export function validarMezcla(m) {
  if (!m) return null;
  const s = ["liquidez", "renta", "crecimiento"].reduce((t, k) => t + (Number(m[k]) || 0), 0);
  if (Math.abs(s - 100) < 0.01) return null;
  return `La mezcla suma ${String(Math.round(s * 10) / 10).replace(".", ",")}%. Ajústala para que sume 100%.`;
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
