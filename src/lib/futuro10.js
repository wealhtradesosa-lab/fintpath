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
import { calcularBase, tipoActivo, esLiquido, tipoIngreso, esLaboral, INFLACION_DEFAULT_PCT } from "./metrics.js";
import { montoPromedioMensual } from "./flowHelpers.js";
import { esUS, tx, plataCorta, localeCifras } from "./region.js";

import { fmtPlataEs } from "./formato.js";
export const SUPUESTOS_F10 = {
  validadoPor: "Finpathia · Finanzas, 24-oct-2026",
  anios: 10,
  indexacionDefaultPct: 5, // 24-nov-2026: ingresos y gastos suben 5 % al año (editable)
  colchonMeses: 6, // colchón de liquidez, aparte de las mezclas
  escenarios: {
    pesimista: { nombre: "Prudentes", nombreEn: "Cautious", inflacionPct: 6, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3.5 },
    base: { nombre: "Normales", nombreEn: "Typical", inflacionPct: null /* = user.inflacionPct (4%) */, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 6.5 },
    optimista: { nombre: "Favorables", nombreEn: "Favorable", inflacionPct: 3, ingresosSpread: 2, gastosSpread: 0, retornoSpread: 1, spRealPct: 8 },
  },
  // Presets de retorno. realSpread = puntos sobre la inflación del escenario.
  presets: {
    rfCorto: { nombre: "Renta fija corto plazo", nombreEn: "Short-term fixed income", realSpread: 2.5 },
    rfLargo: { nombre: "Renta fija largo plazo", nombreEn: "Long-term fixed income", realSpread: 3.5, topeSpread: 4.5 },
    fincaRaiz: { nombre: "Propiedad raíz", nombreEn: "Real estate", rentaNetaPct: 4.5, valorizacionSpread: 0 },
    // 23-nov-2026 (Santiago: "una de las opciones no debería ser S&P 500, debería ser acciones u
    // otra cripto"). La llave sigue siendo sp500 (escenarios guardados); el supuesto es el de un
    // índice amplio como el S&P 500. Cripto no tiene supuesto validado: solo inflación si no
    // escribes el rendimiento que esperas.
    sp500: { nombre: "Acciones y ETF (USD)", nombreEn: "Stocks & ETFs (USD)", usd: true, devaluacionRealPct: 0 /* real usa escenario.spRealPct */ },
    cripto: { nombre: "Cripto (USD)", nombreEn: "Crypto (USD)", usd: true, realSpread: 0, sinSupuesto: true },
  },
  vehiculo: { depAnios1a3Pct: -12, depDespuesPct: -8 },
  otrosRealSpread: 0, // crypto, otros: sin supuesto validado → solo inflación
  // Canasta → preset
  canastas: { liquidez: "rfCorto", renta: "rfLargo", crecimiento: "sp500" },
  nortes: {
    rentas: { nombre: "Vivir de rentas", nombreEn: "Live off income", liquidez: 10, renta: 65, crecimiento: 25 },
    equilibrio: { nombre: "Equilibrio", nombreEn: "Balanced", liquidez: 10, renta: 45, crecimiento: 45 },
    crecer: { nombre: "Crecer", nombreEn: "Grow", liquidez: 10, renta: 20, crecimiento: 70 },
  },
};

// 3-nov-2026 — Supuestos de EE. UU. (moneda base dólar). Mismas llaves que los
// de Colombia para que el motor no cambie; cambian los números:
//   · Inflación: 3 % normal, 4,5 % prudente, 2,5 % favorable.
//   · Renta fija: T-bills y cuentas ≈ inflación + 1 %; bonos ≈ inflación + 2 %
//     (tope + 3 %). En Colombia el diferencial real es más alto (TES, CDT).
//   · Propiedad raíz: renta neta 4 % + valorización = inflación + 0,5 %.
//   · S&P 500: es la moneda de casa, sin riesgo cambiario ni devaluación.
//   · Vehículos: −15 % los años 1 a 3 y −10 % después.
// Son supuestos de referencia de FINPATHIA, ajustables por el usuario en cada paso.
export const SUPUESTOS_F10_US = {
  ...SUPUESTOS_F10,
  validadoPor: "Finpathia · supuestos EE. UU., 3-nov-2026",
  inflacionDefaultPct: 3,
  indexacionDefaultPct: 3,
  sinRiesgoCambiario: true,
  escenarios: {
    pesimista: { nombre: "Prudentes", nombreEn: "Cautious", inflacionPct: 4.5, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3.5 },
    base: { nombre: "Normales", nombreEn: "Typical", inflacionPct: null, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 6.5 },
    optimista: { nombre: "Favorables", nombreEn: "Favorable", inflacionPct: 2.5, ingresosSpread: 1.5, gastosSpread: 0, retornoSpread: 1, spRealPct: 8 },
  },
  presets: {
    rfCorto: { nombre: "Efectivo y T-bills", nombreEn: "Cash & T-bills", realSpread: 1 },
    rfLargo: { nombre: "Bonos", nombreEn: "Bonds", realSpread: 2, topeSpread: 3 },
    fincaRaiz: { nombre: "Propiedad raíz", nombreEn: "Real estate", rentaNetaPct: 4, valorizacionSpread: 0.5 },
    sp500: { nombre: "Acciones y ETF", nombreEn: "Stocks & ETFs", usd: false, devaluacionRealPct: 0 },
    cripto: { nombre: "Cripto", nombreEn: "Crypto", usd: false, realSpread: 0, sinSupuesto: true },
  },
  vehiculo: { depAnios1a3Pct: -15, depDespuesPct: -10 },
};

/** Supuestos del país de la sesión (region.js). Colombia por defecto. */
export const supuestosF10 = () => (esUS() ? SUPUESTOS_F10_US : SUPUESTOS_F10);

/** Nombre de un escenario, preset o norte en el idioma de la sesión. */
export const nombreSup = (x) => (x ? tx(x.nombre, x.nombreEn) : "");

// 3-nov-2026 — Textos del motor en el idioma de la sesión (region.js).
// Monto corto para las alertas: CO «1.350 M» (millones de pesos, como siempre); US «$350K».
const mmTxt = (v) => (esUS() ? plataCorta(v) : fmtPlataEs(v));
const FREC_EN = { mensual: "monthly", variable: "variable", anual: "annual", trimestral: "quarterly", semestral: "semiannual", unico: "one-time" };
const MES_EN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Nota de vigencia/frecuencia de un ingreso o gasto (paso 1 de Mi futuro).
function notaVigencia(x, MES, dondeEs, dondeEn, conVariable) {
  if (x._vigencia?.ultimo) return tx("cambió en el año: se toma lo que paga hoy", "changed during the year: today's amount is used");
  if (x._vigencia?.variable) return tx(`variable: promedio de los ${x._vigencia.meses} meses cargados`, `variable: average of the ${x._vigencia.meses} months entered`);
  if (x._vigencia) return tx(`en ${dondeEs} va de ${MES[x._vigencia.desde]} a ${MES[x._vigencia.hasta]}; aquí cuenta el mes completo`, `on ${dondeEn} it runs ${MES_EN[x._vigencia.desde]} to ${MES_EN[x._vigencia.hasta]}; here the full month counts`);
  if (x.frecuencia && !(conVariable ? ["mensual", "variable"] : ["mensual"]).includes(x.frecuencia)) return tx(`pago ${x.frecuencia}, repartido por mes`, `${FREC_EN[x.frecuencia] || x.frecuencia} payment, spread per month`);
  if (conVariable && x.frecuencia === "variable") return tx("variable: promedio de lo cargado en el año", "variable: average of what was entered this year");
  return "";
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function resolverEscenario(clave = "base", user = {}, sup = supuestosF10()) {
  const e = sup.escenarios[clave] || sup.escenarios.base;
  const infUser = user.inflacionPct != null && user.inflacionPct !== "" ? n(user.inflacionPct) : (sup.inflacionDefaultPct ?? INFLACION_DEFAULT_PCT);
  const inflacionPct = e.inflacionPct == null ? infUser : e.inflacionPct;
  return { ...e, clave, inflacionPct };
}

// 24-nov-2026 — Indexación (Finanzas + Luis). Dos tasas:
//  · Indexación (cfg.indexacionPct, editable; por defecto CO 5 %, EE. UU. 3 %): con ella
//    suben cada año el sueldo, los gastos, los ingresos, gastos y rentas futuras. Las
//    cuotas fijas de los créditos NO se indexan.
//  · Inflación del escenario (Prudentes 6 %, Normales 4 %, Favorables 3 %): con ella se
//    llevan a su año los montos únicos que escribes para años futuros (compras, anticipos,
//    aportes, valor al terminar, retiros) y con ella misma se pasa a pesos de hoy.
//  · Todo monto que escribes va en pesos de hoy. Año 1 = año en curso, tal cual; año t
//    × (1+tasa)^(t−1). Los flujos del año t se deflactan con la misma convención:
//    ÷ (1+inflación)^(t−1) (f.deflactorFlujo). Así, con indexación = inflación, sueldo y
//    gastos quedan planos en pesos de hoy todos los años. El patrimonio es un saldo al
//    cierre del año t y sigue ÷ (1+inflación)^t (f.deflactor).
export const INDEXACION_DEFAULT_PCT = { CO: 5, US: 3 };
/** Indexación por defecto del país (respaldo si los supuestos no la traen). */
export const indexacionDefaultPct = (sup = supuestosF10()) => (sup && sup.indexacionDefaultPct != null ? sup.indexacionDefaultPct : esUS() ? INDEXACION_DEFAULT_PCT.US : INDEXACION_DEFAULT_PCT.CO);
/** Indexación (%) de ingresos y gastos para un escenario guardado: la que escribiste o la del país. */
export const indexacionDe = (cfg = {}, sup = supuestosF10()) => (cfg && !vacio(cfg.indexacionPct) && Number.isFinite(Number(cfg.indexacionPct)) ? Math.max(0, n(cfg.indexacionPct)) : indexacionDefaultPct(sup));
/** Deflactor de un año del plan: el año 1 (año en curso) ya está en pesos de hoy. */
export const deflactorAnio = (inflacionPct, t) => Math.pow(1 + n(inflacionPct) / 100, Math.max(0, n(t) - 1));
export const indexarAlAnio = (inflacionPct, t) => Math.pow(1 + n(inflacionPct) / 100, Math.max(0, n(t) - 1));

/** Retorno total NOMINAL anual (%) de un preset bajo un escenario. Fisher: (1+i)(1+r)−1. */
export function retornoNominalPreset(clave, esc, sup = supuestosF10(), override = {}) {
  const p = { ...sup.presets[clave], ...override };
  const i = esc.inflacionPct / 100;
  let real;
  if (clave === "sp500") real = (override.realPct ?? esc.spRealPct) + n(p.devaluacionRealPct);
  else if (p.sinSupuesto) real = n(p.realSpread); // cripto: sin supuesto, solo inflación
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
export function proyectarFuturo10(userIn = {}, cfgIn = {}) {
  const cfg = conVencimientos(migrarClaves(cfgIn, userIn), userIn);
  const user = ajustarGastos(ajustarIngresos(paraPlan(userIn), cfg), cfg);
  const sup = cfg.supuestos || supuestosF10();
  const indexacionPct = indexacionDe(cfg, sup);
  const esc = { ...resolverEscenario(cfg.escenario || "base", user, sup), indexacionPct, indexacionDefault: vacio(cfg.indexacionPct) };
  const N = n(cfg.anios) || sup.anios;
  const inf = esc.inflacionPct / 100;
  // Dos tasas: `inf` (escenario) lleva los montos únicos a su año y deflacta;
  // `gIdx` (indexación) hace subir ingresos, gastos y rentas.
  const gIdx = indexacionPct / 100;
  const ix = (t) => Math.pow(1 + inf, Math.max(0, t - 1));
  const ixI = (t) => Math.pow(1 + gIdx, Math.max(0, t - 1));
  const gIng = gIdx;
  const gGas = gIdx;
  // Sin impuestos: se omiten impuestoNeto y retencionMensual.
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm;
  const fxA = (a) => (String(a?.moneda || a?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const dec = cfg.decisiones || {};
  const rNom = (k, ov) => retornoNominalPreset(k, esc, sup, ov) / 100;

  const plazoEn = leerTerminan(cfg, N);
  // 23-nov-2026 (Santiago: "me dice que me pasé en 13.000 M cuando está bien… no es
  // capaz de entender los dineros que sobran para otros años"). Una inversión de un año
  // siguiente «de lo que vendo» se cobraba toda a las ventas de HOY. Si para ese año ya
  // habrá llegado plata (algo que se vende o vence después, o un retiro), se paga ese
  // año con esa plata; no se aparta hoy ni cuenta como «te pasaste».
  const aniosConPlata = [...Object.values(plazoEn), ...leerRetirosNuevas(cfg, N).map((x) => x.anio)];
  const hayPlataPara = (anio) => anio > 1 && aniosConPlata.some((y) => y <= anio);
  // 23-nov-2026 (Santiago: "estoy en 2027 usando el saldo de 2027 y me pide elegir
  // de dónde sale… tengo un saldo de 2027, debo disponer de ese saldo, sea en una
  // inversión nueva o en una actual"). Lo que se hace en un año siguiente sale del
  // saldo de ese año (lo que sobra de hoy pasa al año siguiente en la cuenta año
  // por año), así que ya no se aparta hoy de lo vendido. Se deja la función para
  // poder volver al comportamiento del 25-oct si hiciera falta.
  const apartarDeHoy = (anio) => false && vendidoTotal > 0.5 && !hayPlataPara(anio);
  // ── Activos que continúan ────────────────────────────────────────────────
  let bolsa = 0, rentaVendida = 0;
  const activos = [];
  const modInfo = {}; // resumen de cada «Se modifica» para la pantalla
  (b.inv || []).forEach((a) => {
    const d = dec[a.id] || {};
    const valor = n(a.va) * fxA(a);
    const rentaAnual = n(b.rentaNetaPorActivo[a.id]) * 12;
    if (d.accion === "vende") { bolsa += valor; return; } // su renta y sus gastos salen con bOp (abajo)
    // 23-nov-2026 (Santiago: "esta inversión termina en dos años pero no veo ese saldo
    // disponible de 3.288 M"). Un fondo o CDT con plazo no es «plata de tus cuentas»:
    // si se tomaba de ahí para otra inversión, llegaba vacío al año en que vence.
    // Lo que tiene fecha de salida queda intacto hasta ese año.
    const clase = claseActivo(a) === "liquido" && plazoEn[a.id] ? "otro" : claseActivo(a);
    // Crecimiento del VALOR (la renta vinculada ya entra al flujo de ingresos).
    let crec = crecimientoDefault(a, esc, sup, rentaAnual);
    // 23-nov-2026 (Santiago: "se termina la inversión en 2028: dejo de recibir 57 M y me
    // regresan 3.288 M"). Una inversión a plazo que ya paga su rendimiento como renta
    // devuelve el capital que se puso, no un capital crecido: su valor no sube.
    if (capitalPlano(a, clase, rentaAnual, plazoEn) && crec != null) crec = 0;
    // 25-oct-2026 (Santiago: "unas inversiones rentan más y está cargando
    // valores promedio"). En Hoy se corrige cuánto sube cada una al año.
    const crecHoy = (cfg.crecHoy || {})[a.id];
    if (!vacio(crecHoy) && crec != null) crec = n(crecHoy) / 100;
    const mod = d.accion === "modifica" ? leerModifica(d, esc) : null;
    if (mod && mod.valorizacionNomPct != null) crec = mod.valorizacionNomPct / 100;
    if (mod) {
      const total = valor + mod.inversionMonto;
      modInfo[a.id] = { valorHoy: valor, inversion: mod.inversionMonto, inversionAnio: mod.inversionAnio, valorConObra: total,
        rentaMensual: mod.rentaNuevaMensual, rentaDesdeMes: mod.rentaNuevaDesdeMes,
        rentaPctAnual: total > 0 ? mod.rentaNuevaMensual * 12 / total * 100 : 0, valorizacionPct: crec == null ? null : crec * 100 };
    }
    activos.push({ id: a.id, nombre: a.n || a.nombre || tx("Activo", "Asset"), clase, valor, crec, rentaAnual, usd: fxA(a) !== 1, invertible: clase !== "vehiculo",
      invMonto: mod ? mod.inversionMonto : 0, invAnio: mod ? mod.inversionAnio : 0,
      rentaNuevaAnual: mod ? mod.rentaNuevaMensual * 12 : 0, rentaDesdeMes: mod ? mod.rentaNuevaDesdeMes : 0, valorHoy: valor });
  });

  // 24-oct-2026 (Santiago: "en Reinvierte necesito ver qué saldo me quedó de
  // lo que vendí, para ir sabiendo cuánto tengo para reinvertir"). Se lleva la
  // cuenta de la bolsa paso a paso y se devuelve en `bolsaDetalle`.
  const vendidoTotal = bolsa;

  // ── Deudas que se pagan con lo vendido ───────────────────────────────────
  // 24-oct-2026 (Santiago: "si vendo Orlando la idea es pagar la deuda de
  // Orlando… incluso tengo otras deudas que me gustaría pagar con plata de los
  // activos que se venden"). La sección vieja lo tenía y aquí se había perdido.
  // Orden: 1) la deuda que cuelga de un activo vendido (campo `la`) se paga
  // siempre con esa venta; 2) las que el usuario marque en `cfg.pagarDeudas`.
  // Solo se paga con lo vendido, nunca con la liquidez de hoy. Si no alcanza,
  // se abona lo que haya: el saldo baja y la cuota sigue igual (termina antes).
  const vendidos = new Set((b.inv || []).filter((a) => dec[a.id]?.accion === "vende").map((a) => a.id));
  const pagarCfg = cfg.pagarDeudas || {};
  const deudasUser = (user.deudas || user.deu || []).filter((d) => d && d.sim !== false);
  const deudas = deudasUser.map((d) => {
    // 23-nov-2026 (Santiago: "la idea es vender la Volvo y por tanto esa deuda se paga con la
    // misma venta del activo, no con Cascadas"). En el plan se puede decir de qué activo es una
    // deuda (cfg.deudaDe); si ese activo se vende en un año siguiente, la deuda se paga ese año
    // con esa venta, no hoy con otra plata.
    const activoId = deudaActivo(d, cfg);
    const porVenta = !!activoId && vendidos.has(activoId);
    const ventaAnio = activoId && plazoEn[activoId] ? plazoEn[activoId] : null;
    // 23-nov-2026 (Santiago: "no hay opción de decir que se paga en X año, solo dice
    // se paga hoy… un solo botón «Se paga» y da la opción de cualquier año"). El año
    // de pago vive en cfg.pagarDeudas[id]: true (escenarios viejos) o el año de hoy =
    // se paga hoy con lo vendido; un año siguiente = se paga ese año.
    const tPlan = anioPagoDeuda(d, pagarCfg, N);
    const pagaAnio = !porVenta && !ventaAnio && tPlan > 1 ? tPlan : null;
    return { id: d.id, nombre: d.n || d.nombre || tx("Deuda", "Debt"), saldo: n(d.mt) * fxA(d), activoId, porVenta, ventaAnio, pagaAnio, ligadaEnPlan: !!(cfg.deudaDe || {})[d.id], pagar: porVenta || (!ventaAnio && tPlan === 1), pagado: 0, _d: d };
  }).filter((d) => d.saldo > 0);
  [...deudas.filter((d) => d.porVenta), ...deudas.filter((d) => !d.porVenta && d.pagar)].forEach((d) => {
    const m = Math.min(bolsa, d.saldo);
    d.pagado = m; bolsa -= m;
  });
  const deudasPagadasTotal = deudas.reduce((s, d) => s + d.pagado, 0);
  const deudaSinCubrir = deudas.filter((d) => d.pagar).reduce((s, d) => s + d.saldo - d.pagado, 0);
  // Lo que queda vivo, con la misma regla de cuota del resto de la app.
  const pagadoPorId = Object.fromEntries(deudas.map((d) => [d.id, d]));
  const deudasVivas = deudasUser.flatMap((d) => {
    const x = pagadoPorId[d.id];
    if (!x || x.pagado <= 0) return [d];
    if (x.pagado >= x.saldo - 0.5) return [];
    return [{ ...d, mt: (x.saldo - x.pagado) / fxA(d) }];
  });
  const bDeuda = deudasPagadasTotal > 0 ? calcularBase({ ...sinImp, gastos: user.gastos || user.gas, deu: deudasVivas, deudas: deudasVivas }, {}) : b;

  // ── Bolsa: colchón → reinversiones / nuevas → resto según la mezcla ─────
  // El colchón se mide con las obligaciones que quedan (sin las cuotas que se pagan hoy).
  const obAnual = bDeuda.ob * 12;
  const metaColchon = (bDeuda.ob * n(sup.colchonMeses));
  const liquidosQueQuedan = activos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
  const canasta = { liquidez: 0, renta: 0, crecimiento: 0 };
  let colchon = Math.min(bolsa, Math.max(0, metaColchon - liquidosQueQuedan));
  bolsa -= colchon;
  const colchonInicial = colchon; // `colchon` cambia año a año; la bolsa reporta el de hoy
  const nuevas = [];
  let excesoVentas = 0, excesoCubierto = 0, ciclosTotal = 0, reservadoTotal = 0;
  // 25-oct-2026 (Santiago: "invertí menos en Ledger y lo que me sobra no se
  // alteró"). Cada uso de plata con su origen, para que la cuenta se vea línea
  // por línea: solo lo que sale «de lo que vendo» mueve lo que sobra.
  const usos = [];
  // Plata apartada hoy de lo vendido para algo que se hace un año siguiente:
  // queda como «Apartado para …», rinde como liquidez y se usa ese año.
  const apartados = [];
  const apartar = (nombre, monto, seccion, anio) => {
    const b0 = bolsa, l0 = desdeLiquidez;
    const m = tomar(monto, null, "venta");
    usos.push({ seccion, nombre, monto, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: 0, anio, fuente: "venta", apartado: true, resto: monto - m });
    reservadoTotal += m;
    const h = { id: "apartado_" + apartados.length, nombre: tx(`Apartado para ${nombre}`, `Set aside for ${nombre}`), clase: "otro", valor: m, crec: rNom("rfCorto"), usd: false, invertible: true, apartadoDe: nombre };
    apartados.push(h);
    return h;
  };
  let reinvertidoTotal = 0, nuevasTotal = 0, pedidoTotal = 0, desdeLiquidez = 0, programadasTotal = 0, pendienteAnio1 = 0;
  // 24-oct-2026 (Santiago: "añadí estas inversiones y cuando voy a ver el
  // resultado no se ven ahí reflejadas"). Antes una inversión solo se
  // financiaba con lo vendido: sin ventas, o si no alcanzaba, quedaba en $0 y
  // desaparecía sin aviso, mientras la pantalla decía que saldría de la
  // liquidez. Ahora toma primero de lo vendido y lo que falte sale de tus
  // cuentas líquidas de hoy. Si tampoco alcanza, se asigna hasta donde llega.
  // 24-oct-2026 (Santiago: "si pongo que voy a invertir 600 M, el sistema
  // debería saber de dónde vienen: capital nuevo o producto de venta de un
  // activo"). Cada inversión trae su origen (`fuente`):
  //   "venta" (por defecto) → lo vendido, luego tu liquidez
  //   "liquidez"            → solo tus cuentas líquidas de hoy
  //   "nuevo"               → capital nuevo, de afuera (ahorro, crédito):
  //                           no sale de nada, suma al patrimonio.
  let capitalNuevo = 0;
  const tomar = (monto, excluirId, fuente = "venta") => {
    let falta = Math.max(0, monto);
    if (fuente === "nuevo") { capitalNuevo += falta; return falta; }
    const deBolsa = fuente === "liquidez" ? 0 : Math.min(bolsa, falta); bolsa -= deBolsa; falta -= deBolsa;
    // 25-oct-2026 (Santiago: "no sé si me pasé de las platas que tenía
    // disponibles por ventas"). Lo que se pidió «de lo que vendo» y no alcanzó.
    const antesLiq = falta;
    if (fuente !== "liquidez" && falta > 0) excesoVentas += falta;
    activos.filter((a) => a.clase === "liquido" && a.id !== excluirId).forEach((a) => {
      const u = Math.min(a.valor, falta); a.valor -= u; falta -= u; desdeLiquidez += u; a.tomadoLiq = (a.tomadoLiq || 0) + u; // 7-nov: cuánto salió de cada cuenta (La historia de tu plata)
    });
    if (fuente !== "liquidez") excesoCubierto += antesLiq - falta;
    return Math.max(0, monto) - falta;
  };
  // 24-oct-2026 (Santiago: "voy a reinvertir 600 M en un lote para construir
  // una bodega"). La obra que se hace en el año 1 sale de una vez de lo vendido
  // (y si no alcanza, de la liquidez), para que el saldo de Reinvierte la
  // descuente. Queda apartada (rinde como liquidez) y entra al activo al hacer
  // la obra en el año 1; la valorización sobre el total corre desde ahí.
  let obrasTotal = 0, obrasPedido = 0;
  activos.forEach((a) => {
    if (!(a.invMonto > 0 && a.invAnio === 1)) return;
    obrasPedido += a.invMonto;
    const m = tomar(a.invMonto, a.id);
    a.reserva = m; a.reservaBase = m; obrasTotal += m; a.invMonto -= m; // lo que no alcance se saca en el año 1
  });
  // 24-oct-2026 (Santiago: "reinvertir en cosas que ya se tienen debería traer
  // el valor anterior más el nuevo… y dónde pongo lo que va a rentar"). Cada
  // reinversión puede traer su renta (rentaMensual, pesos de hoy) y desde qué
  // mes; se devuelve el detalle hoy + aporte = total para la pantalla.
  const reinversionesDetalle = [];
  // 23-nov-2026 (Santiago: "tengo un saldo de 2028 y cuando quiero invertir en IBKR no
  // me lo muestra"). Un activo puede recibir varios aportes, en años distintos (IBKR en
  // 2027 y otra vez en 2028). Antes solo contaba el primero (unaPorActivo). El índice
  // k es el de cfg.reinversiones, para que la pantalla encuentre su detalle.
  const aportesVistos = new Set();
  // 23-nov-2026 (Santiago: "uno no necesariamente invierte en activos que tenía; puede ampliar
  // su inversión en los fondos de renta, CDTs o, por ejemplo, Rapicredit"). Aportes a una
  // inversión creada en el plan en un año anterior: se resuelven cuando ya existen las nuevas.
  const aportesNuevas = [];
  (Array.isArray(cfg.reinversiones) ? cfg.reinversiones : []).forEach((r, k) => {
    if (!r || !r.activoId) return;
    // Dos aportes al mismo activo en el MISMO año: cuenta el primero (el que se ve).
    const claveAporte = r.activoId + "|" + Math.max(1, Math.round(n(r.anio)) || 1);
    if (aportesVistos.has(claveAporte)) return;
    aportesVistos.add(claveAporte);
    pedidoTotal += Math.max(0, n(r.monto));
    const a = activos.find((x) => x.id === r.activoId);
    if (!a) {
      if (String(r.activoId).startsWith("nueva_") && n(r.monto) > 0) {
        // Sale del saldo de ese año, como cualquier aporte de un año siguiente.
        pedidoTotal -= n(r.monto); programadasTotal += n(r.monto);
        aportesNuevas.push({ k, id: r.activoId, monto: n(r.monto), anio: Math.min(10, Math.max(2, Math.round(n(r.anio)) || 1)) });
      }
      return;
    }
    const antes = a.valor;
    if (!vacio(r.valorizacionNomPct)) a.crec = n(r.valorizacionNomPct) / 100;
    // 24-oct-2026 (Santiago: "según el tipo de inversión la plataforma debe
    // saber si genera renta o se valoriza… en fondos o trade poner lo que
    // estima que rinde al año y si se reinvierte o se saca una parte").
    // Fuera de inmuebles: rendimiento anual (%) y qué parte te llega (%).
    // Lo que te llega entra al flujo; el resto se reinvierte (interés
    // compuesto). Describe el activo entero y reemplaza la renta que tuviera.
    const esInm = a.clase === "inmueble";
    const rendActual = (a.crec ?? 0) + (a.valor > 0 ? (a.rentaAnual || 0) / a.valor : 0);
    let rendimientoPct = null, pctRecibe = null;
    if (!esInm && (!vacio(r.rendimientoNomPct) || !vacio(r.pctRecibe))) {
      const rend = !vacio(r.rendimientoNomPct) ? n(r.rendimientoNomPct) / 100 : rendActual;
      const p = Math.min(1, Math.max(0, n(r.pctRecibe) / 100));
      a.crec = rend * (1 - p); a.rentaPct = rend * p;
      if (!a.rentaReemplazada) { rentaVendida += a.rentaAnual || 0; a.rentaReemplazada = true; }
      rendimientoPct = rend * 100; pctRecibe = p * 100;
    }
    const anioAporte = Math.min(10, Math.max(1, Math.round(n(r.anio) || 1)));
    let m = 0;
    let deVenta = 0, deLiquidez = 0, deAnio1 = 0, deNuevo = 0;
    if (anioAporte === 1) {
      const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
      m = n(r.monto) > 0 ? tomar(n(r.monto), a.id, r.fuente) : 0;
      deVenta = b0 - bolsa; deLiquidez = desdeLiquidez - l0; deNuevo = capitalNuevo - c0;
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta, deCuentas: deLiquidez, deNuevo, anio: 1, fuente: r.fuente || "venta" });
      if (m > 0) { a.valor += m; reinvertidoTotal += m; }
      // Si lo vendido y la liquidez no alcanzan, el resto se paga con lo que
      // entre en el año 1 (la obra se hace igual): no se recorta.
      const resto = Math.max(0, n(r.monto)) - m;
      if (resto > 0.5) { pedidoTotal -= resto; pendienteAnio1 += resto; (a.aportesFuturos = a.aportesFuturos || []).push({ monto: resto, anio: 1 }); m += resto; deAnio1 = resto; }
    } else if (n(r.monto) > 0 && (r.fuente || "venta") === "venta" && apartarDeHoy(anioAporte)) {
      // 25-oct-2026 (Santiago: "le bajé 100 M a Ledger y sigue saliendo que me
      // pasé"). Una inversión de un año siguiente que sale «de lo que vendo»
      // se APARTA hoy de lo vendido (rinde como liquidez) y entra al activo ese
      // año. Antes se pagaba ese año con lo que hubiera y no tocaba el saldo.
      // Cuenta contra lo vendido como todo lo demás: si ya no alcanza, es lo
      // que te pasaste (sale de tus cuentas de hoy y queda apartado).
      const b0 = bolsa, l0 = desdeLiquidez;
      const m2 = tomar(n(r.monto), a.id, "venta");
      const resto2 = n(r.monto) - m2;
      if (resto2 > 0.5) { pedidoTotal -= resto2; programadasTotal += resto2; }
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: 0, anio: anioAporte, fuente: "venta", apartado: true, resto: resto2 });
      reservadoTotal += m2;
      a.reserva = (a.reserva || 0) + m2;
      (a.aportesFuturos = a.aportesFuturos || []).push({ monto: n(r.monto), anio: anioAporte, apartado: m2 });
    } else if (n(r.monto) > 0) {
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta: 0, deCuentas: 0, deNuevo: 0, anio: anioAporte, fuente: r.fuente || "venta" });
      // Aporte de un año siguiente: se paga ese año con lo que haya (como una obra futura).
      pedidoTotal -= Math.max(0, n(r.monto)); programadasTotal += n(r.monto);
      (a.aportesFuturos = a.aportesFuturos || []).push({ monto: n(r.monto), anio: anioAporte, nuevo: r.fuente === "nuevo" });
    }
    const rentaMensual = Math.max(0, n(r.rentaMensual));
    const rentaDesdeMes = Math.min(119, Math.max(0, Math.round(n(r.rentaDesdeMes))));
    if (rentaMensual > 0) (a.rentasExtra = a.rentasExtra || []).push({ anual: rentaMensual * 12, desdeMes: rentaDesdeMes });
    // «¿Cuánto queda valiendo al terminar la obra?»: el activo salta a ese valor
    // el año en que termina (el de la renta, o el del aporte si no hay renta).
    if (n(r.valorAlTerminar) > 0) (a.saltos = a.saltos || []).push({ t: Math.max(anioAporte, rentaMensual > 0 ? Math.floor(rentaDesdeMes / 12) + 1 : anioAporte), valor: n(r.valorAlTerminar) });
    const totalConAporte = antes + (anioAporte === 1 ? m : n(r.monto));
    const rendUsado = rendimientoPct != null ? rendimientoPct : rendActual * 100;
    const pUsado = pctRecibe != null ? pctRecibe : 0;
    reinversionesDetalle.push({ i: k, activoId: a.id, nombre: a.nombre, clase: a.clase, valorHoy: antes, aporte: anioAporte === 1 ? m : n(r.monto), anio: anioAporte, total: totalConAporte, rentaMensual, rentaDesdeMes, rentaPctAnual: totalConAporte > 0 ? rentaMensual * 12 / totalConAporte * 100 : 0,
      valorizacionPct: esInm ? (a.crec == null ? null : a.crec * 100) : null,
      rendimientoPct: esInm ? null : rendUsado, pctRecibe: esInm ? null : pUsado,
      deVenta, deLiquidez, deAnio1, deNuevo, fuente: r.fuente || "venta",
      rindeAnual: esInm ? 0 : totalConAporte * rendUsado / 100, teLlegaMes: esInm ? 0 : totalConAporte * rendUsado / 100 * pUsado / 100 / 12 });
  });
  const personalizadas = [];
  const prCiclos = [], prQueda = [];
  (cfg.nuevas || []).forEach((x, k) => {
    if (x.preset === "custom") {
      const c = leerPersonalizada(x, esc, sup);
      if (c.monto <= 0) return;
      // 24-oct-2026 (Santiago: "me dice que faltan 8.630 M por invertir pero
      // ya invertí 7.500 M"). La personalizada del año 1 no se descontaba de lo
      // vendido: se sacaba durante el año de las canastas y la bolsa la seguía
      // mostrando libre. Ahora sale desde hoy, como las de la lista. Las de
      // años siguientes se pagan ese año con lo que haya (programadas).
      if (c.anio === 1) {
        pedidoTotal += c.monto;
        const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
        const m = tomar(c.monto, null, x.fuente);
        usos.push({ seccion: "C", nombre: c.nombre, monto: c.monto, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: x.fuente || "venta" });
        if (m <= 0) return;
        nuevasTotal += m;
        nuevas.push({ id: "nueva_" + k, nombre: c.nombre, clase: "nueva", valor: m, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true, fuente: x.fuente || "venta", preset: "custom", montoInicial: m });
        return;
      }
      if ((x.fuente || "venta") === "venta" && apartarDeHoy(c.anio)) {
        const h = apartar(c.nombre, c.monto, "C", c.anio);
        personalizadas.push({ ...c, id: "nueva_" + k, holder: h });
        return;
      }
      programadasTotal += c.monto;
      personalizadas.push({ ...c, id: "nueva_" + k });
      return;
    }
    if (x.preset === "fincaRaiz" && x.pr) {
      const p = leerPropiedadRaiz(x, N);
      if (p.vacio) return;
      if (p.final === "vende") prCiclos.push(p.ciclo);
      else prQueda.push({ ...p, id: "nueva_" + k, fuente: x.fuente || "venta" });
      return;
    }
    if (n(x.monto) <= 0 || !sup.presets[x.preset]) { pedidoTotal += Math.max(0, n(x.monto)); return; }
    // 23-nov-2026 (Santiago: "creé otra inversión con el saldo que me queda de 2027
    // y no lo toma como una inversión para hacer con la plata de 2027"). Los tipos
    // de la lista (renta fija, propiedad raíz, S&P 500) no tenían «¿Cuándo?» y
    // siempre salían de hoy. Ahora, si es de un año siguiente, sigue el mismo
    // camino que la personalizada: se aparta de lo vendido o se paga ese año.
    const anioN = Math.min(N, Math.max(1, Math.round(n(x.anio)) || 1));
    if (anioN > 1) {
      const rendP = vacio(x.rendimientoNomPct) ? rNom(x.preset) : n(x.rendimientoNomPct) / 100;
      const c = { nombre: x.nombre || nombreSup(sup.presets[x.preset]), monto: n(x.monto), anio: anioN, rendNom: rendP, usd: !!sup.presets[x.preset].usd, pctRecibe: Math.min(100, Math.max(0, n(x.pctRecibe))) };
      if ((x.fuente || "venta") === "venta" && apartarDeHoy(c.anio)) {
        const h = apartar(c.nombre, c.monto, "C", c.anio);
        personalizadas.push({ ...c, id: "nueva_" + k, holder: h });
        return;
      }
      programadasTotal += c.monto;
      personalizadas.push({ ...c, id: "nueva_" + k });
      return;
    }
    pedidoTotal += Math.max(0, n(x.monto));
    const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
    const m = tomar(n(x.monto), null, x.fuente);
    usos.push({ seccion: "C", nombre: x.nombre || sup.presets[x.preset].nombre, monto: n(x.monto), deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: x.fuente || "venta" });
    if (m <= 0) return;
    nuevasTotal += m;
    // 19-nov-2026 (Santiago: "puse inversiones de renta fija pero no tiene
    // espacio para poner el retorno anual estimado, ¿un 12 %? ¿un 15 %?"). Si
    // escribe un rendimiento, manda sobre el supuesto del escenario.
    const rendPreset = vacio(x.rendimientoNomPct) ? rNom(x.preset) : n(x.rendimientoNomPct) / 100;
    // 19-nov-2026 (Santiago: "¿dónde quedó la renta fija? no veo las nuevas
    // inversiones en Tu mes"). Como en la personalizada: qué parte de lo que
    // rinde te llega al mes (entra al flujo); el resto se reinvierte. Sin
    // elegir, todo se reinvierte (como antes).
    const pRecibe = Math.min(1, Math.max(0, n(x.pctRecibe) / 100));
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || sup.presets[x.preset].nombre, clase: "nueva", valor: m, crec: rendPreset * (1 - pRecibe), rentaPct: rendPreset * pRecibe, usd: !!sup.presets[x.preset].usd, invertible: true, fuente: x.fuente || "venta", preset: x.preset, montoInicial: m });
  });
  // 25-oct-2026 (Santiago: "asociativos: el primer año invierto 1.350 M en un
  // lote con construcción de vivienda, al terminar vale 1.900 M y se vende; la
  // ganancia la reinvierto y los mismos 1.350 M vuelven a entrar al segundo
  // año, y así cada año… es un negocio cíclico"). El capital sale UNA vez (de
  // donde diga la fuente), queda trabajando en el negocio y cada ciclo deja su
  // ganancia: se reinvierte (en lo que sobra) o llega al flujo. Al terminar,
  // el capital vuelve. Cifras en pesos de hoy; suben con la inflación.
  // Propiedad raíz que te quedas: el primer pago (si es de hoy) sale de lo
  // vendido o de tus cuentas como cualquier inversión de hoy; los pagos de años
  // siguientes salen ese año de lo disponible. El valor salta a la entrega y
  // desde ahí sube con su valorización anual; la renta arranca a la entrega.
  prQueda.forEach((p) => {
    let valor0 = 0;
    const pagos = [];
    p.pagos.forEach((pg) => {
      if (pg.anio === 1) {
        pedidoTotal += pg.monto;
        const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
        valor0 += tomar(pg.monto, null, p.fuente);
        usos.push({ seccion: "C", nombre: p.nombre, monto: pg.monto, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: p.fuente, prDesde: p.anio });
      } else {
        programadasTotal += pg.monto;
        usos.push({ seccion: "C", nombre: p.nombre, monto: pg.monto, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: pg.anio, fuente: "liquidez", prDesde: p.anio });
        pagos.push(pg);
      }
    });
    nuevasTotal += valor0;
    nuevas.push({ id: p.id, nombre: p.nombre, clase: "inmueble", valor: valor0, crec: p.crec, entrega: p.entrega, pagos, saltos: p.valorAlTerminar > 0 ? [{ t: p.entrega, valor: p.valorAlTerminar }] : [], rentaNuevaAnual: p.renta * 12, rentaDesdeMes: 12 * (Math.max(1, p.entrega) - 1), usd: false, invertible: true, montoInicial: valor0, montoTotal: p.capital, anioInicio: p.anio, propiedadRaiz: p.tipo });
  });
  // Aportes a lo creado en el plan: entran ese año a la inversión (escritos en pesos de hoy, indexados al año) y salen
  // del saldo del año. La inversión sigue rindiendo igual y te paga en la misma proporción.
  aportesNuevas.forEach((x) => {
    const nu = nuevas.find((y) => y.id === x.id && !y.propiedadRaiz && y.clase !== "ciclo");
    const pe = nu ? null : personalizadas.find((y) => y.id === x.id);
    const destino = nu || pe;
    if (!destino || x.anio <= (nu ? 1 : (pe.anio || 1))) return;
    (destino.aportesFuturos = destino.aportesFuturos || []).push({ monto: x.monto, anio: x.anio });
    usos.push({ seccion: "B", nombre: destino.nombre, monto: x.monto, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: x.anio, fuente: "liquidez" });
    const rend = nu ? ((nu.crec || 0) + (nu.rentaPct || 0)) * 100 : (pe.rendNom || 0) * 100;
    const pct = nu ? (rend > 0 ? (nu.rentaPct || 0) * 100 / rend * 100 : 0) : (pe.pctRecibe || 0);
    reinversionesDetalle.push({ i: x.k, activoId: x.id, nombre: destino.nombre, clase: "nueva", valorHoy: 0, aporte: x.monto, anio: x.anio, total: x.monto, rentaMensual: 0, rentaDesdeMes: 0, rentaPctAnual: 0, valorizacionPct: null, rendimientoPct: rend, pctRecibe: pct, deVenta: 0, deLiquidez: 0, deAnio1: 0, deNuevo: 0, fuente: "liquidez", rindeAnual: 0, teLlegaMes: 0, aNueva: true });
  });
  const ciclos = leerCiclos([...(Array.isArray(cfg.ciclos) ? cfg.ciclos : []), ...prCiclos], N);
  const ciclosDetalle = [];
  ciclos.forEach((c, k) => {
    const a = { id: "ciclo_" + k, nombre: c.nombre, clase: "ciclo", valor: 0, crec: inf, usd: false, invertible: true, ciclo: c, tomado: false };
    if (c.desde === 1) {
      pedidoTotal += c.capital;
      const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
      const m = tomar(c.capital, null, c.fuente);
      usos.push({ seccion: "D", nombre: c.nombre, monto: c.capital, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: c.fuente });
      a.valor = m; a.tomado = true; ciclosTotal += m;
    } else if (c.fuente === "venta" && apartarDeHoy(c.desde)) {
      a.holder = apartar(c.nombre, c.capital, "D", c.desde);
      c._apartado = true;
    }
    nuevas.push(a);
    ciclosDetalle.push({ id: a.id, nombre: c.nombre, capital: c.capital, valorFinal: c.valorFinal, meses: c.meses, desde: c.desde, hasta: c.hasta, fuente: c.fuente, destino: c.destino, destinoId: c.destinoId, costosPct: c.costosPct, regimen: c.regimen, impuestoPct: c.impuestoPct, impuestoAnual: c.impuestoAnual, gananciaCiclo: c.gananciaCiclo, gananciaAnual: c.gananciaAnual, rentabilidadPct: c.capital > 0 ? c.gananciaAnual / c.capital * 100 : 0 });
  });
  apartados.forEach((h) => nuevas.push(h));
  // 19-nov-2026: `capitalNuevo` sigue sumando en la simulación (negocios que
  // arrancan en años siguientes con plata de afuera). Lo que entra HOY se guarda
  // aparte para «La historia de tu plata».
  const capitalNuevoHoy = capitalNuevo;
  const sobraDestinos = (Array.isArray(cfg.sobraDestinos) ? cfg.sobraDestinos : []).filter((d) => d && d.id).map((d) => ({ id: d.id, pct: Math.min(100, Math.max(0, n(d.pct))) })).filter((d) => d.pct > 0);
  { let acum = 0; sobraDestinos.forEach((d) => { d.pct = Math.min(d.pct, 100 - acum); acum += d.pct; }); }
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  // 25-oct-2026 (Santiago: "quiero dejar esos 28 M disponibles"). Con
  // cfg.repartoDisponible lo que sobra (de las ventas y lo no asignado de cada
  // mes) queda disponible en el colchón, sin invertirse en las canastas.
  const disponible = !!cfg.repartoDisponible;
  if (disponible) { colchon += bolsa; ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = 0; }); }
  else ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = bolsa * mezcla[k] / 100; });
  const rCan = { liquidez: rNom(sup.canastas.liquidez), renta: rNom(sup.canastas.renta), crecimiento: rNom(sup.canastas.crecimiento) };

  // ── Deuda: la cuota sigue nominal fija hasta saldar; saldo lineal ───────
  // 24-oct-2026 (Santiago: "debo 437 M de un local… pueden existir deudas sin
  // interés que se pagan de una sola vez"). Una deuda sin intereses
  // (tipoInteres "sin_interes", sin cuota) no entra al pozo que se amortiza con
  // cuotas: su saldo resta del patrimonio hasta que se paga, sea con una venta
  // (Tu plata → Pagar deudas) o de una vez en el año `pagoUnicoAnio`.
  const anioHoy = new Date().getFullYear();
  const esUnica = (d) => d && d.tipoInteres === "sin_interes" && !(n(d.pg ?? d.pago) > 0);
  // El año que se elija en el plan (Tu plata → Pagar deudas) manda sobre el que
  // se puso en la página Deudas; «Sigue» en el plan = no se paga en el horizonte.
  const unicas = deudasVivas.filter(esUnica).map((d) => {
    const v = pagarCfg[d.id];
    const t = v === false ? null : anioPagoDeuda(d, pagarCfg, N) || (n(d.pagoUnicoAnio) > 0 ? Math.min(N, Math.max(1, n(d.pagoUnicoAnio) - anioHoy + 1)) : null);
    return { id: d.id, nombre: d.n || d.nombre || tx("Deuda", "Debt"), saldo: n(d.mt) * fxA(d), t };
  });
  const idsUnicas = new Set(unicas.map((d) => d.id));
  // Deudas con cuota que se pagan completas en un año siguiente.
  const conCuotaEnAnio = deudas.filter((d) => d.pagaAnio && !idsUnicas.has(d.id));
  let deudaUnica = unicas.reduce((sm, d) => sm + d.saldo, 0);
  let deuda = bDeuda.deudaTotal - deudaUnica; let cuotaAnual = bDeuda.sd * 12;
  const deudaInicial = deuda, pagadasDespues = new Set();

  // 24-oct-2026 (Santiago: "¿y los gastos de dónde salen?"). Al vender un
  // activo se van su renta, TODOS sus gastos vinculados (también lo que cuesta
  // por encima de lo que renta: Orlando renta 22,6 M y cuesta 24,8 M) y sus
  // ingresos vinculados. Antes solo se restaba la renta neta y el exceso de
  // costos se quedaba en los gastos para siempre.
  const vendidosIds = new Set((b.inv || []).filter((a) => dec[a.id]?.accion === "vende").map((a) => a.id));
  // 24-oct-2026 (Santiago: "¿por qué me aparece la renta de Puerto Madero si se
  // vende? Lo mismo Orlando"). Muchas rentas se cargan en Ingresos sin
  // vincularlas al activo. Al vender, también se van las que el usuario marca
  // en «¿Qué se va con la venta?» (por defecto, las que llevan su nombre).
  const fuera = vinculadosQueSeVan(user, cfg, vendidosIds);
  const sinVendidos = (arr, pre) => (arr || []).filter((x, k) => !(x && x.activoId && vendidosIds.has(x.activoId)) && !fuera.has(pre === "i:" ? claveIngreso(arr, k) : claveGasto(pre.slice(0, -2), arr, k)));
  const gastosSinVendidos = Object.fromEntries(Object.entries(user.gastos || user.gas || {}).map(([k, v]) => [k, sinVendidos(v, `${k}::`)]));
  const bOp = vendidosIds.size ? calcularBase({ ...sinImp, inv: (user.inv || []).filter((a) => !vendidosIds.has(a?.id)), ingresos: sinVendidos(user.ingresos, "i:"), gastos: gastosSinVendidos, gas: gastosSinVendidos, deu: deudasVivas, deudas: deudasVivas }, {}) : bDeuda;
  let ingresos = (bOp.ia + bOp.ip) * 12 - rentaVendida;
  // 20-nov-2026 — Desde el 13-nov `ob` = gastos + INTERESES (para el nivel) y
  // `sd` = cuota COMPLETA, así que `ob − sd` dejaba los gastos por debajo en el
  // abono a capital de cada deuda: el plan mostraba de menos lo que sale cada
  // mes (y de más lo que sobra). Los gastos del flujo son `g` (sin cuotas; la
  // cuota completa se suma aparte año a año).
  let gastos = (bOp.g != null ? bOp.g : bOp.ob - bOp.sd) * 12;
  // 24-oct-2026 (Santiago: "¿cómo quita uno items de gastos que ya no van?
  // por ejemplo mantenimientos"). Gastos de hoy que se acaban en el escenario
  // (cfg.gastosTerminan: { "cat::índice": año desde el que ya no se paga }).
  // Solo cambia el escenario: Egresos no se toca.
  const fxG = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? b.trm : 1);
  const conRentaOp = new Set(Object.keys(bOp.rentaNetaPorActivo || {}));
  const gastosHoy = [];
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false || (g.activoId && vendidosIds.has(g.activoId)) || fuera.has(claveGasto(cat, items, idx))) return;
    const v = montoPromedioMensual(g) * fxG(g); if (!(v > 0.5)) return;
    gastosHoy.push({ key: claveGasto(cat, items, idx), nombre: g.c || g.n || g.nombre || cat, cat, mensual: v, neteado: !!(g.activoId && conRentaOp.has(g.activoId)), activoId: g.activoId || null });
  }));
  // 24-oct-2026 (Santiago: "uno debería poder apagar y prender rentas que ya
  // no van, gastos que ya no van"). Igual que los gastos: cada ingreso de hoy
  // sigue o se acaba desde un año (cfg.ingresosTerminan: { "i:índice": año }).
  const fxIng = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? b.trm : 1);
  const ingresosHoy = [];
  (user.ingresos || []).forEach((i, k) => {
    if (!i || i.sim === false || (i.activoId && vendidosIds.has(i.activoId)) || fuera.has(claveIngreso(user.ingresos, k))) return;
    const v = montoPromedioMensual(i) * fxIng(i); if (!(v > 0.5)) return;
    ingresosHoy.push({ key: claveIngreso(user.ingresos, k), nombre: i.nombre || i.categoria || tx("Ingreso", "Income"), mensual: v, pasivo: tipoIngreso(i) === "pasivo", activoId: i.activoId || null });
  });
  const ingTerminan = cfg.ingresosTerminan || {};
  const ingSeVan = ingresosHoy.filter((x) => ingTerminan[x.key]).map((x) => ({ ...x, desde: Math.min(N, Math.max(1, Math.round(n(ingTerminan[x.key])) || 1)) }));
  const terminan = cfg.gastosTerminan || {};
  const seVan = gastosHoy.filter((g) => !g.neteado && terminan[g.key]).map((g) => ({ ...g, desde: Math.min(N, Math.max(1, Math.round(n(terminan[g.key])) || 1)) }));
  // 24-oct-2026 (Santiago: "los gráficos de los escenarios están muy flojos…
  // que se vea como el HTML", su plan SALEM). Para graficar lo que produce el
  // patrimonio se lleva aparte la renta pasiva (lo que llega a la cuenta sin
  // trabajar) y, por activo, cuánto renta y cuánto crece cada año.
  let pasivo = Math.max(0, bOp.ip * 12 - rentaVendida);
  // 24-oct-2026 (Santiago: "uno debería poder revisar cada inversión, cuánto
  // vale, cuánto renta"). En el paso Hoy puede corregir para el plan la renta
  // neta de un activo (cfg.rentaHoy: { id: pesos al mes }); reemplaza la que
  // sale de Ingresos − Egresos ligados. Sus páginas no se tocan.
  const rentaHoy = cfg.rentaHoy || {};
  activos.forEach((a) => {
    const v = rentaHoy[a.id]; if (v == null || v === "" || a.rentaReemplazada) return;
    const nueva = Math.max(0, n(v)) * 12, antes = n((bOp.rentaNetaPorActivo || {})[a.id]) * 12;
    ingresos += nueva - antes; pasivo += nueva - antes; a.rentaAnual = nueva; a.rentaCorregida = true;
    if (nueva > 0 && a.crec != null && a.clase !== "inmueble" && a.clase !== "vehiculo") a.crec = Math.min(a.crec, inf); // el rendimiento ya llega como renta
  });
  // 22-nov-2026 (Santiago: "quiero dejar Puerto Madero para uso propio y me
  // sigue hablando de los ingresos… no puedo editar esa renta"). En el paso 1
  // un activo «Sigue», «Cambia» o «Se vende». Cambia = desde un año lo usas tú
  // (deja de rentar; sus gastos ligados —administración, predial— siguen y
  // ahora salen de tu bolsillo) o renta distinto (nueva renta neta al mes).
  // Solo el plan: Patrimonio, Ingresos y Egresos no se tocan.
  const cambios = leerCambios(cfg, N);
  const terminanEn = leerTerminan(cfg, N);
  const retirosNuevas = leerRetirosNuevas(cfg, N);
  const liberados = []; // plata que queda libre en años siguientes (activos que vencen o se venden después)
  const manualOp = new Set((user.inv || []).filter((x) => x && x.rentaOrigen === "manual").map((x) => x.id));
  const costoLigado = (id) => {
    if (manualOp.has(id)) return gastosHoy.filter((g) => g.activoId === id && g.neteado).reduce((sm, g) => sm + g.mensual, 0);
    return Math.max(0, n((bOp.rentaPorActivo || {})[id]) - n((bOp.rentaNetaPorActivo || {})[id]));
  };
  const aplicarCambio = (a, t) => {
    const c = cambios[a.id]; if (!c || c.desde !== t || a.rentaReemplazada) return;
    const fr0 = Math.pow(1 + gIng, Math.max(0, t - 1)), frG = Math.pow(1 + gGas, Math.max(0, t - 1));
    const nueva = c.modo === "propio" ? 0 : c.mensual * 12;
    const dif = (nueva - (a.rentaAnual || 0)) * fr0;
    ingresos = Math.max(0, ingresos + dif); pasivo = Math.max(0, pasivo + dif);
    if (a.rentaAntesCambio == null) a.rentaAntesCambio = a.rentaAnual || 0;
    a.rentaAnual = nueva; a.cambio = c;
    if (t <= 1) a.rentaCorregida = true;
    if (c.modo === "propio") { const cg = costoLigado(a.id) * 12 * frG; gastos += cg; a.propioDesde = t; a.costoPropio = cg; }
  };
  activos.forEach((a) => aplicarCambio(a, 1));
  const todos = [...activos, ...nuevas];
  const valorTotal = () => todos.reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const invertible = () => todos.filter((a) => a.invertible).reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const filas = [];
  const alertas = [];
  const fila0 = { anio: 0, ingresos, gastos: gastos + (deuda > 0 ? cuotaAnual : 0), cf: 0, activos: valorTotal(), invertible: invertible(), deuda, liquidez: colchon + canasta.liquidez + liquidosQueQuedan };
  fila0.patrimonio = fila0.activos - deuda - deudaUnica; fila0.deuda = deuda + deudaUnica; fila0.deflactor = 1;
  fila0.patrimonioReal = fila0.patrimonio; fila0.invertibleReal = fila0.invertible;
  fila0.rentas = pasivo; fila0.laboral = Math.max(0, ingresos - pasivo); fila0.crece = 0; fila0.produce = pasivo;
  fila0.ingresosReal = ingresos; fila0.gastosReal = fila0.gastos;
  fila0.porActivo = [
    ...todos.map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor + (a.reserva || 0), renta: a.rentaReemplazada ? 0 : (a.rentaAnual || 0), crece: 0, crec: a.crec, rentaPct: a.rentaPct || 0, deLiquidez: a.tomadoLiq || 0 })),
    { id: "c_liquidez", nombre: tx("Liquidez y colchón", "Cash and cushion"), clase: "canasta", valor: colchon + canasta.liquidez, renta: 0, crece: 0, crec: rCan.liquidez },
    { id: "c_renta", nombre: tx("Renta fija (lo que sobra)", "Fixed income (surplus)"), clase: "canasta", valor: canasta.renta, renta: 0, crece: 0, crec: rCan.renta },
    { id: "c_crecimiento", nombre: tx("Crecimiento (lo que sobra)", "Growth (surplus)"), clase: "canasta", valor: canasta.crecimiento, renta: 0, crece: 0, crec: rCan.crecimiento },
  ].filter((x) => Math.abs(x.valor) > 0.5 || x.renta > 0.5);
  filas.push(fila0);
  let liqAgotadaAnio = null;
  // ── Lo que viene: ingresos y activos que empiezan más adelante ──────────
  const fut = leerFuturos(cfg.futuros, esc, sup);
  // 19-nov-2026: la renta de un activo puesta dos veces (ingreso futuro
  // vinculado + renta en «Invertir en lo que ya tienes») se cuenta una vez.
  const duplicadas = rentasDuplicadas(cfg, activos);
  // 24-nov-2026 (Santiago: "la gente podría ingresar en el paso 2 los ingresos que ya puso en el
  // paso 1… ¿se validan?"). Un ingreso de Lo que viene que sale de un activo cuya renta ya cambiaste
  // en el paso 1 es esa misma renta: se cuenta una vez, la del paso 1 (salvo que digas que es otra).
  {
    const idx = (cfg.futuros?.ingresos || []).map((x, k) => (x && n(x.mensual) > 0 ? k : -1)).filter((k) => k >= 0);
    const fuera = new Set(idx.filter((k) => { const x = cfg.futuros.ingresos[k]; return x.activoId && cambios[x.activoId] && ![].concat(x.noEsRentaDe || []).includes(x.activoId); }));
    if (fuera.size) fut.ingresos = fut.ingresos.filter((_, j) => !fuera.has(idx[j]));
  }
  {
    const fuera = new Set(duplicadas.filter((d) => d.seguro).map((d) => d.k));
    if (fuera.size) {
      const idx = (cfg.futuros?.ingresos || []).map((x, k) => (x && n(x.mensual) > 0 ? k : -1)).filter((k) => k >= 0);
      fut.ingresos = fut.ingresos.filter((_, j) => !fuera.has(idx[j]));
    }
    duplicadas.forEach((d) => alertas.push({ tipo: "renta_doble", anio: 1, texto: d.seguro
      ? tx(`«${d.ingreso}» y la renta de ${d.activo} en «Invertir en lo que ya tienes» son la misma: se cuenta una vez (${mmTxt(d.contada)} al mes).`, `"${d.ingreso}" and ${d.activo}'s income in "Invest in what you own" are the same: counted once (${mmTxt(d.contada)} a month).`)
      : tx(`¿«${d.ingreso}» es la misma renta que pusiste en ${d.activo}? Si sí, bórrala de Lo que viene: se está sumando dos veces.`, `Is "${d.ingreso}" the same income you entered for ${d.activo}? If so, delete it from What's coming: it's being counted twice.`) }));
  }
  // 24-oct-2026 (Santiago: "tengo un activo que en un año empieza a rentar…
  // debería poder elegir en el ingreso nuevo los activos existentes, y poner
  // cuánto se valoriza"). Un ingreso futuro puede salir de un activo tuyo;
  // si trae valorización, se aplica a ese activo.
  fut.ingresos.forEach((x) => { const a = x.activoId && activos.find((y) => y.id === x.activoId); if (a && x.valorizacionNomPct != null) a.crec = x.valorizacionNomPct / 100; });
  fut.activos.forEach((x, k) => todos.push({ id: "futuro_" + k, nombre: x.nombre, clase: x.clase === "inmueble" ? "inmueble" : "otro", fuentesPago: x.fuentesPago, saltos: x.valorAlTerminar > 0 ? [{ t: x.entrega, valor: x.valorAlTerminar }] : [], valor: 0, crec: x.crec, entrega: x.entrega, pagos: x.pagos, usd: false, invertible: true, rentaNuevaAnual: x.rentaMensual * 12, rentaDesdeMes: 12 * (Math.max(1, x.rentaDesde) - 1) }));
  let expUSD = canasta.crecimiento > 0;
  for (let t = 1; t <= N; t++) {
    // Saca plata en orden: colchón → liquidez → líquidos existentes → renta → crecimiento.
    const retirar = (monto) => {
      let falta = monto;
      const sacar = (v) => { const u = Math.min(Math.max(0, v), falta); falta -= u; return v - u; };
      colchon = sacar(colchon);
      canasta.liquidez = sacar(canasta.liquidez);
      todos.filter((a) => a.clase === "liquido").forEach((a) => { a.valor = sacar(a.valor); });
      canasta.renta = sacar(canasta.renta);
      canasta.crecimiento = sacar(canasta.crecimiento);
      if (falta > 0) { canasta.liquidez -= falta; if (liqAgotadaAnio == null) liqAgotadaAnio = t; }
    };
    // 22-nov-2026 (Santiago: "esta inversión dura 2 años: me devuelven el capital
    // y dejo de recibir la renta"). Un activo que se vende o vence en un año
    // siguiente: al empezar ese año su valor vuelve como plata y se reparte, y su
    // renta deja de entrar.
    activos.forEach((a) => {
      if (terminanEn[a.id] !== t || a.terminado) return;
      a.terminado = true; a.finRenta = true; a.devuelto = a.valor;
      // La deuda que cuelga de ese activo (su hipoteca) se paga con esa venta: lo
      // que te llega es el valor menos lo que todavía debas, y su cuota se acaba.
      let pagoDeuda = 0;
      deudasVivas.filter((d) => d && d.sim !== false && deudaActivo(d, cfg) === a.id && !esUnica(d) && !pagadasDespues.has(d.id)).forEach((d) => {
        const queda = deudaInicial > 0 ? n(d.mt) * fxA(d) * (deuda / deudaInicial) : 0;
        const pago = Math.max(0, Math.min(a.valor - pagoDeuda, queda, deuda));
        pagoDeuda += pago; deuda -= pago; cuotaAnual = Math.max(0, cuotaAnual - n(d.pg ?? d.pago) * fxA(d) * 12); pagadasDespues.add(d.id);
      });
      a.valor -= pagoDeuda;
      liberados.push({ id: a.id, nombre: a.nombre, anio: t, monto: a.valor, pagoDeuda });
      if (a.valor > 0) Object.keys(canasta).forEach((k) => { canasta[k] += a.valor * mezcla[k] / 100; });
      alertas.push({ tipo: "activo_termina", anio: t, texto: tx(`En ${anioCal(t)} sale «${a.nombre}»: recibes ${mmTxt(a.valor)} y su renta deja de entrar.`, `In ${anioCal(t)} "${a.nombre}" ends: you receive ${mmTxt(a.valor)} and its income stops.`) });
      a.valor = 0;
    });
    // Deudas con cuota que el plan paga completas este año: el saldo que queda
    // sale de lo disponible y la cuota deja de contar desde este año.
    conCuotaEnAnio.forEach((x) => {
      if (x.pagaAnio !== t || pagadasDespues.has(x.id)) return;
      const d = x._d;
      const queda = deudaInicial > 0 ? n(d.mt) * fxA(d) * (deuda / deudaInicial) : 0;
      const pago = Math.max(0, Math.min(queda, deuda));
      if (pago > 0.5) retirar(pago);
      deuda -= pago; cuotaAnual = Math.max(0, cuotaAnual - n(d.pg ?? d.pago) * fxA(d) * 12); pagadasDespues.add(x.id);
      x.pagadoEnAnio = pago;
      alertas.push({ tipo: "pago_deuda", anio: t, texto: tx(`En ${anioCal(t)} pagas ${x.nombre} (${mmTxt(pago)}) y su cuota deja de salir.`, `In ${anioCal(t)} you pay off ${x.nombre} (${mmTxt(pago)}) and its payment stops.`) });
    });
    // 23-nov-2026 (Santiago: "invierto todo en una renta fija por 2 años y en dos
    // años retiro una parte y la paso a otra inversión; el modelo no me deja").
    // Una inversión nueva puede tener plazo: ese año sale toda o una parte, llega
    // como plata libre (para darle destino) y lo que quede sigue invertido.
    retirosNuevas.forEach((x) => {
      if (x.anio !== t) return;
      const a = todos.find((y) => y.id === x.id); if (!a || !(a.valor > 0.5)) return;
      const m = x.monto == null ? a.valor : Math.min(a.valor, x.monto * ix(t));
      Object.keys(canasta).forEach((k) => { canasta[k] += m * mezcla[k] / 100; });
      a.valor -= m;
      liberados.push({ id: a.id + "_retiro", nombre: a.nombre, anio: t, monto: m, parcial: a.valor > 0.5 });
      alertas.push({ tipo: "activo_termina", anio: t, texto: tx(`En ${anioCal(t)} retiras ${mmTxt(m)} de «${a.nombre}»${a.valor > 0.5 ? "; el resto sigue invertido" : ""}.`, `In ${anioCal(t)} you withdraw ${mmTxt(m)} from "${a.nombre}"${a.valor > 0.5 ? "; the rest stays invested" : ""}.`) });
    });
    // 0) inversiones personalizadas: al inicio del año X pasan de tu liquidez/bolsa al activo nuevo.
    personalizadas.forEach((c) => {
      if (c.anio !== t) return;
      const M = c.monto * ix(t); // pesos de hoy → pesos de ese año
      if (c.holder) { const usa = Math.min(c.holder.valor, M); c.holder.valor -= usa; if (M - usa > 0.5) retirar(M - usa); colchon += Math.max(0, c.holder.valor); c.holder.valor = 0; }
      else retirar(M);
      // «Paga renta»: el valor sigue la inflación y el resto del rendimiento va al flujo.
      todos.push({ id: c.id, nombre: c.nombre, clase: "nueva", valor: M, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true, aportesFuturos: c.aportesFuturos });
    });
    // 0b) negocios que se repiten: arrancan (sale el capital) o terminan (vuelve).
    todos.forEach((a) => {
      const c = a.ciclo; if (!c) return;
      if (!a.tomado && t === c.desde) {
        const K = c.capital * Math.pow(1 + inf, t - 1);
        if (c.fuente === "nuevo") capitalNuevo += K;
        else if (a.holder) { const usa = Math.min(a.holder.valor, K); a.holder.valor -= usa; if (K - usa > 0.5) retirar(K - usa); colchon += Math.max(0, a.holder.valor); a.holder.valor = 0; }
        else retirar(K);
        a.valor = K; a.tomado = true;
        alertas.push({ tipo: "ciclo_inicio", anio: t, texto: tx(`En ${anioCal(t)} arrancas «${c.nombre}» con ${mmTxt(K)}.`, `In ${anioCal(t)} you start "${c.nombre}" with ${mmTxt(K)}.`) });
      }
      if (a.tomado && c.hasta < N && t === c.hasta + 1 && a.valor > 0) {
        Object.keys(canasta).forEach((k) => { canasta[k] += a.valor * mezcla[k] / 100; });
        alertas.push({ tipo: "ciclo_fin", anio: t, texto: tx(`En ${anioCal(t)} termina «${c.nombre}»: el capital vuelve y se reparte.`, `In ${anioCal(t)} "${c.nombre}" ends: the capital comes back and is allocated.`) });
        a.valor = 0;
      }
    });
    // 1) rendimientos y depreciación del año
    let creceAnio = 0;
    const creceCan = { colchon: 0, liquidez: 0, renta: 0, crecimiento: 0 };
    todos.forEach((a) => {
      a.creceT = 0;
      if (a.entrega && t <= a.entrega) return; // se valoriza desde la entrega
      const antes = a.valor;
      if (a.crec == null) { const p = t <= 3 ? sup.vehiculo.depAnios1a3Pct : sup.vehiculo.depDespuesPct; a.valor *= 1 + p / 100; }
      else a.valor *= 1 + a.crec;
      a.creceT = a.valor - antes; creceAnio += a.creceT;
    });
    creceCan.colchon = colchon * rCan.liquidez; colchon *= 1 + rCan.liquidez;
    todos.forEach((a) => { if (a.reserva > 0) { creceCan.colchon += a.reserva * rCan.liquidez; a.reserva *= 1 + rCan.liquidez; } });
    Object.keys(canasta).forEach((k) => { creceCan[k] += canasta[k] * rCan[k]; canasta[k] *= 1 + rCan[k]; });
    creceAnio += creceCan.colchon + creceCan.liquidez + creceCan.renta + creceCan.crecimiento;
    // 2) flujo del año (ingresos y gastos ya crecidos)
    // Convención (23-nov-2026, Finanzas): el año 1 es el año en curso y sus ingresos y
    // gastos van a precios de hoy (sin indexar); desde el año 2 suben con su tasa. El
    // patrimonio se cuenta al cierre de cada año y se lleva a pesos de hoy dividiendo
    // por (1+inflación)^t. Por eso el ahorro del año 1 (10 M) vale 10/1,05 ≈ 9,52 M de
    // hoy al cierre del año 1: no es doble deflación, es que se ahorra en pesos de 2026
    // y se mide al cierre. 24-nov-2026 (indexación): sueldo, gastos, «Lo que viene» y rentas
    // nuevas suben con la indexación: año 1 tal cual, año t × (1+indexación)^(t−1); el
    // deflactor usa la misma convención con la inflación del escenario.
    if (t > 1) { ingresos *= 1 + gIng; gastos *= 1 + gGas; pasivo *= 1 + gIng; }
    ingSeVan.filter((x) => x.desde === t).forEach((x) => { const v = x.mensual * 12 * Math.pow(1 + gIng, t - 1); ingresos = Math.max(0, ingresos - v); if (x.pasivo) pasivo = Math.max(0, pasivo - v); });
    if (t > 1) activos.forEach((a) => aplicarCambio(a, t));
    activos.forEach((a) => {
      if (!a.finRenta) return; a.finRenta = false;
      if (a.rentaReemplazada) return;
      const v = (a.rentaAnual || 0) * Math.pow(1 + gIng, t - 1);
      ingresos = Math.max(0, ingresos - v); pasivo = Math.max(0, pasivo - v); a.rentaAnual = 0;
    });
    // Renta nueva de un activo modificado: pesos de hoy, sube con la indexación.
    const rentaPers = todos.reduce((s, a) => s + (a.rentaPct ? a.valor / (1 + a.crec) * a.rentaPct : 0), 0);
    const ingFuturo = fut.ingresos.reduce((s, x) => s + (t >= x.desde && t <= x.hasta ? x.mensual * 12 * ixI(t) : 0), 0);
    // 23-nov-2026: lo que llega de «Lo que viene» sin un activo detrás (pensión, sueldo nuevo) es ingreso, no rendimiento.
    const ingFuturoSinActivo = fut.ingresos.reduce((s, x) => s + (!x.activoId && t >= x.desde && t <= x.hasta ? x.mensual * 12 * ixI(t) : 0), 0);
    // Renta nueva por meses: si arranca en el mes 7, el año 1 recibe 6 de 12 meses.
    const fraccionAnio = (mesInicio) => Math.min(1, Math.max(0, (12 * t - n(mesInicio)) / 12));
    const rentaNueva = rentaPers + ingFuturo + todos.reduce((s, a) => s + (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * ixI(t) : 0)
      + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * ixI(t), 0), 0);
    const gastoFuturo = (fut.gastos || []).reduce((sm, x) => sm + (t >= x.desde && t <= x.hasta ? x.anual * ixI(t) : 0), 0)
      - seVan.reduce((sm, g) => sm + (t >= g.desde ? g.mensual * 12 * Math.pow(1 + gGas, t - 1) : 0), 0);
    const cuota = deuda > 0 ? Math.min(cuotaAnual, deuda) : 0;
    deuda = Math.max(0, deuda - cuota);
    // Ganancia de los negocios que se repiten este año.
    let cicloFlujo = 0, cicloReinv = 0;
    todos.forEach((a) => {
      const c = a.ciclo; a.cicloG = 0; if (!c || !(a.valor > 0) || t < c.desde || t > c.hasta) return;
      const G = c.gananciaAnual * Math.pow(1 + inf, t - 1);
      a.cicloG = G;
      if (c.destino === "flujo") cicloFlujo += G; else cicloReinv += G;
    });
    // 25-oct-2026 (Santiago: "cuando uno elige «se reinvierte» no deja decir
    // en qué"). La ganancia va a la inversión elegida; si no hay, al reparto E.
    todos.forEach((a) => {
      if (!a.ciclo || !(a.cicloG > 0) || a.ciclo.destino === "flujo") return;
      const id = a.ciclo.destinoId;
      const dest = id && todos.find((x) => x.id === id && !x.ciclo);
      if (dest) dest.valor += a.cicloG;
      else if (id === "c_crecimiento") canasta.crecimiento += a.cicloG;
      else if (id === "c_renta") canasta.renta += a.cicloG;
      else if (id === "c_liquidez") canasta.liquidez += a.cicloG;
      else if (id === "c_disponible") colchon += a.cicloG;
      else Object.keys(canasta).forEach((k) => { canasta[k] += a.cicloG * mezcla[k] / 100; });
    });
    if (cicloReinv > 0) creceAnio += cicloReinv;
    const cf = ingresos + rentaNueva + cicloFlujo - gastos - gastoFuturo - cuota;
    if (cf >= 0) {
      // 25-oct-2026 (Santiago: "que salga lo que sobra cada mes… me sobran al
      // mes 100 M, en qué los quiero reinvertir, poder elegir"). Lo que sobra
      // del año va a los destinos elegidos (cfg.sobraDestinos: [{id, pct}]);
      // el % que no se asigne, como lo que sobra de las ventas (mezcla).
      let restoPct = 100;
      sobraDestinos.forEach((d) => {
        const v = cf * d.pct / 100; restoPct -= d.pct;
        const dest = todos.find((x) => x.id === d.id && !x.ciclo);
        if (dest) dest.valor += v;
        else if (d.id === "c_crecimiento") canasta.crecimiento += v;
        else if (d.id === "c_renta") canasta.renta += v;
        else if (d.id === "c_liquidez") canasta.liquidez += v;
        else if (d.id === "c_disponible") colchon += v; // 25-oct-2026: «se deja disponible para cualquier eventualidad»
        else restoPct += d.pct;
      });
      if (restoPct > 0) { if (disponible) colchon += cf * restoPct / 100; else Object.keys(canasta).forEach((k) => { canasta[k] += cf * (restoPct / 100) * mezcla[k] / 100; }); }
    } else {
      retirar(-cf);
      alertas.push({ tipo: "cf_negativo", anio: t, texto: tx(`En ${anioCal(t)} sale más de lo que entra; se usa tu liquidez.`, `In ${anioCal(t)} more goes out than comes in; your cash covers it.`) });
    }
    // Deuda sin intereses que se paga de una vez este año: sale de tu liquidez.
    unicas.forEach((d) => {
      if (d.t !== t || d.saldo <= 0) return;
      retirar(d.saldo); deudaUnica -= d.saldo;
      alertas.push({ tipo: "pago_unico", anio: t, texto: tx(`En ${anioCal(t)} pagas ${d.nombre} de una vez con tu liquidez.`, `In ${anioCal(t)} you pay off ${d.nombre} in one go with your cash.`) });
      d.pagadoEnAnio = d.saldo; d.saldo = 0;
    });
    // Pagos de un activo futuro: pasan de tu liquidez al activo (no cambia el patrimonio).
    // 24-oct-2026 (Santiago: "en 5 años quiero hacer una casa propia… esa plata
    // saldrá de algunas inversiones que tengo"). Si el activo futuro dice de qué
    // inversión sale (fuenteId), se saca de ahí; lo que falte, de la liquidez.
    // Varias fuentes con su %: «50 % de BTG y 50 % de IBKR». Lo que una
    // fuente no alcance y el % que no se asigne salen de la liquidez.
    todos.forEach((a) => (a.pagos || []).forEach((pg) => {
      if (pg.anio !== t || pg.monto <= 0) return;
      const pm = pg.monto * ix(t); // el pago se escribe en pesos de hoy
      let falta = pm; const partes = [];
      (a.fuentesPago || []).forEach((fp) => {
        const quiero = pm * fp.pct / 100; let saco = 0, nom = "";
        if (fp.id === "c_crecimiento" || fp.id === "c_renta") { const k = fp.id.slice(2); saco = Math.min(Math.max(0, canasta[k]), quiero); canasta[k] -= saco; nom = tx("lo que sobra reinvertido", "the reinvested surplus"); }
        else { const src = todos.find((y) => y.id === fp.id); if (src) {
          const antes = Math.max(0, src.valor);
          saco = Math.min(antes, quiero); src.valor -= saco; nom = src.nombre;
          // 25-oct-2026: si sacas plata de algo que te paga renta (Rapicredit),
          // su renta baja en la misma proporción; antes seguía completa.
          if (antes > 0 && saco > 0 && src.rentaAnual > 0 && !src.rentaReemplazada) {
            const fr = saco / antes, menos = src.rentaAnual * Math.pow(1 + gIng, t - 1) * fr;
            ingresos = Math.max(0, ingresos - menos); pasivo = Math.max(0, pasivo - menos); src.rentaAnual *= 1 - fr;
            if (menos > 0.5) alertas.push({ tipo: "renta_baja", anio: t, texto: tx(`Desde ${anioCal(t + 1)}, ${src.nombre} renta ${mmTxt(menos / 12)} menos al mes porque sacaste plata de ahí.`, `From ${anioCal(t + 1)}, ${src.nombre} earns ${mmTxt(menos / 12)} less a month because you withdrew money from it.`) });
          }
        } }
        if (saco > 0) { falta -= saco; partes.push(tx(`${mmTxt(saco)} de ${nom}`, `${mmTxt(saco)} from ${nom}`)); }
      });
      if (falta > 0.5) retirar(falta);
      pg.deFuentes = Math.max(0, pm - Math.max(0, falta)); pg.fuentesTxt = partes.join(tx(" y ", " and "));
      a.valor += pm;
      alertas.push({ tipo: "pago_futuro", anio: t, texto: partes.length ? tx(`En ${anioCal(t)} pagas ${a.nombre}: ${partes.join(" y ")}${falta > 0.5 ? ", y el resto de tu liquidez" : ""}.`, `In ${anioCal(t)} you pay for ${a.nombre}: ${partes.join(" and ")}${falta > 0.5 ? ", and the rest from your cash" : ""}.`) : tx(`En ${anioCal(t)} pagas parte de ${a.nombre} con tu liquidez.`, `In ${anioCal(t)} you pay part of ${a.nombre} with your cash.`) });
    }));
    // Inversión adicional (se escribe en pesos de hoy; entra indexada al año): pasa de tu liquidez al activo. No cambia el patrimonio.
    todos.forEach((a) => {
      (a.aportesFuturos || []).forEach((x) => {
        if (x.anio !== t) return;
        const xm = x.monto * ix(t); // aporte escrito en pesos de hoy
        if (x.apartado != null) {
          // Lo apartado de las ventas entra ahora; lo que falte, de tu liquidez.
          const usa = Math.min(a.reserva || 0, xm);
          a.reserva = (a.reserva || 0) - usa;
          if (xm - usa > 0.5) retirar(xm - usa);
        } else if (!x.nuevo) retirar(xm);
        a.valor += xm;
        alertas.push({ tipo: "inversion_adicional", anio: t, texto: tx(`En ${anioCal(t)} pasas plata de tu liquidez a ${a.nombre}.`, `In ${anioCal(t)} you move cash into ${a.nombre}.`) });
      });
      if (a.invAnio === t && (a.invMonto > 0 || a.reserva > 0)) {
        // lo apartado entra al activo; lo que rindió mientras tanto vuelve al colchón
        if (a.reserva > 0) { a.valor += a.reservaBase; colchon += a.reserva - a.reservaBase; a.reserva = 0; }
        if (a.invMonto > 0) { const im = a.invMonto * ix(t); retirar(im); a.valor += im; }
        alertas.push({ tipo: "inversion_adicional", anio: t, texto: tx(`En ${anioCal(t)} pasas plata de tu liquidez a ${a.nombre}.`, `In ${anioCal(t)} you move cash into ${a.nombre}.`) });
      }
    });
    // Salto de valor al terminar una obra o al recibir lo que se construye
    // (Santiago: "hay activos que se valorizan al momento de la construcción
    // de forma muy alta y después cada año"). Desde ahí sigue su % anual.
    todos.forEach((a) => (a.saltos || []).forEach((sx) => {
      const sv = sx.valor * ix(t); // «¿Cuánto vale cuando está lista?» en pesos de hoy
      if (sx.t !== t || !(sv > a.valor)) return;
      alertas.push({ tipo: "valorizacion_obra", anio: t, texto: tx(`En ${anioCal(t)} ${a.nombre} queda valiendo ${mmTxt(sv)} al terminar.`, `In ${anioCal(t)} ${a.nombre} is worth ${mmTxt(sv)} once finished.`) });
      a.valor = sv;
    }));
    if (canasta.crecimiento > 0) expUSD = true;
    const liquidez = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
    // Patrimonio (saldo al cierre del año t) ÷ (1+i)^t; flujos del año t (a precios del
    // año t, con el año 1 = hoy) ÷ (1+i)^(t−1): la misma convención con que se indexan.
    const deflactor = Math.pow(1 + inf, t);
    const deflactorFlujo = deflactorAnio(esc.inflacionPct, t);
    const activosT = valorTotal();
    const f = { anio: t, ingresos: ingresos + rentaNueva + cicloFlujo, rentaNueva, cicloFlujo, cicloReinv, gastos: gastos + gastoFuturo + cuota, gastoFuturo, cf, activos: activosT, invertible: invertible(), deuda: deuda + deudaUnica, liquidez, deflactor };
    // Lo que produce el patrimonio este año: renta que llega a la cuenta + lo que crece invertido.
    f.rentas = pasivo + rentaNueva + cicloFlujo; f.laboral = Math.max(0, ingresos - pasivo); f.crece = creceAnio; f.produce = f.rentas + creceAnio; f.ingFuturoSinActivo = ingFuturoSinActivo;
    // 19-nov-2026 (Santiago: "si me paro en 2028 que me muestre mis ingresos y
    // gastos de ese año"). Lo que sale, partido por año (suma exacta f.gastos):
    // gastos de Egresos, gastos futuros que corren, los que ya no se pagan y cuotas.
    f.cuota = cuota; f.gastosBase = gastos;
    f.gastosFut = (fut.gastos || []).filter((x) => t >= x.desde && t <= x.hasta).map((x) => ({ nombre: x.nombre, anual: x.anual * ixI(t), desde: x.desde, hasta: x.hasta, idx: x.idx, deCompra: x.deCompra }));
    f.ingresosFut = fut.ingresos.filter((x) => t >= x.desde && t <= x.hasta).map((x) => ({ nombre: x.nombre, anual: x.mensual * 12 * ixI(t), desde: x.desde, idx: x.idx }));
    f.gastosQueSeVan = seVan.filter((g) => t >= g.desde).map((g) => ({ nombre: g.nombre, anual: g.mensual * 12 * Math.pow(1 + gGas, t - 1) }));
    // 20-nov-2026 (Santiago: "¿por qué 2026 detalla más los ingresos y gastos
    // que los otros años?"). Partida por partida en cada año: cada gasto de
    // Egresos con su inflación (sin los que ya se acabaron), cada ingreso de
    // trabajo con su crecimiento y la cuota de cada deuda que sigue.
    const vanG = new Set(seVan.filter((g) => t >= g.desde).map((g) => g.key));
    const propioYa = new Set(activos.filter((a) => a.propioDesde && a.propioDesde <= t).map((a) => a.id));
    f.gastosItems = gastosHoy.filter((g) => !g.neteado || propioYa.has(g.activoId)).map((g) => ({ nombre: g.nombre, nota: g.cat, anual: g.mensual * 12 * Math.pow(1 + gGas, t - 1), seFue: vanG.has(g.key) }));
    const vanI = new Set(ingSeVan.filter((x) => t >= x.desde).map((x) => x.key));
    f.ingresosLab = ingresosHoy.filter((x) => !x.pasivo && !vanI.has(x.key)).map((x) => ({ nombre: x.nombre, anual: x.mensual * 12 * Math.pow(1 + gIng, t - 1) }));
    {
      const vivas = deudasVivas.filter((d) => d && d.sim !== false && !esUnica(d) && n(d.pg ?? d.pago) > 0 && !pagadasDespues.has(d.id));
      const totPg = vivas.reduce((s2, d) => s2 + n(d.pg ?? d.pago) * fxA(d), 0);
      f.cuotasItems = cuota > 0.5 && totPg > 0 ? vivas.map((d) => ({ nombre: d.n || d.nombre || tx("Deuda", "Debt"), anual: cuota * n(d.pg ?? d.pago) * fxA(d) / totPg })) : [];
    }
    const fr = Math.pow(1 + gIng, t - 1);
    f.porActivo = [
      ...todos.map((a) => {
        const rentaBase = a.rentaReemplazada ? 0 : (a.rentaAnual || 0) * fr;
        const rentaExtra = (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * ixI(t) : 0) + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * ixI(t), 0) + (a.rentaPct ? a.valor / (1 + (a.crec || 0)) * a.rentaPct : 0);
        const cg = a.ciclo ? a.cicloG || 0 : 0;
        // rentaNueva (23-nov-2026): la parte de la renta que crea el plan (renta nueva, aportes
        // con renta, «de lo que rinde, cuánto te llega» y la renta que cambias en el paso 1 desde
        // un año), para «Lo que cambia en tu bolsillo» año por año.
        const cambioRenta = a.cambio && !a.rentaReemplazada && a.rentaAntesCambio != null ? ((a.rentaAnual || 0) - a.rentaAntesCambio) * fr : 0;
        return { id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor + (a.reserva || 0), renta: rentaBase + rentaExtra + (a.ciclo && a.ciclo.destino === "flujo" ? cg : 0), rentaNueva: rentaExtra + cambioRenta, crece: (a.creceT || 0) + (a.ciclo && a.ciclo.destino !== "flujo" ? cg : 0) };
      }),
      { id: "c_liquidez", nombre: tx("Liquidez y colchón", "Cash and cushion"), clase: "canasta", valor: colchon + canasta.liquidez, renta: 0, crece: creceCan.colchon + creceCan.liquidez },
      { id: "c_renta", nombre: tx("Renta fija (lo que sobra)", "Fixed income (surplus)"), clase: "canasta", valor: canasta.renta, renta: 0, crece: creceCan.renta },
      { id: "c_crecimiento", nombre: tx("Crecimiento (lo que sobra)", "Growth (surplus)"), clase: "canasta", valor: canasta.crecimiento, renta: 0, crece: creceCan.crecimiento },
    ].filter((x) => Math.abs(x.valor) > 0.5 || x.renta > 0.5);
    // 24-oct-2026 (Santiago: "no me queda claro qué son otras rentas y se ve un
    // valor grande"). Las rentas que no están ligadas a un activo (PACAMANA,
    // dividendos, fees de renta) y los ingresos futuros se nombran una a una.
    f.rentasSueltas = [
      ...ingresosHoy.filter((x) => x.pasivo && !(x.activoId && (bOp.rentaNetaPorActivo || {})[x.activoId] != null) && !ingSeVan.some((y) => y.key === x.key && y.desde <= t))
        .map((x) => ({ id: "ing_" + x.key, nombre: x.nombre, clase: "ingreso", valor: 0, renta: x.mensual * 12 * Math.pow(1 + gIng, t - 1), crece: 0 })),
      ...fut.ingresos.map((x, k) => ({ id: "fut_" + k, nombre: x.nombre, clase: "ingreso", valor: 0, renta: t >= x.desde && t <= x.hasta ? x.mensual * 12 * ixI(t) : 0, crece: 0 })),
    ].filter((x) => x.renta > 0.5);
    f.patrimonio = activosT - deuda - deudaUnica;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.deflactorFlujo = deflactorFlujo;
    f.ingresosReal = (ingresos + rentaNueva + cicloFlujo) / deflactorFlujo; // incluye la renta nueva (bodega, ingresos futuros)
    f.gastosReal = f.gastos / deflactorFlujo;
    if (liquidez < 0 || todos.some((a) => a.valor < 0)) alertas.push({ tipo: "activo_negativo", anio: t, texto: tx(`En ${anioCal(t)} un activo o tu liquidez queda en negativo.`, `In ${anioCal(t)} an asset or your cash goes negative.`) });
    else if (obAnual > 0 && liquidez < metaColchon) alertas.push({ tipo: "liquidez_baja", anio: t, texto: tx(`En ${anioCal(t)} tu liquidez cubre menos de ${sup.colchonMeses} meses de gastos.`, `In ${anioCal(t)} your cash covers less than ${sup.colchonMeses} months of expenses.`) });
    filas.push(f);
  }
  const fin = filas[filas.length - 1];
  // 24-oct-2026 (Santiago: "no me dan los números"). Lo que entra y lo que
  // sale en el AÑO 1, partida por partida, al mes (como su plan SALEM: «Lo que
  // entra cada mes» / «Lo que sale cada mes»). Sale de las mismas reglas del
  // motor; si algo no se puede atribuir a una partida, queda como «Ajustes»
  // para que la suma siempre cuadre con la proyección.
  const desglose = (() => {
    const f1 = filas[1]; if (!f1) return { entra: [], sale: [] };
    const fxI = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trm : 1);
    const mesDe = (x, campo = "mensual") => montoPromedioMensual({ ...x, mensual: n(x?.[campo]) * fxI(x) });
    const sigue = (x) => x && x.sim !== false && !(x.activoId && vendidosIds.has(x.activoId));
    const conRenta = new Set(Object.keys(bOp.rentaNetaPorActivo || {}));
    const nombreActivo = (id) => { const a = (user.inv || []).find((y) => y.id === id); return a ? a.n || a.nombre : tx("un activo", "an asset"); };
    const entra = [];
    (user.ingresos || []).filter((i, k) => sigue(i) && !fuera.has(claveIngreso(user.ingresos, k)) && !ingSeVan.some((x) => x.key === claveIngreso(user.ingresos, k) && x.desde <= 1)).forEach((i) => {
      if (i.activoId && conRenta.has(i.activoId) && tipoIngreso(i) === "pasivo") return; // va como renta neta del activo
      const v = mesDe(i); if (v > 0.5) entra.push({ nombre: i.nombre || i.categoria || tx("Ingreso", "Income"), mensual: v, nota: tipoIngreso(i) === "pasivo" ? tx("renta · de tu página Ingresos", "passive · from your Income page") : tx("trabajo · de tu página Ingresos", "work · from your Income page") });
    });
    activos.filter((a) => a.rentaCorregida && a.rentaAnual > 0).forEach((a) => entra.push({ nombre: tx(`Renta de ${a.nombre}`, `Income from ${a.nombre}`), mensual: a.rentaAnual / 12 * Math.pow(1 + gIng, 0), nota: a.cambio ? tx("renta nueva: la cambiaste en el paso 1", "new income: you changed it in step 1") : tx("la corregiste en el paso Hoy", "you edited it in step 1") }));
    Object.entries(bOp.rentaNetaPorActivo || {}).forEach(([id, v]) => { const a = activos.find((x) => x.id === id); if (a?.rentaReemplazada || a?.rentaCorregida) return; if (v > 0.5) { const br = (bOp.rentaPorActivo || {})[id] || v, mm = (x) => (esUS() ? plataCorta(x) : fmtPlataEs(x));
      // 24-oct-2026 (Santiago: "Rapicredit me da el 21 % de 3.288 M"): se muestra la cuenta, no solo el neto.
      entra.push({ nombre: tx(`Renta de ${nombreActivo(id)}`, `Income from ${nombreActivo(id)}`), mensual: v, nota: br - v > 0.5 ? tx(`${mm(br)} de renta − ${mm(br - v)} de gastos ligados en Egresos`, `${mm(br)} income − ${mm(br - v)} linked expenses on Expenses`) : tx("renta de tu página Ingresos", "income from your Income page") }); } });
    const ff = 1 + inf;
    todos.forEach((a) => {
      const p0 = (filas[0].porActivo || []).find((x) => x.id === a.id);
      if (a.rentaPct) { const v = (p0 ? p0.valor : a.valor) * a.rentaPct / 12; if (v > 0.5) entra.push({ nombre: a.nombre, mensual: v, nota: tx(`${(a.rentaPct * 100).toFixed(1).replace(".", ",")} % al año que te llega`, `${(a.rentaPct * 100).toFixed(1)}% a year paid to you`) }); }
      const frac = (m) => Math.min(1, Math.max(0, (12 - n(m)) / 12));
      if (a.rentaNuevaAnual > 0 && frac(a.rentaDesdeMes) > 0) entra.push({ nombre: `${a.nombre} ${tx("(renta nueva)", "(new income)")}`, mensual: a.rentaNuevaAnual * frac(a.rentaDesdeMes) * ff / 12, nota: n(a.rentaDesdeMes) > 0 ? tx(`desde el mes ${n(a.rentaDesdeMes)}`, `from month ${n(a.rentaDesdeMes)}`) : "" });
      (a.rentasExtra || []).forEach((x) => { if (frac(x.desdeMes) > 0) entra.push({ nombre: `${a.nombre} ${tx("(renta nueva)", "(new income)")}`, mensual: x.anual * frac(x.desdeMes) * ff / 12, nota: n(x.desdeMes) > 0 ? tx(`desde el mes ${n(x.desdeMes)}; promedio del año 1`, `from month ${n(x.desdeMes)}; year-1 average`) : "" }); });
    });
    fut.ingresos.filter((x) => x.desde <= 1 && x.hasta >= 1).forEach((x) => entra.push({ nombre: x.nombre, mensual: x.mensual * ff, nota: tx("ingreso futuro", "future income") }));
    ciclos.filter((c) => c.destino === "flujo" && c.desde <= 1).forEach((c) => entra.push({ nombre: c.nombre, mensual: c.gananciaAnual / 12, nota: tx("ganancia del negocio que se repite", "profit from the repeating deal") }));
    const sale = [];
    Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).filter(sigue).forEach((g) => {
      if (g.activoId && conRenta.has(g.activoId) && !activos.some((a) => a.id === g.activoId && a.propioDesde === 1)) return; // ya restado de la renta de su activo
      const v = montoPromedioMensual(g) * fxI(g); const key = claveGasto(cat, items, (items || []).indexOf(g));
      if (fuera.has(key)) return;
      if (seVan.some((x) => x.key === key && x.desde <= 1)) return;
      if (v > 0.5) sale.push({ nombre: g.c || g.n || g.nombre || cat, mensual: v, nota: (g.c || g.n || g.nombre) ? cat : "" }); }));
    deudasVivas.filter((d) => d && d.sim !== false && !esUnica(d)).forEach((d) => { const v = montoPromedioMensual({ ...d, mensual: n(d.pg ?? d.pago) * fxI(d) }); if (v > 0.5) sale.push({ nombre: tx(`Cuota ${d.n || d.nombre || "deuda"}`, `${d.n || d.nombre || "Loan"} payment`), mensual: v, nota: tx("deuda", "debt") }); });
    (fut.gastos || []).filter((x) => x.desde <= 1 && x.hasta >= 1).forEach((x) => sale.push({ nombre: x.nombre, mensual: x.anual * ff / 12, nota: tx("gasto futuro", "future expense") }));
    const cuadra = (lista, total) => { const s = lista.reduce((t, x) => t + x.mensual, 0); const dif = total - s; if (Math.abs(dif) > Math.max(1, total * 0.005)) lista.push({ nombre: tx("Ajustes (crecimiento del año, cuotas que terminan, costos)", "Adjustments (growth during the year, payments ending, costs)"), mensual: dif, nota: "" }); return lista.sort((a, b) => b.mensual - a.mensual); };
    // Lo que rinde y NO te llega al mes (se reinvierte): BTG, IBKR, fondos…
    const reinvierte = (filas[1].porActivo || []).map((x) => { const a = todos.find((y) => y.id === x.id); return a && a.clase !== "inmueble" && a.clase !== "vehiculo" && (x.crece || 0) > 0.5 && !(a.rentaPct > 0) && !(a.rentaAnual > 0) ? { id: a.id, nombre: a.nombre, mensual: x.crece / 12, pct: (a.crec || 0) * 100 } : null; }).filter(Boolean).sort((a, b) => b.mensual - a.mensual);
    return { entra: cuadra(entra, f1.ingresos / 12), sale: cuadra(sale, f1.gastos / 12), reinvierte };
  })();
  // Cómo queda repartida la plata al final, inversión por inversión.
  const defl = fin.deflactor || 1;
  // 24-nov-2026 (indexación): `monto` es lo que escribiste (pesos de hoy); `montoAnio`, lo que
  // sale ese año en pesos de ese año (lo que usa la cuenta año por año, que va en pesos de cada año).
  const conMontoAnio = (u) => ({ ...u, montoAnio: u.anio > 1 ? n(u.monto) * ix(u.anio) : n(u.monto) });
  const repartoFinal = [
    ...todos.filter((a) => Math.abs(a.valor) > 0.5).map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor, valorReal: a.valor / defl })),
    ...[["colchon", tx("Colchón de liquidez", "Cash cushion"), colchon], ["liquidez", tx("Canasta liquidez", "Cash bucket"), canasta.liquidez], ["renta", tx("Canasta renta", "Income bucket"), canasta.renta], ["crecimiento", tx("Canasta crecimiento", "Growth bucket"), canasta.crecimiento]]
      .filter(([, , v]) => Math.abs(v) > 0.5).map(([id, nombre, v]) => ({ id, nombre, clase: "canasta", valor: v, valorReal: v / defl })),
  ].sort((x, y) => y.valor - x.valor);
  return {
    escenario: esc, mezcla, filas, alertas, liqAgotadaAnio,
    bolsaDetalle: { reservado: reservadoTotal, usos: [...usos, ...personalizadas.filter((c) => !c.holder).map((c) => ({ seccion: "C", nombre: c.nombre, monto: c.monto, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: c.anio, fuente: "liquidez" })), ...ciclos.filter((c) => c.desde > 1 && !c._apartado).map((c) => ({ seccion: "D", nombre: c.nombre, monto: c.capital, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: c.desde, fuente: c.fuente }))].map(conMontoAnio), excesoVentas, excesoCubierto, ciclos: ciclosTotal, vendido: vendidoTotal, deudas: deudasPagadasTotal, deudaSinCubrir, colchon: colchonInicial, reinvertido: reinvertidoTotal, nuevas: nuevasTotal, restante: bolsa, pedido: pedidoTotal, obras: obrasTotal, obrasPedido, capitalNuevo, capitalNuevoHoy, programadas: programadasTotal, pendienteAnio1, desdeLiquidez, faltante: Math.max(0, pedidoTotal - reinvertidoTotal - nuevasTotal - ciclosTotal - reservadoTotal) },
    reparto: repartoFinal,
    desglose,
    gastosHoy, seVan, ingresosHoy, ingSeVan,
    liberados,
    // 7-nov-2026 (La historia de tu plata): lo que rendía cada activo vendido, para explicar por qué se vende.
    vendidos: (b.inv || []).filter((x) => vendidos.has(x.id)).map((x) => { const rentaAnual = n(b.rentaNetaPorActivo[x.id]) * 12; return { id: x.id, nombre: x.n || x.nombre || tx("Activo", "Asset"), valor: n(x.va) * fxA(x), clase: claseActivo(x), rentaAnual, crec: crecimientoDefault(x, esc, sup, rentaAnual) }; }),
    reinversionesDetalle,
    ciclosDetalle,
    // 25-oct-2026 (Santiago: "en el resumen final veo «sobra» y uno no entiende
    // si se reinvierte"): a dónde va lo que sobra, en palabras.
    // 24-nov-2026 (Santiago: "qué desea hacer con lo que sobra: ahorrar en un fondo de reserva para
    // años futuros, renta corta, o dejarlo disponible para el año siguiente"). Lo que cada año mandas
    // a tu fondo de reserva ({ año: pesos de ese año }) y lo que rinde (renta fija corta). La cuenta
    // año por año (cuentaPorAnio) lo lleva; si un año falta para vivir, sale de ahí.
    reservaAnual: leerReservaAnual(cfg.reservaAnual, N),
    tasaReserva: rNom("rfCorto"),
    // 23-nov-2026: parte de lo que sobra cada año que no tiene destino fijo (cuentaPorAnio).
    sobraLibre: Math.max(0, 1 - Math.min(100, sobraDestinos.reduce((sm, d) => sm + d.pct, 0)) / 100),
    destinoSobraLista: (() => {
      const DISP = tx("Disponible", "Available"), LIQ = tx("Liquidez", "Cash"), RF = tx("Renta fija", "Fixed income"), CREC = tx("Crecimiento", "Growth");
      const nom = (id) => id === "c_disponible" ? DISP : id === "c_liquidez" ? LIQ : id === "c_renta" ? RF : id === "c_crecimiento" ? CREC : ((todos.find((x) => x.id === id) || {}).nombre || id);
      const l = sobraDestinos.map((d) => ({ nombre: nom(d.id), pct: d.pct }));
      const resto = 100 - sobraDestinos.reduce((sm, d) => sm + d.pct, 0);
      if (resto > 0.5) { if (disponible) l.push({ nombre: DISP, pct: resto }); else ["liquidez", "renta", "crecimiento"].forEach((k) => { if (mezcla[k] > 0) l.push({ nombre: k === "liquidez" ? LIQ : k === "renta" ? RF : CREC, pct: resto * mezcla[k] / 100 }); }); }
      return l;
    })(),
    destinoSobra: (() => {
      const nom = (id) => id === "c_disponible" ? tx("disponible", "available") : id === "c_liquidez" ? tx("liquidez", "cash") : id === "c_renta" ? tx("renta fija", "fixed income") : id === "c_crecimiento" ? tx("crecimiento", "growth") : ((todos.find((x) => x.id === id) || {}).nombre || id);
      const partes = sobraDestinos.map((d) => tx(`${Math.round(d.pct)} % a ${nom(d.id)}`, `${Math.round(d.pct)}% to ${nom(d.id)}`));
      const resto = 100 - sobraDestinos.reduce((sm, d) => sm + d.pct, 0);
      if (resto > 0.5) partes.push(disponible ? tx(`${Math.round(resto)} % queda disponible`, `${Math.round(resto)}% stays available`) : tx(`${Math.round(resto)} % se reparte (${Math.round(mezcla.liquidez)} % liquidez, ${Math.round(mezcla.renta)} % renta fija, ${Math.round(mezcla.crecimiento)} % crecimiento)`, `${Math.round(resto)}% is split (${Math.round(mezcla.liquidez)}% cash, ${Math.round(mezcla.renta)}% fixed income, ${Math.round(mezcla.crecimiento)}% growth)`));
      return partes.join(" · ");
    })(),
    // 23-nov-2026 (Santiago: "gráficos como ceros o sin mostrar nada": SKANDIA y BTG de 2027
    // salían «Vale en 2035 $0 ×0,0»). Las inversiones de años siguientes no llevaban su id, y
    // el informe no encontraba su serie. Ahora llevan id (y la propiedad raíz que te quedas,
    // su monto total y su año).
    nuevasDetalle: [...nuevas.filter((x) => x.clase !== "ciclo" && !x.apartadoDe).map((x) => ({ id: x.id, nombre: x.nombre, monto: x.montoTotal ?? x.montoInicial ?? 0, anio: x.anioInicio || 1, rendPct: ((x.crec || 0) + (x.rentaPct || 0)) * 100, pagaRenta: (x.rentaPct || 0) > 0 || (x.rentaNuevaAnual || 0) > 0, fuente: x.fuente, pr: !!x.propiedadRaiz })), ...personalizadas.map((c) => ({ id: c.id, nombre: c.nombre, monto: c.monto, anio: c.anio, rendPct: c.rendNom * 100, pagaRenta: c.pagaRenta ?? ((c.pctRecibe || 0) > 0), fuente: "liquidez" }))],
    futuros: fut,
    rentasDuplicadas: duplicadas,
    modificados: activos.filter((a) => modInfo[a.id]).map((a) => ({ id: a.id, ...modInfo[a.id] })),
    deudas: deudas.map(({ id, nombre, saldo, activoId, porVenta, ventaAnio, pagaAnio, ligadaEnPlan, pagar, pagado }) => {
      const u = unicas.find((x) => x.id === id);
      const x = deudas.find((y) => y.id === id);
      // 23-nov-2026 (Santiago: "pagué la Volvo en 2027 y sigue apareciendo en 2029"; "me sigue
      // apareciendo local la Macarena que se pagó en 2027"). Año en que la deuda ya no existe:
      // la que se paga hoy o con una venta de hoy (1), la que se paga en un año (ese año), la que
      // se paga con la venta de su activo en un año (ese año) o la que se termina de pagar con su
      // cuota (estimado con saldo, cuota y tasa). La pantalla no la muestra en los años siguientes.
      const d0 = x && x._d;
      let finCuota = null;
      if (d0 && !u) {
        const P = n(d0.pg ?? d0.pago) * fxA(d0), S = saldo, ea = n(d0.ts) / 100;
        const im = ea > 0 ? Math.pow(1 + ea, 1 / 12) - 1 : 0;
        if (P > 0 && S > 0 && P > im * S) {
          const meses = im > 0 ? -Math.log(1 - im * S / P) / Math.log(1 + im) : S / P;
          finCuota = Math.min(N + 1, 1 + Math.floor(meses / 12));
        }
      }
      const pagaEn = pagaAnio || (u && u.t >= 1 ? u.t : null);
      const pagaEnPlan = !!pagaAnio || !!(u && x && anioPagoDeuda(x._d, pagarCfg, N));
      const finAnio = pagar || porVenta ? 1 : pagaEn ? pagaEn : ventaAnio ? ventaAnio : finCuota;
      return { id, nombre, saldo, activoId, porVenta, ventaAnio, ligadaEnPlan, pagar, pagado, pagaAnio: pagaEn, pagaEnPlan, unica: !!u, finAnio, finPorCuota: !pagar && !porVenta && !pagaEn && !ventaAnio && finCuota != null,
        // 23-nov-2026: cuota mensual y año en que se acabaría sola con su cuota (para saber
        // desde y hasta cuándo el plan te libera esa cuota, año por año).
        cuotaMes: d0 && !u ? n(d0.pg ?? d0.pago) * fxA(d0) : 0, finNatural: finCuota,
        // 23-nov-2026: lo que sale ese año para pagarla (para la cuenta año por año).
        pagoEnAnio: u ? (u.pagadoEnAnio || 0) : (x && x.pagadoEnAnio) || 0 };
    }),
    // Pagos de las compras y construcciones de «Lo que viene», por año: `monto` como lo escribiste (pesos
    // de hoy), `montoAnio` en pesos de ese año; `deFuentes` (pesos de ese año) sale de una inversión elegida.
    pagosFuturos: fut.activos.flatMap((x) => (x.pagos || []).filter((p) => p.monto > 0.5).map((p, k) => ({ nombre: x.nombre, anio: p.anio, monto: p.monto, montoAnio: p.monto * ix(p.anio), deFuentes: p.deFuentes || 0, fuentesTxt: p.fuentesTxt || "", idx: x.idx, k }))),
    // 19-nov-2026 (Santiago: "en Pagar deudas no veo todas: no me sale la deuda
    // del carro"). Las deudas con cuota pero sin saldo cargado no se pueden
    // pagar con la venta (no se sabe cuánto se debe): se listan aparte con su cuota.
    deudasSinSaldo: deudasUser.filter((d) => !(n(d.mt) > 0) && n(d.pg ?? d.pago) > 0).map((d) => ({ id: d.id, nombre: d.n || d.nombre || tx("Deuda", "Debt"), cuota: n(d.pg ?? d.pago) * fxA(d), activoId: d.la || d.link || null })),
    cuotasQueSalenMes: Math.max(0, b.sd - bDeuda.sd),
    hoy: { patrimonio: b.patrimonioNeto, ingresoMensual: b.ia + b.ip, salidaMensual: b.obCaja ?? b.ob, flujoMensual: b.fl, liquidos: b.liquidos, colchonMeses: b.colchonMeses },
    activos: activos.map(({ id, nombre, clase, usd }) => ({ id, nombre, clase, usd })),
    // Inversiones de las que puede salir plata más adelante (casa propia, obras).
    fuentes: [...activos.filter((a) => a.clase !== "vehiculo" && a.clase !== "inmueble").map((a) => ({ id: a.id, nombre: a.nombre })), ...nuevas.map((x) => ({ id: x.id, nombre: x.nombre })), ...personalizadas.map((c) => ({ id: c.id, nombre: c.nombre })), ...(filas[0].porActivo || []).filter((x) => x.id === "c_crecimiento" || x.id === "c_renta").map((x) => ({ id: x.id, nombre: x.nombre }))],
    hayUSD: !sup.sinRiesgoCambiario && (todos.some((a) => a.usd && a.valor > 0) || [...activos, ...nuevas, ...personalizadas].some((a) => a.usd && (a.valor || a.monto) > 0) || expUSD),
    final: fin,
    // Comparativo contra la inflación: solo lo invertible (sin vehículos).
    vsInflacionReal: fila0.invertible > 0 ? (fin.invertibleReal / fila0.invertible - 1) * 100 : null,
  };
}

/** Valorización NOMINAL anual por defecto (fracción) de un activo según su clase. */
export function crecimientoDefault(a, esc, sup = supuestosF10(), rentaAnual = 0) {
  const inf = esc.inflacionPct / 100;
  const clase = claseActivo(a);
  if (clase === "vehiculo") return null; // depreciación por año
  if (clase === "inmueble") return a.valorizacionPct != null && a.valorizacionPct !== "" ? n(a.valorizacionPct) / 100 : (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1;
  if (rentaAnual > 0) return inf; // el rendimiento ya lo paga como ingreso
  if (clase === "liquido") return retornoNominalPreset("rfCorto", esc, sup) / 100;
  if (clase === "acciones") return retornoNominalPreset("sp500", esc, sup) / 100;
  return (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
}

/** Hint en % nominal para «¿Cuánto crees que se valoriza al año?». Vehículo: depreciación años 1–3. */
export function valorizacionHintPct(a, esc, sup = supuestosF10()) {
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
    // Meses desde hoy hasta la primera renta (0 = ya). Compatibilidad: si solo hay
    // año, empieza al inicio de ese año.
    rentaNuevaDesdeMes: !vacio(d.rentaNuevaDesdeMes) ? Math.min(119, Math.max(0, Math.round(n(d.rentaNuevaDesdeMes)))) : 12 * (anio(d.rentaNuevaDesde) - 1),
  };
}

/** Hint (% nominal) para una inversión personalizada: renta fija corto plazo del escenario. */
export function rendimientoHintPct(esc, sup = supuestosF10()) { return retornoNominalPreset("rfCorto", esc, sup); }

/** Normaliza una inversión «Otra (personalizada)». Rendimiento en % NOMINAL. */
export function leerPersonalizada(x = {}, esc, sup = supuestosF10()) {
  const rend = vacio(x.rendimientoNomPct) ? rendimientoHintPct(esc, sup) : n(x.rendimientoNomPct);
  return {
    nombre: String(x.nombre || "").trim() || tx("Inversión personalizada", "Custom investment"),
    monto: Math.max(0, n(x.monto)), anio: Math.min(10, Math.max(1, Math.round(n(x.anio) || 1))),
    rendNom: rend / 100, usd: String(x.moneda || "COP").toUpperCase() === "USD",
    // 24-oct-2026 (Santiago: "¿cómo así que los ingresos el primer año son 95 M?
    // ¿y lo de BTG?"). Antes «Paga renta» solo pagaba lo que rinde por encima de
    // la inflación; una renta fija paga la tasa completa y el capital queda
    // igual. Ahora se dice qué parte del rendimiento te llega (0–100 %): eso
    // entra al flujo y el resto se reinvierte. Escenarios viejos: «renta» = todo,
    // «valoriza» = nada.
    pctRecibe: !vacio(x.pctRecibe) ? Math.min(100, Math.max(0, n(x.pctRecibe))) : x.tipo === "renta" ? 100 : 0,
    get pagaRenta() { return this.pctRecibe > 0; },
  };
}

/**
 * «Lo que viene». ingresos: [{nombre, mensual (pesos de hoy), desde, hasta?, titular?}]
 * activos: [{nombre, clase: "inmueble"|"otro", valor, cuotaInicial, anioCuota, entrega,
 *            pagos?:[{monto, anio}], rentaMensual (pesos de hoy), rentaDesde, valorizacionNomPct}]
 * Pagos en pesos de hoy (el plan los lleva al año con la inflación del escenario). Si no hay `pagos`, se arma: cuota inicial en su año y el resto en la entrega.
 */
export function leerFuturos(f = {}, esc, sup = supuestosF10()) {
  const inf = esc.inflacionPct / 100;
  const anio = (v, d = 1) => Math.min(10, Math.max(1, Math.round(n(v) || d)));
  const ingresos = (f?.ingresos || []).map((x, idx) => {
    const desde = anio(x.desde);
    return { idx, nombre: String(x.nombre || "").trim() || tx("Ingreso futuro", "Future income"), mensual: Math.max(0, n(x.mensual)), desde, hasta: vacio(x.hasta) ? 99 : Math.max(desde, anio(x.hasta)), titular: x.titular || null, activoId: x.activoId || null, valorizacionNomPct: vacio(x.valorizacionNomPct) ? null : n(x.valorizacionNomPct) };
  }).filter((x) => x.mensual > 0);
  const activos = (f?.activos || []).map((x, idx) => {
    const entrega = anio(x.entrega);
    let pagos;
    if (Array.isArray(x.pagos) && x.pagos.length) pagos = x.pagos.map((p) => ({ monto: Math.max(0, n(p.monto)), anio: anio(p.anio) }));
    else {
      const valor = Math.max(0, n(x.valor)), cuota = Math.min(valor, Math.max(0, n(x.cuotaInicial)));
      pagos = [{ monto: cuota, anio: Math.min(anio(x.anioCuota), entrega) }, { monto: valor - cuota, anio: entrega }];
    }
    const def = ["inmueble", "vivienda", "lote"].includes(x.clase) ? (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1 : (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
    return { idx, nombre: String(x.nombre || "").trim() || tx("Activo futuro", "Future asset"), clase: ["inmueble", "vivienda", "lote"].includes(x.clase) ? "inmueble" : "otro", vivienda: x.clase === "vivienda", tipo: x.clase || "inmueble", fuentesPago: leerFuentesPago(x), valorAlTerminar: Math.max(0, n(x.valorAlTerminar)), entrega, pagos, gastoMensual: Math.max(0, n(x.gastoMensual)),
      crec: vacio(x.valorizacionNomPct) ? def : n(x.valorizacionNomPct) / 100, valorizacionDefault: vacio(x.valorizacionNomPct),
      rentaMensual: Math.max(0, n(x.rentaMensual)), rentaDesde: anio(x.rentaDesde, entrega) };
  }).filter((x) => x.pagos.some((p) => p.monto > 0));
  // 24-oct-2026 (Santiago: "como vienen nuevas rentas también vienen nuevos
  // gastos: mis hijos en la universidad afuera, unos 180 M por año").
  // gastos: [{nombre, anual (pesos de hoy), desde, anios?}] — sube con la indexación.
  const gastos = [...(f?.gastos || []).map((x, idx) => {
    const desde = anio(x.desde);
    const anios = vacio(x.anios) ? null : Math.max(1, Math.round(n(x.anios)));
    return { idx, nombre: String(x.nombre || "").trim() || tx("Gasto futuro", "Future expense"), anual: Math.max(0, n(x.anual)), desde, hasta: anios == null ? 99 : desde + anios - 1 };
  }),
  // 24-nov-2026 (Santiago: "en 5 años quiero comprar una casa… lote + casa, metro cuadrado,
  // valorización"). Lo que cuesta tener lo que compras (predial, administración, mantenimiento)
  // empieza cuando lo recibes y entra en lo que te cuesta vivir.
  ...activos.filter((a) => a.gastoMensual > 0).map((a) => ({ nombre: tx(`Lo que cuesta tener ${a.nombre}`, `Cost of owning ${a.nombre}`), anual: a.gastoMensual * 12, desde: a.entrega, hasta: 99, deCompra: a.idx }))].filter((x) => x.anual > 0);
  return { ingresos, activos, gastos };
}

/** Mezcla personalizada: debe sumar 100%. Devuelve null o el mensaje para mostrar. */
export function validarMezcla(m) {
  if (!m) return null;
  const s = ["liquidez", "renta", "crecimiento"].reduce((t, k) => t + (Number(m[k]) || 0), 0);
  if (Math.abs(s - 100) < 0.01) return null;
  return tx(`La mezcla suma ${String(Math.round(s * 10) / 10).replace(".", ",")}%. Ajústala para que sume 100%.`, `The mix adds up to ${Math.round(s * 10) / 10}%. Adjust it to total 100%.`);
}

export function normalizarMezcla(m = {}) {
  const l = Math.max(0, n(m.liquidez)), r = Math.max(0, n(m.renta)), c = Math.max(0, n(m.crecimiento));
  const s = l + r + c;
  if (s <= 0) return { liquidez: 100, renta: 0, crecimiento: 0 };
  return { liquidez: (l / s) * 100, renta: (r / s) * 100, crecimiento: (c / s) * 100 };
}

/** Paso 6: cuánto dan $100M (u otro monto) a 3, 5 y 10 años, nominal y en pesos de hoy. */
export function cienMillones(presetClave, esc, monto = 100e6, sup = supuestosF10()) {
  const r = retornoNominalPreset(presetClave, esc, sup) / 100;
  const inf = esc.inflacionPct / 100;
  return [3, 5, 10].map((a) => { const nom = monto * Math.pow(1 + r, a); return { anios: a, nominal: nom, hoy: nom / Math.pow(1 + inf, a) }; });
}

/**
 * 24-oct-2026 (Santiago: "estoy perdido… si a mí me pasa, a otros les pasará").
 * La obra y la renta nueva vivían en dos lados (Decide → «Se modifica» y
 * Reinvierte). Queda un solo camino: Reinvierte → «Aumentar lo que ya tienes».
 * Esta función pasa un «Se modifica» guardado a una reinversión equivalente
 * (aporte, año, renta, desde qué mes, valorización) y deja el activo en
 * «continúa». No toca lo que ya estaba como reinversión.
 */
// 25-oct-2026 (Santiago: "modifico algunas inversiones y no resta"). Un mismo
// activo podía quedar dos veces en reinversiones (una de la migración de «Se
// modifica» o de una versión anterior): la pantalla edita la primera y el
// cálculo sumaba también la escondida. Vale una por activo: la que se ve.
export function unaPorActivo(lista = []) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter((r) => {
    if (!r || !r.activoId) return false;
    if (vistos.has(r.activoId)) return false;
    vistos.add(r.activoId); return true;
  });
}
/**
 * 23-nov-2026 — «Negocios que se repiten» (cfg.ciclos) pasa a «Propiedad raíz →
 * Proyecto asociativo» en inversiones nuevas, con los mismos números: capital,
 * valor final, duración en meses, desde, hasta, costos, impuesto, fuente y destino.
 * Sale el mismo ciclo, así que el resultado del plan no cambia.
 */
export function migrarCiclos(cfg = {}) {
  const cs = Array.isArray(cfg.ciclos) ? cfg.ciclos : [];
  if (!cs.length) return cfg;
  const nuevas = cs.filter((c) => c && n(c.capital) > 0 && n(c.valorFinal) > 0).map((c) => ({
    preset: "fincaRaiz", nombre: c.nombre || "", anio: Math.max(1, Math.round(n(c.desde)) || 1), fuente: c.fuente || "venta",
    pr: { tipo: "asociativo", valor: n(c.capital), valorFinal: n(c.valorFinal), meses: Math.max(1, Math.round(n(c.meses)) || 12), final: "vende", repite: true,
      ...(vacio(c.hasta) ? {} : { hasta: Math.round(n(c.hasta)) }), costosPct: vacio(c.costosPct) ? 0 : n(c.costosPct), costosSobre: "ganancia", ventaModo: "total",
      ...(c.regimen ? { regimen: c.regimen } : {}), ...(vacio(c.impuestoPct) ? {} : { impuestoPct: n(c.impuestoPct) }),
      destino: c.destino === "flujo" ? "flujo" : "reinvierte", ...(c.destinoId ? { destinoId: c.destinoId } : {}) },
  }));
  return { ...cfg, ciclos: [], nuevas: [...(cfg.nuevas || []), ...nuevas] };
}
export function migrarModifica(cfg0 = {}, esc) {
  const cfg = migrarCiclos(cfg0);
  const dec = cfg.decisiones || {};
  const extra = [];
  const nuevasDec = {};
  let cambio = false;
  Object.entries(dec).forEach(([id, d]) => {
    if (d?.accion !== "modifica") { nuevasDec[id] = d; return; }
    cambio = true;
    const m = leerModifica(d, esc || { inflacionPct: INFLACION_DEFAULT_PCT });
    if (m.inversionMonto > 0 || m.rentaNuevaMensual > 0 || m.valorizacionNomPct != null) {
      extra.push({ activoId: id, monto: m.inversionMonto || "", anio: m.inversionAnio, rentaMensual: m.rentaNuevaMensual || "", rentaDesdeMes: m.rentaNuevaDesdeMes, ...(m.valorizacionNomPct != null ? { valorizacionNomPct: m.valorizacionNomPct } : {}) });
    }
    nuevasDec[id] = { accion: "continua" };
  });
  const ya = new Set((cfg.reinversiones || []).map((r) => r && r.activoId));
  // Varios aportes por activo están permitidos (en años distintos); solo se evita
  // duplicar el que viene de un «Se modifica» viejo.
  const vistosM = new Set();
  const lista = [...(cfg.reinversiones || []), ...extra.filter((x) => !ya.has(x.activoId))].filter((x) => {
    if (!x || !x.activoId) return false;
    const c = x.activoId + "|" + Math.max(1, Math.round(n(x.anio)) || 1);
    if (vistosM.has(c)) return false; vistosM.add(c); return true;
  });
  if (!cambio) return lista.length === (cfg.reinversiones || []).length ? cfg : { ...cfg, reinversiones: lista };
  return { ...cfg, decisiones: nuevasDec, reinversiones: lista };
}


/**
 * 24-oct-2026 (Santiago: "visualizar así los planes, es una nota… tiene un
 * resumen muy bueno en cada tarjeta"). Resumen corto de un escenario para su
 * tarjeta, armado con lo que decidió: qué vende, en qué pone la plata y qué
 * empieza después. El usuario puede escribir el suyo; este es el de respaldo.
 */
export function resumenEscenario(r) {
  if (!r) return "";
  const corto = (v) => (esUS() ? plataCorta(Math.abs(Number(v) || 0)) : fmtPlataEs(Math.abs(Number(v) || 0)));
  const partes = [];
  if ((r.vendidos || []).length) partes.push(tx(`Vende ${r.vendidos.map((v) => v.nombre).join(" y ")}`, `Sell ${r.vendidos.map((v) => v.nombre).join(" and ")}`));
  const inv = [...(r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => ({ n: x.nombre, v: x.aporte })), ...(r.nuevasDetalle || []).map((x) => ({ n: x.nombre, v: x.monto }))].sort((a, b) => b.v - a.v);
  if (inv.length) partes.push(inv.slice(0, 2).map((x) => `${x.n} ${corto(x.v)}`).join(" + "));
  (r.ciclosDetalle || []).forEach((c) => partes.push(tx(`${c.nombre} ${corto(c.capital)} cada ${c.meses === 12 ? "año" : c.meses + " meses"}`, `${c.nombre} ${corto(c.capital)} every ${c.meses === 12 ? "year" : c.meses + " months"}`)));
  const pagadas = (r.deudas || []).filter((d) => d.pagado > 0);
  if (pagadas.length) partes.push(pagadas.length === 1 ? tx(`paga ${pagadas[0].nombre}`, `pay off ${pagadas[0].nombre}`) : tx(`paga ${pagadas.length} deudas`, `pay off ${pagadas.length} debts`));
  const fut = r.futuros || { ingresos: [] };
  if ((fut.ingresos || []).length) partes.push(tx(`${fut.ingresos[0].nombre} desde ${anioCal(fut.ingresos[0].desde)}`, `${fut.ingresos[0].nombre} from ${anioCal(fut.ingresos[0].desde)}`));
  if (!partes.length) return tx("Todo sigue como está hoy.", "Everything stays as it is today.");
  const t = partes.join(" · ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}


/** Fuentes de pago de una compra futura: [{id, pct}] (compatibilidad: fuenteId = 100 %). */
export function leerFuentesPago(x = {}) {
  // 24-oct-2026 (Santiago: "voy a comprarla con la plata de esto y esto, y el
  // valor que voy a retirar de cada una"). Cada fuente puede decir un monto en
  // pesos; se convierte a % del valor total para repartir cada pago.
  const total = Number(x.valor) || 0;
  const conv = (f) => (f && f.monto != null && f.monto !== "" && total > 0 ? { id: f.id, pct: Math.min(100, (Number(f.monto) || 0) / total * 100) } : f);
  const lista = (Array.isArray(x.fuentes) ? x.fuentes : x.fuenteId ? [{ id: x.fuenteId, pct: 100 }] : []).map(conv);
  let usado = 0;
  return lista.filter((f) => f && f.id).map((f) => { const p = Math.max(0, Math.min(100 - usado, Number(f.pct) || 0)); usado += p; return { id: f.id, pct: p }; }).filter((f) => f.pct > 0);
}

// ── Lo que se va con una venta ─────────────────────────────────────────────
// 24-oct-2026 (Santiago: "aparecen rentas que ya no van" — Puerto Madero y
// Orlando vendidos seguían con su renta porque en Ingresos no estaban
// vinculadas al activo). Ingresos de renta y gastos sin vínculo cuyo nombre
// lleva una palabra propia del activo (Orlando, Madero…) se sugieren; el
// usuario confirma o corrige en Decide. Claves: ingresos "i:<índice>",
// gastos "<categoría>::<índice>" (las mismas de «Gastos que se acaban»).
const GENERICAS = new Set(["renta", "rentas", "local", "locales", "apto", "apartamento", "casa", "lote", "bodega", "oficina", "finca", "cuenta", "fondo", "credito", "inversion", "inversiones", "arriendo", "edificio", "proyecto", "tradicional", "airbnb", "acciones", "unidad",
  // 3-nov-2026 — Palabras genéricas en inglés (demo y usuarios de EE. UU.): «Rental duplex —
  // East Austin» se llevaba todo lo que dijera "rental" o "east".
  "rental", "rentals", "rent", "home", "house", "property", "condo", "apartment", "duplex", "fourplex", "unit", "units", "land", "building", "office", "account", "fund", "loan",
  "short", "term", "long", "vacation", "east", "west", "north", "south", "primary", "residence"]);
const sinTilde = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/**
 * 19-nov-2026 (Santiago: "revise que esta renta no se duplique: la puse en
 * ingreso futuro y después en «Invertir en lo que ya tienes» también aparece
 * la renta"). Un ingreso futuro que sale de un activo al que también le pones
 * renta en «Invertir en lo que ya tienes» es la MISMA renta.
 *   seguro: el ingreso futuro apunta a ese activo → se cuenta una sola vez (la
 *           de la inversión, que trae monto, fecha y desde cuándo renta).
 *   posible: no está vinculado pero se llama parecido o tiene el mismo monto →
 *           solo se avisa.
 * Devuelve [{ k, ingreso, activoId, activo, mensual, contada, seguro }].
 */
/**
 * 22-nov-2026 (Santiago: "invertí en un CDT por 6 meses o 1 año: el sistema sabe
 * cuánto capital hay, cuánto renta y hasta cuándo; en un escenario futuro debe
 * decirme que en el año X tengo libre esa plata"). El vencimiento cargado en
 * Patrimonio (venceAnio/venceMes) entra al plan como «termina» ese año, salvo
 * que el escenario diga otra cosa de ese activo (se conserva = se renueva).
 * Año del plan: 1 = año en curso. Si vence este año, la plata queda libre al
 * empezar el siguiente (año 2). Lo que ya venció o vence después del plan no cuenta.
 */
export function vencimientosPatrimonio(user = {}, N = 10) {
  const hoy = new Date().getFullYear(), out = {};
  (user.inv || []).forEach((a) => {
    if (!a || a.sim === false || !(n(a.venceAnio) > 0)) return;
    const t = Math.round(n(a.venceAnio)) - hoy + 1;
    if (t < 1 || t > N) return;
    out[a.id] = Math.max(2, n(a.venceMes) >= 12 ? t + 1 : t);
  });
  return out;
}
/**
 * 22-nov-2026 (Santiago: "poder poner en cualquier gasto, ingreso o inversión los
 * periodos que duran, o si no tiene caducidad… así el sistema siempre sabe para
 * las proyecciones y el usuario no repite información"). Ingresos y Egresos
 * pueden llevar «termina en mes/año» (finAnio/finMes). Año del plan desde el que
 * ya no cuenta: si termina en el primer semestre, ese mismo año; si en el
 * segundo, el siguiente. Lo de este año: si ya pasó, desde ya; si no, desde el año 2.
 */
function anioPlanFin(x, N) {
  if (!x || !(n(x.finAnio) > 0)) return null;
  const d = new Date(), hoy = d.getFullYear(), mesHoy = d.getMonth() + 1;
  const t = Math.round(n(x.finAnio)) - hoy + 1, m = Math.max(1, Math.min(12, Math.round(n(x.finMes)) || 12));
  if (t < 1) return 1;
  const desde = t === 1 ? (m < mesHoy ? 1 : 2) : (m >= 7 ? t + 1 : t);
  return desde > N ? null : desde;
}
export function finalesDeDatos(user = {}, N = 10) {
  const ingresos = {}, gastos = {};
  (user.ingresos || []).forEach((i, k) => { const t = i && i.sim !== false ? anioPlanFin(i, N) : null; if (t) ingresos[claveIngreso(user.ingresos, k)] = t; });
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => { const t = g && g.sim !== false ? anioPlanFin(g, N) : null; if (t) gastos[claveGasto(cat, items, idx)] = t; }));
  return { ingresos, gastos };
}
/** cfg con las fechas cargadas en Patrimonio, Ingresos y Egresos aplicadas donde el escenario no decidió nada. */
export function conVencimientos(cfg = {}, user = {}) {
  if (cfg._conVenc) return cfg;
  const N = n(cfg.anios) || 10;
  const v = vencimientosPatrimonio(user, N), dec = { ...(cfg.decisiones || {}) };
  Object.entries(v).forEach(([id, t]) => { if (!dec[id]) dec[id] = { accion: "termina", desde: t, dePatrimonio: true }; });
  // «sigue» = el escenario dice que NO se acaba aunque el dato tenga fecha de fin.
  const fin = finalesDeDatos(user, N);
  const une = (propio = {}, deDatos = {}) => { const out = { ...deDatos, ...propio }; Object.keys(out).forEach((k) => { if (out[k] === "sigue") delete out[k]; }); return out; };
  return { ...cfg, decisiones: dec, ingresosTerminan: une(cfg.ingresosTerminan, fin.ingresos), gastosTerminan: une(cfg.gastosTerminan, fin.gastos), _conVenc: true };
}
/** Inversiones nuevas con plazo: [{ id: "nueva_k", anio: 2..N, monto: null (todo) | pesos }]. */
export function leerRetirosNuevas(cfg = {}, N = 10) {
  return (cfg.nuevas || []).map((x, k) => {
    const hasta = Math.round(n(x && x.hasta)), inicio = x ? Math.max(1, Math.round(n(x.anio)) || 1) : 1;
    if (!x || !(hasta > inicio) || hasta > N) return null;
    return { id: "nueva_" + k, anio: hasta, monto: x.retiraParte && n(x.retira) > 0 ? n(x.retira) : null };
  }).filter(Boolean);
}
/** Inversión a plazo (no inmueble ni vehículo) que paga renta: el capital vuelve igual, no crece. */
const capitalPlano = (a, clase, rentaAnual, plazoEn) => !!plazoEn[a.id] && rentaAnual > 0.5 && clase !== "inmueble" && clase !== "vehiculo";
/**
 * Año del plan (1 = hoy) en que se paga una deuda según cfg.pagarDeudas:
 * true (escenarios viejos) o un año calendario ≤ el actual → 1; un año siguiente → su índice;
 * sin elegir o «Sigue» (false) → null.
 */
export function anioPagoDeuda(d, pagarCfg = {}, N = 10) {
  const v = pagarCfg[d && d.id];
  if (v === true) return 1;
  const y = Math.round(n(v));
  if (!(y > 0)) return null;
  return Math.min(N, Math.max(1, y - new Date().getFullYear() + 1));
}
/** De qué activo es una deuda: lo dicho en el plan (cfg.deudaDe; "" = de ninguno) o lo cargado en Deudas. */
export const deudaActivo = (d, cfg = {}) => { const m = (cfg.deudaDe || {})[d && d.id]; return m === "" ? null : m || (d && (d.la || d.link)) || null; };
/**
 * Activo del que PARECE ser una deuda (por el nombre), solo para sugerirlo: nunca se liga solo.
 * Tiene que haber un único activo cuyas palabras propias aparezcan en el nombre de la deuda.
 */
export function sugerirActivoDeDeuda(nombreDeuda, activos = []) {
  const pal = (t) => sinTilde(t || "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERICAS.has(w));
  const nd = new Set(pal(nombreDeuda)); if (!nd.size) return null;
  const hits = (activos || []).map((a) => ({ a, n: pal(a.nombre || a.n).filter((w) => nd.has(w)).length })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  if (!hits.length || (hits[1] && hits[1].n === hits[0].n)) return null;
  return hits[0].a.id;
}
/** Activos que se venden o vencen en un año siguiente: { id: año 2..N }. */
export function leerTerminan(cfg = {}, N = 10) {
  const out = {};
  Object.entries(cfg.decisiones || {}).forEach(([id, d]) => { if (d && d.accion === "termina" && n(d.desde) > 1) out[id] = Math.min(N, Math.round(n(d.desde))); });
  return out;
}
/** Cambios del paso 1: { id: { modo: "propio"|"renta", desde: 1..N, mensual } }; mensual 0 → "propio". */
export function leerCambios(cfg = {}, N = 10) {
  const out = {};
  Object.entries(cfg.decisiones || {}).forEach(([id, d]) => {
    if (!d || d.accion !== "cambia") return;
    // Un solo dato: la renta nueva. 0 = deja de rentar (la usas tú). Vacía = sigue igual.
    if (vacio(d.mensual)) return;
    const mensual = Math.max(0, n(d.mensual));
    out[id] = { modo: mensual > 0 ? "renta" : "propio", desde: Math.min(N, Math.max(1, Math.round(n(d.desde)) || 1)), mensual };
  });
  return out;
}
export function rentasDuplicadas(cfg = {}, activos = []) {
  const nombreDe = (id) => ((activos || []).find((a) => a && a.id === id) || {}).nombre || ((activos || []).find((a) => a && a.id === id) || {}).n || "";
  // Solo reinversiones de activos que siguen (un activo vendido no aplica su reinversión guardada).
  const vivos = new Set((activos || []).filter(Boolean).map((a) => a.id));
  const vendidos = new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  const conRenta = unaPorActivo(cfg.reinversiones).filter((r) => n(r.rentaMensual) > 0 && vivos.has(r.activoId) && !vendidos.has(r.activoId));
  if (!conRenta.length) return [];
  const out = [];
  (cfg.futuros?.ingresos || []).forEach((x, k) => {
    if (!x || !(n(x.mensual) > 0)) return;
    const distinta = new Set([].concat(x.noEsRentaDe || []));
    const igual = conRenta.find((r) => r.activoId === x.activoId && !distinta.has(r.activoId));
    if (igual) { out.push({ k, ingreso: String(x.nombre || "").trim() || tx("Ingreso futuro", "Future income"), activoId: igual.activoId, activo: nombreDe(igual.activoId), mensual: n(x.mensual), contada: n(igual.rentaMensual), seguro: true }); return; }
    if (x.activoId) return; // vinculado a otro activo: es otra renta
    // 19-nov-2026 (Santiago: "el sistema debe ser muy cuidadoso: una persona puede
    // tener 5 bodegas o 10 lotes, no confundirse"). Sin vínculo, el nombre o el
    // monto NUNCA borran un ingreso: solo sugieren y la persona confirma (vincula
    // el ingreso al activo o dice que es otra renta). Solo el vínculo decide.
    const nom = sinTilde(x.nombre || "");
    const palabras = (t) => sinTilde(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const distintivas = (id) => palabras(nombreDe(id)).filter((w) => !GENERICAS.has(w) && !(activos || []).some((a) => a && a.id !== id && palabras(a.nombre || a.n || "").includes(w)));
    const parecida = conRenta.filter((r) => !distinta.has(r.activoId)).find((r) =>
      Math.abs(n(x.mensual) - n(r.rentaMensual)) <= Math.max(1, n(r.rentaMensual) * 0.01) || distintivas(r.activoId).some((w) => nom.includes(w)));
    if (parecida) out.push({ k, ingreso: String(x.nombre || "").trim() || tx("Ingreso futuro", "Future income"), activoId: parecida.activoId, activo: nombreDe(parecida.activoId), mensual: n(x.mensual), contada: n(parecida.rentaMensual), seguro: false });
  });
  return out;
}
/**
 * 19-nov-2026 (Santiago: "me pide ingresos futuros, pongo que el lote será una
 * bodega y me dará 8.500.000; después, aparte, le invierto 600 M al mismo lote
 * y me pregunta cuánto renta: vuelvo a poner 8.500.000 y el sistema los toma
 * como dos"). Ingresos de Lo que viene que parecen ser la renta de este activo:
 * vinculados a él o con una palabra del nombre en común. Para ofrecer «es la
 * misma» en Invertir en lo que ya tienes.
 */
export function rentasFuturasDelActivo(cfg = {}, activo = {}, todos = []) {
  const pal = (t) => sinTilde(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  // Solo palabras que distinguen a este activo de los demás («macarena» está en
  // el lote y en el local: no sirve para saber cuál es).
  const delActivo = pal(activo.nombre || activo.n || "").filter((w) => !(todos || []).some((a) => a && a.id !== activo.id && pal(a.nombre || a.n || "").includes(w)));
  return (cfg.futuros?.ingresos || []).map((x, k) => ({ x, k, vinculada: !!x && x.activoId === activo.id })).filter(({ x }) => {
    if (!x || !(n(x.mensual) > 0)) return false;
    if ([].concat(x.noEsRentaDe || []).includes(activo.id)) return false;
    if (x.activoId) return x.activoId === activo.id;
    return pal(x.nombre || "").some((w) => delActivo.includes(w));
  });
}
export function sugerirVinculados(user = {}, activoId) {
  const a = (user.inv || []).find((x) => x && x.id === activoId);
  const out = { auto: { ingresos: [], gastos: [] }, ingresos: [], gastos: [] };
  if (!a) return out;
  const toks = sinTilde(a.n || a.nombre).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERICAS.has(t));
  const pega = (txt) => toks.length > 0 && toks.some((t) => sinTilde(txt).includes(t));
  // Vínculo a un activo que ya no existe = sin vínculo (pasa con activos borrados y recreados).
  const existe = new Set((user.inv || []).filter(Boolean).map((x) => x.id));
  const suelto = (x) => !x.activoId || !existe.has(x.activoId);
  (user.ingresos || []).forEach((i, k) => {
    if (!i || i.sim === false) return;
    // 3-nov-2026: un salario u honorario nunca se va con la venta de un activo. Antes
    // «Rental duplex — East Austin» se llevaba el salario de «Austin Tech Co.» (y en
    // Colombia, vender un «Local Medellín» podía llevarse un salario de «Empresa Medellín»).
    if (esLaboral(i) && i.activoId !== activoId) return;
    const nombre = i.nombre || i.categoria || tx("Ingreso", "Income"), item = { key: claveIngreso(user.ingresos, k), nombre, mensual: montoPromedioMensual(i), moneda: i.moneda };
    if (i.activoId === activoId) out.auto.ingresos.push(item);
    else out.ingresos.push({ ...item, sugerido: suelto(i) && pega(`${nombre} ${i.categoria || ""}`) });
  });
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false) return;
    const nombre = g.c || g.n || g.nombre || cat, item = { key: claveGasto(cat, items, idx), nombre, cat, mensual: montoPromedioMensual(g), moneda: g.moneda };
    if (g.activoId === activoId) out.auto.gastos.push(item);
    else out.gastos.push({ ...item, sugerido: suelto(g) && pega(nombre) });
  }));
  return out;
}
/** Claves de ingresos/gastos sin vínculo que se van con las ventas del escenario. */
export function vinculadosQueSeVan(user = {}, cfg = {}, vendidosIds) {
  const ids = vendidosIds || new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  const fuera = new Set();
  ids.forEach((id) => {
    const d = (cfg.decisiones || {})[id] || {};
    const sug = sugerirVinculados(user, id);
    const elegidos = Array.isArray(d.seVan) ? d.seVan : [...sug.ingresos, ...sug.gastos].filter((x) => x.sugerido).map((x) => x.key);
    elegidos.forEach((k) => fuera.add(k));
  });
  return fuera;
}

// ── Montos para el plan ────────────────────────────────────────────────────
// 24-oct-2026 (Santiago: "Rapicredit me da el 21 % de 3.288 M… veo que carga
// promedios de otro lado"). Ingresos y Egresos guardan la vigencia del AÑO EN
// CURSO (Rapicredit paga de julio a diciembre → desdeMes 7) y el promedio de
// este año la reparte en 12 meses: 57,5 M quedaban como 28,7 M y así seguían
// los 10 años. Para proyectar, un concepto mensual cuenta su monto completo y
// un pago anual ya hecho este año vuelve a contar; si algo se acaba, se apaga
// en «Ingresos / Gastos que se acaban».
const sinVigencia = (x) => {
  if (!x || typeof x !== "object") return x;
  const f = x.frecuencia || "mensual";
  const out = { ...x };
  if (f === "mensual" && (x.desdeMes || x.hastaMes)) { out._vigencia = { desde: Number(x.desdeMes) || 1, hasta: Number(x.hastaMes) || 12 }; out.desdeMes = 1; out.hastaMes = 12; }
  // Variable (un monto por mes): para proyectar se usa el promedio de los meses
  // que SÍ tienen monto, no el total del año entre 12 (si arrancó en julio,
  // repartirlo en 12 meses lo partía a la mitad).
  if (f === "variable" && Array.isArray(x.montosMensuales)) {
    const reales = x.montosMensuales.map((v) => Number(v) || 0).filter((v) => v > 0);
    // 26-oct-2026: la renta de una inversión que cambió de saldo durante el año (tramos en Patrimonio)
    // se proyecta con lo que paga HOY (último mes con monto), no con el promedio del año.
    if (reales.length && x.desdePatrimonio) { const ult = [...x.montosMensuales].reverse().map((v) => Number(v) || 0).find((v) => v > 0); out._vigencia = { variable: true, meses: reales.length, ultimo: true }; out.frecuencia = "mensual"; out.mensual = ult; out.desdeMes = 1; out.hastaMes = 12; delete out.montosMensuales; }
    else if (reales.length && reales.length < 12) { out._vigencia = { variable: true, meses: reales.length }; out.frecuencia = "mensual"; out.mensual = reales.reduce((s2, v) => s2 + v, 0) / reales.length; out.desdeMes = 1; out.hastaMes = 12; delete out.montosMensuales; }
  }
  if (x.pagos) delete out.pagos;
  return out;
};
export function paraPlan(user = {}) {
  if (user._paraPlan) return user;
  const g = user.gastos || user.gas;
  const gN = g ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, (v || []).map(sinVigencia)])) : g;
  return { ...user, _paraPlan: true, ingresos: (user.ingresos || []).map(sinVigencia), ...(user.gastos ? { gastos: gN } : {}), ...(user.gas ? { gas: gN } : {}) };
}

/** Cada inversión hoy: cuánto vale y cuánto renta, con de dónde sale. */
export function inversionesHoy(userIn = {}, cfgIn = {}) {
  const cfg = conVencimientos(migrarClaves(cfgIn, userIn), userIn);
  const user = ajustarGastos(ajustarIngresos(paraPlan(userIn), cfg), cfg);
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm, fx = (x) => (String(x?.moneda || x?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const nota = (x) => notaVigencia(x, MES, "Ingresos/Egresos", "Income/Expenses", false);
  return (user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
    const ingresos = (user.ingresos || []).filter((i) => i && i.sim !== false && i.activoId === a.id).map((i) => ({ nombre: i.nombre || i.categoria || tx("Ingreso", "Income"), mensual: montoPromedioMensual(i) * fx(i), nota: nota(i) }));
    const gastos = []; Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g) => { if (g && g.sim !== false && g.activoId === a.id) gastos.push({ nombre: g.c || g.n || g.nombre || cat, mensual: montoPromedioMensual(g) * fx(g), nota: nota(g) }); }));
    const valor = n(a.va) * fx(a), bruta = n(b.rentaPorActivo?.[a.id]), neta = n(b.rentaNetaPorActivo?.[a.id]);
    const corr = (cfg.rentaHoy || {})[a.id];
    const usada = corr != null && corr !== "" ? Math.max(0, n(corr)) : neta;
    const esc = resolverEscenario(cfg.escenario || "base", user);
    const def0 = crecimientoDefault(a, esc, supuestosF10(), usada * 12);
    const def = def0 != null && capitalPlano(a, claseActivo(a), usada * 12, leerTerminan(cfg)) ? 0 : def0;
    const ch = (cfg.crecHoy || {})[a.id];
    return { crecDefaultPct: def == null ? null : def * 100, crecPct: def == null ? null : (!vacio(ch) ? n(ch) : def * 100), crecCorregido: !vacio(ch), id: a.id, nombre: a.n || a.nombre || tx("Activo", "Asset"), clase: claseActivo(a), tipo: tipoActivo(a), valor, moneda: a.moneda, bruta, neta, manual: a.rentaOrigen === "manual", ingresos, gastos, corregida: corr != null && corr !== "", usada, pctAnual: valor > 0 ? usada * 12 / valor * 100 : 0, vende: (cfg.decisiones || {})[a.id]?.accion === "vende", cambio: leerCambios(cfg)[a.id] || null, termina: leerTerminan(cfg)[a.id] || null, capitalPlano: def0 != null && def === 0 && def0 !== 0 && vacio(ch), terminaDePatrimonio: !!(cfg.decisiones || {})[a.id]?.dePatrimonio, venceAnio: n(a.venceAnio) || null, venceMes: n(a.venceMes) || null, costoLigado: gastos.reduce((sm, g) => sm + g.mensual, 0) };
  // 23-nov-2026 (Santiago: "todo debería partir en orden de mayor valor a menor").
  }).sort((x, y) => y.valor - x.valor);
}

// 24-oct-2026 (Santiago: "el paso uno no solo debe editar patrimonio, también
// los ingresos como fees, rentas de otras inversiones"). En Hoy se corrige
// para el plan cuánto entra de cada ingreso (cfg.ingresoHoy: { "i:índice":
// pesos al mes }). Se reemplaza el monto y todo el motor lo usa.
function ajustarIngresos(user, cfg = {}) {
  const aj = cfg.ingresoHoy || {};
  if (!Object.keys(aj).length) return user;
  return { ...user, ingresos: (user.ingresos || []).map((i, k) => {
    const v = aj[claveIngreso(user.ingresos, k)]; if (v == null || v === "" || !i) return i;
    const { montosMensuales, capital, tasa, montoModo, ...resto } = i;
    return { ...resto, mensual: Math.max(0, n(v)), moneda: "COP", frecuencia: "mensual", _corregido: true };
  }) };
}
/** Ingresos de hoy que no están ligados a una inversión (fees, salarios, rentas sueltas). */
export function ingresosSueltosHoy(userIn = {}, cfgIn = {}) {
  const cfg = migrarClaves(cfgIn, userIn);
  const base = paraPlan(userIn), user = ajustarIngresos(base, cfg);
  const ids = new Set((user.inv || []).filter(Boolean).map((a) => a.id));
  const trm = n(user.trm) || 4200, fx = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trm : 1);
  const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  // 25-oct-2026: lo que se va con una venta o se acaba en este plan se marca
  // (y no suma) para que el total de Hoy cuadre con lo que de verdad sigue.
  const fuera = vinculadosQueSeVan(user, cfg);
  const term = conVencimientos(cfg, userIn).ingresosTerminan || {}, propio = cfg.ingresosTerminan || {};
  const vendidos = new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  return (user.ingresos || []).map((i, k) => {
    if (!i || i.sim === false || (i.activoId && ids.has(i.activoId))) return null;
    const o = base.ingresos[k];
    const enIngresos = montoPromedioMensual(o) * fx(o);
    const nota = notaVigencia(o, MES, "Ingresos", "Income", true);
    const key = claveIngreso(user.ingresos, k);
    const seVa = fuera.has(key) || (i.activoId && vendidos.has(i.activoId)) ? "venta" : term[key] ? "acaba" : null;
    return { key, seVa, acabaAnio: term[key] || null, finDeDatos: !!term[key] && propio[key] == null, finAnio: n(i.finAnio) || null, nombre: i.nombre || i.categoria || tx("Ingreso", "Income"), renta: tipoIngreso(i) === "pasivo", enIngresos, mensual: montoPromedioMensual(i) * fx(i), corregido: !!i._corregido, nota };
  }).filter(Boolean);
}

// Impuesto sobre la ganancia de un negocio que se repite (Colombia, 2026).
// Sugerencias editables, no asesoría tributaria:
//  · Persona natural, bien poseído menos de 2 años → renta ordinaria, cédula
//    general, tarifa marginal hasta 39 % (Art. 241 ET; con ingresos altos se
//    llega a la última franja).
//  · Sociedad (SAS) → tarifa general de renta 35 % (Art. 240 ET).
//  · Bien poseído 2 años o más → ganancia ocasional 15 % (Arts. 313-316 ET).
export const TARIFA_CICLO = {
  natural: { pct: 39, nombre: "Persona natural · menos de 2 años (renta)", nombreEn: "Individual · under 2 years (income tax)", nota: "Tarifa marginal de renta: hasta 39 %. Si tus ingresos son menores puede ser 33–37 %.", notaEn: "Marginal income tax rate: up to 39%. With lower income it can be 33–37%." },
  sociedad: { pct: 35, nombre: "Sociedad (SAS) · renta", nombreEn: "Company (SAS) · income tax", nota: "Tarifa general de renta de sociedades: 35 %.", notaEn: "General corporate income tax rate: 35%." },
  ocasional: { pct: 15, nombre: "Ganancia ocasional · 2 años o más", nombreEn: "Occasional gain · 2 years or more", nota: "Si el bien se tuvo 2 años o más: ganancia ocasional al 15 %.", notaEn: "If the asset was held 2 years or more: occasional gain at 15%." },
  otro: { pct: 0, nombre: "Otro / ya lo incluí", nombreEn: "Other / already included", nota: "Pon el % que te indique tu contador.", notaEn: "Enter the rate your accountant gives you." },
};
// 3-nov-2026 — EE. UU. (año fiscal vigente). Mismas llaves que Colombia para no
// romper escenarios guardados: natural = corto plazo, ocasional = largo plazo.
//  · Menos de 1 año → ganancia de corto plazo, tributa como ingreso ordinario
//    (24 % es el tramo típico de quien hace estos negocios; editable).
//  · 1 año o más → largo plazo, 15 % para la mayoría (0 % o 20 % según ingreso).
//  · Empresa (C-corp) → 21 % federal.
export const TARIFA_CICLO_US = {
  natural: { pct: 24, nombre: "Corto plazo · menos de 1 año (ingreso ordinario)", nombreEn: "Short-term · under 1 year (ordinary income)", nota: "Tributa con tu tramo federal; 24 % es el típico. Súmale el impuesto de tu estado si aplica.", notaEn: "Taxed at your federal bracket; 24% is typical. Add your state tax if any." },
  sociedad: { pct: 21, nombre: "Empresa (C-corp) · 21 % federal", nombreEn: "Company (C-corp) · 21% federal", nota: "Tarifa federal de sociedades: 21 %, más el impuesto estatal.", notaEn: "Federal corporate rate: 21%, plus state tax." },
  ocasional: { pct: 15, nombre: "Largo plazo · 1 año o más", nombreEn: "Long-term · 1 year or more", nota: "Ganancia de largo plazo: 15 % para la mayoría; 0 % o 20 % según tu ingreso.", notaEn: "Long-term capital gain: 15% for most people; 0% or 20% depending on income." },
  otro: { pct: 0, nombre: "Otro / ya lo incluí", nombreEn: "Other / already included", nota: "Pon el % que te indique tu CPA.", notaEn: "Enter the rate your CPA gives you." },
};
/** Tabla de impuestos del negocio que se repite, según el país de la sesión. */
export const tarifaCiclo = () => (esUS() ? TARIFA_CICLO_US : TARIFA_CICLO);
export const regimenSugerido = (meses) => (Number(meses) >= (esUS() ? 12 : 24) ? "ocasional" : "natural");
/** Negocios que se repiten: [{nombre, capital, valorFinal, meses, desde, hasta?, costosPct?, fuente, destino}] */
// ── Propiedad raíz con modalidades ─────────────────────────────────────────
// 23-nov-2026 (Santiago: "la inversión «negocios que se repiten» es extraña, no
// creo que la gente la entienda… en el capítulo de propiedad raíz poder decir si
// se hace una sola vez o se repite: compra en planos, lote y construcción,
// proyecto asociativo, construir locales o bodegas"). La repetición deja de ser
// un tipo de inversión y pasa a ser una opción de cada una. Una inversión nueva
// de tipo «Propiedad raíz» con `pr` se traduce a las piezas que el motor ya
// tiene: si se vende, a un ciclo (leerCiclos: capital → valor final, se repite
// o no); si te quedas con ella, a un activo con pagos, salto de valor a la
// entrega y valorización anual (como «Lo que viene»).
//   pr = { tipo: "planos"|"lote"|"asociativo"|"rentar", valor, cuotaPct, lote, m2,
//          costoM2, ventaM2, plazo (años hasta la entrega), meses (asociativo),
//          valEntregaPct, valAnualPct, valorFinal?, rentaMensual, final: "queda"|"vende",
//          vendeEn (años después de la entrega), repite, hasta?, destino, destinoId?,
//          costosPct, regimen?, impuestoPct? }
export const TIPOS_PR = ["planos", "lote", "asociativo", "rentar"];
export function leerPropiedadRaiz(x = {}, N = 10) {
  const pr = x.pr || {};
  const tipo = TIPOS_PR.includes(pr.tipo) ? pr.tipo : "planos";
  const anio = Math.min(N, Math.max(1, Math.round(n(x.anio)) || 1));
  const valE = n(pr.valEntregaPct) / 100, valA = n(pr.valAnualPct) / 100;
  const plazo = Math.max(0, Math.round(n(pr.plazo)));
  const final = tipo === "asociativo" ? "vende" : pr.final === "vende" ? "vende" : pr.final === "queda" ? "queda" : (tipo === "rentar" ? "queda" : "vende");
  const k = Math.max(0, Math.round(n(pr.vendeEn)));
  const renta = Math.max(0, n(pr.rentaMensual));
  const P = Math.max(0, n(pr.valor));
  const m2 = Math.max(0, n(pr.m2));
  const obra = Math.max(0, n(pr.lote)) + m2 * Math.max(0, n(pr.costoM2));
  const nombre = String(x.nombre || "").trim() || tx({ planos: "Compra en planos", lote: "Lote y construcción", asociativo: "Proyecto asociativo", rentar: "Construcción para rentar" }[tipo], { planos: "Off-plan purchase", lote: "Lot and build", asociativo: "Joint development", rentar: "Build to rent" }[tipo]);
  // 23-nov-2026 (Santiago: "poder poner valor de venta total de la propiedad, o por
  // metro cuadrado, o porcentaje de margen"). Cómo se pone el precio de venta:
  // "total" (ventaTotal), "m2" (m² × ventaM2) o "pct" (margen o valorización sobre
  // lo que cuesta). Sin elegir, se deduce de lo que ya estaba escrito.
  const modoVenta = ["total", "m2", "pct"].includes(pr.ventaModo) ? pr.ventaModo
    : tipo === "asociativo" ? (n(pr.valorFinal) > 0 ? "total" : "pct")
      : (tipo === "lote" || tipo === "rentar") && n(pr.ventaM2) > 0 && m2 > 0 ? "m2" : "pct";
  const precio = (baseCosto) => {
    if (modoVenta === "total") return Math.max(0, n(pr.ventaTotal) || n(pr.valorFinal));
    if (modoVenta === "m2") return m2 * Math.max(0, n(pr.ventaM2));
    return baseCosto * (1 + valE);
  };
  let capital = 0, valorEntrega = 0, pagos = [], meses = 12;
  if (tipo === "planos") {
    const c = P * Math.min(100, Math.max(0, n(pr.cuotaPct))) / 100;
    valorEntrega = precio(P);
    if (final === "vende" && k === 0) { capital = c; } // cesión del contrato: solo pusiste la cuota inicial
    else capital = P;
    pagos = [{ monto: c, anio }, { monto: P - c, anio: Math.min(N, anio + plazo) }].filter((p) => p.monto > 0.5);
    meses = Math.max(1, (plazo + k) * 12);
  } else if (tipo === "asociativo") {
    capital = P;
    valorEntrega = precio(P);
    meses = Math.min(120, Math.max(1, Math.round(n(pr.meses)) || 12));
    pagos = [{ monto: P, anio }];
  } else {
    capital = obra > 0 ? obra : P;
    valorEntrega = precio(capital);
    pagos = [{ monto: capital, anio }];
    meses = Math.max(1, (plazo + k) * 12);
  }
  const base = { tipo, nombre, anio, capital, valorEntrega, final, plazo, vendeEn: k, renta, durAnios: Math.ceil(meses / 12), modoVenta, m2 };
  if (!(capital > 0)) return { ...base, vacio: true };
  if (final === "vende") {
    // Lo que te pagan al vender (en planos vendido a la entrega, la cesión del contrato: cuota + valorización).
    let ventaBruta = tipo === "planos" && k === 0 ? capital + (valorEntrega - P) : valorEntrega * Math.pow(1 + valA, tipo === "asociativo" ? 0 : k);
    if (tipo === "rentar" && renta > 0) ventaBruta += renta * 12 * k; // la renta de los años que la tienes
    const costosPct = vacio(pr.costosPct) ? (tipo === "asociativo" ? 0 : 3) : n(pr.costosPct);
    // Costos de venta (comisión, notaría, registro) sobre el precio de venta. Los
    // negocios que venían de «Negocios que se repiten» los tenían sobre la ganancia
    // (pr.costosSobre = "ganancia") y así se dejan para no cambiar su resultado.
    const sobreGanancia = pr.costosSobre === "ganancia";
    const costoVenta = sobreGanancia ? 0 : ventaBruta * costosPct / 100;
    const valorFinal = ventaBruta - costoVenta;
    const repite = !!pr.repite;
    const durAnios = Math.ceil(meses / 12);
    const hasta = repite ? (vacio(pr.hasta) ? N : Math.min(N, Math.max(anio, Math.round(n(pr.hasta))))) : Math.min(N, anio + durAnios - 1);
    const ciclo = { nombre, capital, valorFinal, meses, desde: anio, hasta, costosPct: sobreGanancia ? costosPct : 0, regimen: pr.regimen, impuestoPct: pr.impuestoPct, fuente: x.fuente || "venta", destino: pr.destino === "flujo" ? "flujo" : "reinvierte", destinoId: pr.destinoId || null };
    const c = leerCiclos([ciclo], N)[0];
    const veces = repite ? Math.max(1, Math.floor((hasta - anio + 1) / durAnios)) : 1;
    // 23-nov-2026 (Santiago: "a quien en estos negocios le quitan la retención: poder poner
    // el valor de la retención aprox., y si uno quiere cambiarlo, que lo pueda poner").
    // Retención en la fuente al vender: persona natural 1 % del valor de venta (art. 398 E.T.,
    // la practica el notario); editable. Es un anticipo del impuesto, no un costo adicional:
    // se descuenta del impuesto en la declaración (si es mayor, queda saldo a favor).
    const retencionPct = vacio(pr.retencionPct) ? 1 : Math.min(100, Math.max(0, n(pr.retencionPct)));
    const retencion = ventaBruta * retencionPct / 100;
    const impuestoCiclo = c ? c.impuestoCiclo : 0;
    return { ...base, ventaBruta, costoVenta, costosPct, valorFinal, repite, hasta, durAnios, veces, ciclo,
      gananciaAntes: valorFinal - capital, gananciaCiclo: c ? c.gananciaCiclo : 0, impuestoCiclo, impuestoPct: c ? c.impuestoPct : 0, regimen: c ? c.regimen : null,
      retencionPct, retencion, saldoDeclaracion: impuestoCiclo - retencion };
  }
  const entrega = Math.min(N, anio + plazo);
  return { ...base, entrega, pagos, crec: valA, valorAlTerminar: valorEntrega };
}

export function leerCiclos(lista = [], N = 10) {
  return (Array.isArray(lista) ? lista : []).map((x) => {
    const capital = Math.max(0, n(x.capital)), valorFinal = Math.max(0, n(x.valorFinal));
    const meses = Math.min(120, Math.max(1, Math.round(n(x.meses) || 12)));
    const desde = Math.min(N, Math.max(1, Math.round(n(x.desde) || 1)));
    const hasta = vacio(x.hasta) ? N : Math.min(N, Math.max(desde, Math.round(n(x.hasta))));
    const costosPct = Math.min(100, Math.max(0, n(x.costosPct)));
    // 25-oct-2026 (Santiago: "debe existir una franja para calcular el impuesto
    // de este tipo de negocios… que se sugiera pero se pueda editar").
    const TC = tarifaCiclo();
    const regimen = TC[x.regimen] ? x.regimen : regimenSugerido(meses);
    const impuestoPct = vacio(x.impuestoPct) ? TC[regimen].pct : Math.min(100, Math.max(0, n(x.impuestoPct)));
    // 23-nov-2026: si el valor final es menor que el capital, es una pérdida (sin
    // impuesto); antes se tomaba como ganancia cero y el capital volvía completo.
    const dif = valorFinal - capital;
    const bruta = dif >= 0 ? dif * (1 - costosPct / 100) : dif;
    const impuestoCiclo = Math.max(0, bruta) * impuestoPct / 100;
    const gananciaCiclo = bruta - impuestoCiclo;
    return { nombre: String(x.nombre || "").trim() || tx("Negocio que se repite", "Repeating deal"), capital, valorFinal, meses, desde, hasta, costosPct, regimen, impuestoPct, impuestoCiclo, impuestoAnual: impuestoCiclo * 12 / meses, fuente: x.fuente || "venta", destino: x.destino === "flujo" ? "flujo" : "reinvierte", destinoId: x.destinoId || null, gananciaCiclo, gananciaAnual: gananciaCiclo * 12 / meses };
  }).filter((x) => x.capital > 0 && x.valorFinal > 0);
}

// ── Claves estables de ingresos y gastos ───────────────────────────────────
// 25-oct-2026 (Santiago: "se desconfigura cuando uno va a revisar el plan,
// todos los datos los cambia… no guarda las configuraciones"). Los ingresos y
// gastos que se acaban, los montos corregidos y «lo que se va con la venta» se
// guardaban por POSICIÓN ("Vivienda::3", "i:5"). Al agregar o borrar algo en
// Ingresos/Egresos las posiciones se corren y el escenario apuntaba a otros
// conceptos (el arriendo marcado como que se acaba, etc.). Ahora la clave es el
// id del concepto, o su nombre (con #n si hay nombres repetidos).
const nomClave = (x) => String((x && (x.c || x.n || x.nombre || x.categoria)) || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
export function claveGasto(cat, items = [], idx) {
  const g = (items || [])[idx];
  if (g && g.id) return `${cat}::id:${g.id}`;
  const nom = nomClave(g);
  const rep = (items || []).slice(0, idx).filter((x) => !(x && x.id) && nomClave(x) === nom).length;
  return `${cat}::${nom}${rep ? "#" + rep : ""}`;
}
export function claveIngreso(list = [], k) {
  const i = (list || [])[k];
  if (i && i.id) return `i:id:${i.id}`;
  const nom = nomClave(i);
  const rep = (list || []).slice(0, k).filter((x) => !(x && x.id) && nomClave(x) === nom).length;
  return `i:${nom}${rep ? "#" + rep : ""}`;
}
/** Pasa las claves viejas por posición a claves estables (con los datos de hoy). */
export function migrarClaves(cfg = {}, user = {}) {
  if (!cfg || cfg._clavesV2) return cfg;
  const gas = user.gastos || user.gas || {};
  const ing = user.ingresos || [];
  const conv = (k) => {
    let m = /^i:(\d+)$/.exec(k);
    if (m) return ing[+m[1]] ? claveIngreso(ing, +m[1]) : k;
    m = /^(.*)::(\d+)$/.exec(k);
    if (m && gas[m[1]] && gas[m[1]][+m[2]]) return claveGasto(m[1], gas[m[1]], +m[2]);
    return k;
  };
  const mapa = (o) => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [conv(k), v])) : o);
  const dec = Object.fromEntries(Object.entries(cfg.decisiones || {}).map(([id, d]) => [id, d && Array.isArray(d.seVan) ? { ...d, seVan: d.seVan.map(conv) } : d]));
  return { ...cfg, _clavesV2: true, decisiones: dec, gastosTerminan: mapa(cfg.gastosTerminan), ingresosTerminan: mapa(cfg.ingresosTerminan), ingresoHoy: mapa(cfg.ingresoHoy), gastoHoy: mapa(cfg.gastoHoy) };
}

// 25-oct-2026 (Santiago: "año 5 en 4 años… qué enredo"). Los años del plan se
// muestran como años de calendario: año 1 = este año.
export const anioCal = (t) => new Date().getFullYear() + Math.round(Number(t) || 1) - 1;

// 25-oct-2026 (Santiago: "¿cómo puede uno también editar los gastos si algún
// valor cambia?"). En «Lo que tienes» se corrige para el plan cuánto sale de
// cada gasto (cfg.gastoHoy: { clave: pesos al mes }). Egresos no se toca.
function ajustarGastos(user, cfg = {}) {
  const aj = cfg.gastoHoy || {};
  if (!Object.keys(aj).length) return user;
  const g = user.gastos || user.gas || {};
  const nuevo = Object.fromEntries(Object.entries(g).map(([cat, items]) => [cat, (items || []).map((x, idx) => {
    const v = aj[claveGasto(cat, items, idx)]; if (v == null || v === "" || !x) return x;
    const { montosMensuales, ...resto } = x;
    return { ...resto, m: Math.max(0, n(v)), mensual: Math.max(0, n(v)), moneda: "COP", frecuencia: "mensual", _corregido: true };
  })]));
  return { ...user, ...(user.gastos ? { gastos: nuevo } : {}), ...(user.gas ? { gas: nuevo } : {}) };
}
/** Tus gastos de hoy para «Lo que tienes»: monto, si se corrigió y si se acaba. */
export function gastosLista(userIn = {}, cfgIn = {}) {
  const cfg = migrarClaves(cfgIn, userIn);
  const base = paraPlan(userIn), user = ajustarGastos(base, cfg);
  const trm = n(user.trm) || 4200, fx = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trm : 1);
  const term = conVencimientos(cfg, userIn).gastosTerminan || {}, propioG = cfg.gastosTerminan || {}, fuera = vinculadosQueSeVan(user, cfg);
  const vendidos = new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  const nomAct = (id) => { const a = (user.inv || []).find((x) => x && x.id === id); return a ? a.n || a.nombre : null; };
  const out = [];
  const gB = base.gastos || base.gas || {};
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false) return;
    const key = claveGasto(cat, items, idx), o = (gB[cat] || [])[idx] || g;
    const enEgresos = montoPromedioMensual(o) * fx(o), mensual = montoPromedioMensual(g) * fx(g);
    if (!(enEgresos > 0.5) && !g._corregido) return;
    const seVa = fuera.has(key) || (g.activoId && vendidos.has(g.activoId)) ? "venta" : term[key] ? "acaba" : null;
    out.push({ key, cat, nombre: g.c || g.n || g.nombre || cat, enEgresos, mensual, corregido: !!g._corregido, seVa, acabaAnio: term[key] || null, finDeDatos: !!term[key] && propioG[key] == null, finAnio: n(g.finAnio) || null, deActivo: g.activoId ? nomAct(g.activoId) : null });
  }));
  return out.sort((a, b) => b.mensual - a.mensual);
}

// ═══════════════════════════════════════════════════════════════════════════
// 24-nov-2026 — La cascada de cada año (Santiago: "estoy en 2026: veo una foto de lo
// que me vale vivir al mes y al año, lo que me ingresa y lo que me sobra, más lo que
// me entra por ventas; eso me da un valor, 600 MM, para invertir o dejar de reserva…
// y después de mis movidas ver cómo me queda el año, y si sobra, qué hacer"; "el
// sistema dice que sobran 100 MM, los usa uno y después dice que eran 70").
// Cada año, en este orden y con la misma regla para todos (también hoy):
//   1. Lo que tienes: el saldo que traes + lo que te llega (ventas, vencimientos, retiros).
//   2. Lo que te cuesta vivir: la FOTO del año antes de tus movidas de ese año (lo
//      decidido en el paso 1, lo que viene y lo que invertiste en años anteriores).
//      Por eso lo que puedes usar no se mueve cuando inviertes ese mismo año.
//   3. Lo que puedes hacer con tu plata = lo que tienes ± lo que sobra o falta para vivir
//      − lo ya comprometido (pagos de compras, cuotas de lo comprado antes, deudas con
//      fecha). Si no alcanza para vivir, sale de tu fondo de reserva; si tampoco, lo dice.
//      Tus movidas (inversiones, aportes, deudas que decides pagar) restan de ahí.
//   4. Así te queda: lo que no usaste + lo que tus movidas te alcanzan a pagar ese año
//      (rentas nuevas, cuotas que dejas de pagar). Eso lo mandas a tu fondo de reserva
//      (rinde como renta fija corta) o pasa disponible al año siguiente.
// Es una cuenta de caja, conservadora: lo que rinden la plata disponible y las canastas
// no se suma. El motor guarda esa plata en el colchón y las canastas.
// ═══════════════════════════════════════════════════════════════════════════

/** Lo que cada año mandas a tu fondo de reserva: { año del plan: pesos de ese año }. */
export function leerReservaAnual(v = {}, N = 10) {
  const out = {};
  Object.entries(v && typeof v === "object" ? v : {}).forEach(([k, x]) => { const t = Math.round(n(k)), m = n(x); if (t >= 1 && t <= N && m > 0) out[t] = m; });
  return out;
}

/**
 * El plan sin tus movidas de un año en adelante: lo que inviertes, le metes o decides
 * pagar desde el año t queda en cero. Lo del paso 1, lo que viene y lo de años
 * anteriores sigue igual. Con esto sale la foto del año t (antes de tus movidas).
 */
export function sinMovidasDesde(cfg = {}, t = 1, N = 10) {
  const anioX = (x) => Math.min(N, Math.max(1, Math.round(n(x && x.anio)) || 1));
  const out = { ...cfg };
  out.nuevas = (cfg.nuevas || []).map((x) => (x && anioX(x) >= t ? { preset: "_fuera" } : x));
  // El aporte sale; lo que dice cómo rinde el activo (rendimiento, cuánto te llega) se queda.
  out.reinversiones = (cfg.reinversiones || []).map((x) => (x && anioX(x) >= t && n(x.monto) > 0 ? { ...x, monto: 0, rentaMensual: "", valorAlTerminar: "" } : x));
  const pd = { ...(cfg.pagarDeudas || {}) };
  Object.keys(pd).forEach((id) => { const y = anioPagoDeuda({ id }, pd, N); if (y != null && y >= t) pd[id] = false; });
  out.pagarDeudas = pd;
  if (Array.isArray(cfg.ciclos)) out.ciclos = cfg.ciclos.map((c) => (c && Math.max(1, Math.round(n(c.desde)) || 1) >= t ? { ...c, capital: 0 } : c));
  return out;
}
const hayMovidasDesde = (cfg = {}, t = 1, N = 10) => JSON.stringify(sinMovidasDesde(cfg, t, N)) !== JSON.stringify({ ...cfg, nuevas: cfg.nuevas || [], reinversiones: cfg.reinversiones || [], pagarDeudas: { ...(cfg.pagarDeudas || {}) }, ...(Array.isArray(cfg.ciclos) ? { ciclos: cfg.ciclos } : {}) });

/**
 * La foto de cada año antes de tus movidas de ese año: [null, fila 1, …, fila N]. Cada
 * fila es la del motor (ingresos, gastos, cf, cuota, gastos futuros…). Solo se vuelve a
 * proyectar para los años desde los que hay movidas; los demás usan `r`.
 */
export function fotosPorAnio(user = {}, cfg = {}, r = null) {
  const base = r || proyectarFuturo10(user, cfg);
  const N = Math.max(1, (base.filas || []).length - 1);
  const out = [null];
  const memo = new Map();
  for (let t = 1; t <= N; t++) {
    if (!hayMovidasDesde(cfg, t, N)) { out.push((base.filas || [])[t] || null); continue; }
    const c = sinMovidasDesde(cfg, t, N), k = JSON.stringify(c);
    if (!memo.has(k)) memo.set(k, proyectarFuturo10(user, c));
    out.push((memo.get(k).filas || [])[t] || null);
  }
  return out;
}

/**
 * La cuenta de cada año, de hoy (1) al último. La usan el paso 3 (Tu plata año por
 * año), el Resultado (capítulo 2) y la tabla de la plata que mueves, para que todos
 * hablen igual. `fotos` (fotosPorAnio) hace que lo que puedes usar no cambie con las
 * movidas del año; sin fotos se usa el flujo del año tal como queda.
 */
export function cuentaPorAnio(r, cfg = {}, fotos = null) {
  const bd = r.bolsaDetalle || {};
  const filas = r.filas || [];
  const N = Math.max(1, filas.length - 1);
  // Sin cfg (el Resultado solo tiene r), la parte libre de lo que sobra la trae el motor.
  const asignado = (Array.isArray(cfg && cfg.sobraDestinos) ? cfg.sobraDestinos : []).reduce((sm, d) => sm + Math.max(0, Number(d && d.pct) || 0), 0);
  const libre = Array.isArray(cfg && cfg.sobraDestinos) ? Math.max(0, 1 - Math.min(100, asignado) / 100) : (r.sobraLibre ?? 1);
  const deLibre = (cf) => (cf > 0 ? cf * libre : cf);
  const rva = cfg && cfg.reservaAnual ? leerReservaAnual(cfg.reservaAnual, N) : (r.reservaAnual || {});
  const tasa = Math.max(0, n(r.tasaReserva));
  const suma = (l) => l.reduce((sm, x) => sm + (n(x.monto) || 0), 0);
  // 24-nov-2026 (indexación): lo que anotas para un año siguiente va en pesos de hoy y se paga en pesos
  // de ese año (montoAnio). La cuenta va en pesos de cada año, como el flujo.
  const enAnio = (u) => n(u.montoAnio ?? u.monto);
  const inf = n((r.escenario || {}).inflacionPct) / 100;
  const usos = (bd.usos || []).filter((u) => n(u.monto) > 0.5);
  const nomActivo = (id) => ((r.vendidos || []).find((v) => v.id === id) || (r.activos || []).find((a) => a.id === id) || {}).nombre || tx("su activo", "its asset");
  const mesesColchon = n((supuestosF10() || {}).colchonMeses) || 6;
  let antes = 0, reserva = 0;
  const out = [];
  for (let anio = 1; anio <= N; anio++) {
    const f = filas[anio] || {};
    const foto = (fotos && fotos[anio]) || f;
    const flujo = deLibre(n(f.cf)), flujoFoto = deLibre(n(foto.cf));
    // 1. Lo que tienes
    const llegan = anio === 1
      ? (bd.vendido > 0.5 ? [{ id: "ventas", nombre: tx(`Lo que vendes${(r.vendidos || []).length ? `: ${(r.vendidos || []).map((v) => v.nombre).join(", ")}` : ""}`, `What you sell${(r.vendidos || []).length ? `: ${(r.vendidos || []).map((v) => v.nombre).join(", ")}` : ""}`), monto: bd.vendido, tipo: "venta" }] : [])
      : (r.liberados || []).filter((l) => l.anio === anio && n(l.monto) > 0.5).map((l) => ({ ...l, tipo: String(l.id).endsWith("_retiro") ? "retiro" : "vence" }));
    const llega = suma(llegan);
    // Ya comprometido: no lo decides este año, ya viene decidido.
    const compromisos = [];
    if (anio === 1) {
      (r.deudas || []).filter((d) => d.porVenta && d.pagado > 0.5).forEach((d) => compromisos.push({ nombre: tx(`${d.nombre}: se paga con la venta de ${nomActivo(d.activoId)}`, `${d.nombre}: paid with the sale of ${nomActivo(d.activoId)}`), monto: d.pagado, tipo: "A" }));
      if (bd.colchon > 0.5) compromisos.push({ nombre: tx(`Colchón de ${mesesColchon} meses de gastos (queda en tu liquidez)`, `${mesesColchon}-month expense cushion (stays in your cash)`), monto: bd.colchon, tipo: "colchon" });
    }
    // 24-nov-2026 (Santiago: "este año dispone de esto después de gastos y ventas, pero debe pagar el
    // local, debe pagar la universidad, y lo que sobra se invierte"). Pagar una deuda ese año es un
    // compromiso de ese año (lo decidas en el plan o venga con fecha de la página Deudas).
    if (anio === 1) (r.deudas || []).filter((d) => !d.porVenta && d.pagado > 0.5).forEach((d) => compromisos.push({ nombre: tx(`Pagas ${d.nombre}`, `Pay off ${d.nombre}`), monto: d.pagado, tipo: "A", nota: d.pagado < d.saldo - 0.5 ? tx("Abono: no alcanza para pagarla toda.", "Partial payment: not enough to pay it all.") : null }));
    (r.deudas || []).filter((d) => d.pagaAnio === anio && n(d.pagoEnAnio) > 0.5).forEach((d) => compromisos.push({ nombre: d.pagaEnPlan ? tx(`Pagas ${d.nombre}`, `Pay off ${d.nombre}`) : tx(`${d.nombre}: se paga este año`, `${d.nombre}: due this year`), monto: d.pagoEnAnio, tipo: "A" }));
    usos.filter((u) => (u.anio || 1) === anio && u.prDesde != null && u.prDesde < anio).forEach((u) => compromisos.push({ nombre: tx(`Cuota de ${u.nombre} (compra de ${anioCal(u.prDesde)})`, `${u.nombre} installment (bought in ${anioCal(u.prDesde)})`), monto: enAnio(u), montoHoy: n(u.monto), tipo: "C" }));
    (r.pagosFuturos || []).filter((p) => p.anio === anio && enAnio(p) - (p.deFuentes || 0) > 0.5).forEach((p) => compromisos.push({ nombre: tx(`Pago de ${p.nombre}`, `Payment for ${p.nombre}`), monto: enAnio(p) - (p.deFuentes || 0), montoHoy: n(p.monto), tipo: "F", idx: p.idx, k: p.k, nota: p.deFuentes > 0.5 ? tx(`El resto sale de ${p.fuentesTxt}.`, `The rest comes from ${p.fuentesTxt}.`) : null }));
    const comprometido = suma(compromisos);
    // Tus movidas del año. «Plata nueva de afuera» (y hoy, «de mis cuentas») no sale de esta cuenta.
    const movidas = [];
    usos.filter((u) => (anio === 1 ? (u.anio || 1) === 1 || u.apartado : u.anio === anio && !u.apartado) && !(u.prDesde != null && u.prDesde < (u.anio || 1)))
      .forEach((u) => { const fte = u.fuente || "venta"; movidas.push({ nombre: u.nombre, monto: enAnio(u), montoHoy: n(u.monto), tipo: u.seccion === "B" ? "B" : "C", fuente: fte, cuenta: anio === 1 ? fte === "venta" : fte !== "nuevo" }); });
    if (anio === 1 && bd.obrasPedido > 0.5) movidas.push({ nombre: tx("Obras en lo que ya tienes", "Build-outs on what you own"), monto: bd.obrasPedido, tipo: "B", cuenta: true });
    const movido = suma(movidas.filter((m) => m.cuenta));
    // La cuenta
    const tienes = antes + llega;
    const base = tienes + flujoFoto - comprometido;
    const reservaAntes = anio === 1 ? 0 : reserva * (1 + tasa);
    const usoReserva = base < 0 ? Math.min(reservaAntes, -base) : 0;
    const faltaSinCubrir = base < 0 ? -base - usoReserva : 0;
    const disponible = Math.max(0, base);
    const porInvertir = disponible - movido;
    const efecto = flujo - flujoFoto;
    const queda = base + usoReserva - movido + efecto;
    const aReserva = Math.min(n(rva[anio]), Math.max(0, queda));
    const pasa = Math.max(0, queda) - aReserva;
    const reservaFin = reservaAntes - usoReserva + aReserva;
    const salen = [...compromisos, ...movidas.filter((m) => m.cuenta)].map((x) => ({ nombre: x.nombre, monto: x.monto, montoHoy: x.montoHoy ?? x.monto, tipo: x.tipo === "colchon" ? "F" : x.tipo }));
    // factorHoy: para pasar a pesos de hoy lo que se escribe en un formulario (montos de años siguientes).
    out.push({ anio, antes, llegan, llega, tienes, foto, flujoFoto, flujo, efecto, compromisos, comprometido, base, usoReserva, faltaSinCubrir, disponible, movidas, movido, porInvertir, queda, aReserva, pasa, reservaAntes, reservaFin, tasaReserva: tasa, factorHoy: Math.pow(1 + inf, Math.max(0, anio - 1)),
      // Para lo que leía la cuenta de antes (informe): lo que sale del año y lo que queda.
      salen, sale: suma(salen), saldo: queda, flujoHoy: 0, cfPrev: n(f.cf) });
    antes = pasa; reserva = reservaFin;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 23-nov-2026 — Barra de resultado en vivo y tarjeta del escenario.
// (Finanzas · Tributario · QA). Reglas:
//  · Las cifras a 10 años van en patrimonio neto en pesos de hoy, con la
//    inflación del escenario (la misma del interruptor «pesos de hoy» y de las
//    gráficas del informe: f.deflactor), y se rotulan con esa tasa. Finanzas,
//    23-nov-2026: una sola tasa define «pesos de hoy» en toda la app; subir el
//    valor por defecto a 5 % queda para el PR de indexación.
//  · El rendimiento se aplica solo sobre los activos. El ahorro del año entra
//    como aporte y nunca cuenta como rendimiento: el «crece al año» de antes
//    salía de comparar el patrimonio final con el de hoy y metía el ahorro de
//    10 años como si fuera rentabilidad (8,2 M → 1.115 M = 63,5 % al año).
//  · Vender un activo no baja el patrimonio del año 0 (solo pasa a efectivo).
//  · Si hay un activo vendido, el resultado va «antes de impuestos de la venta».
// ═══════════════════════════════════════════════════════════════════════════
// Respaldo si el resultado no trae escenario: la MISMA constante con la que el
// motor proyecta (INFLACION_DEFAULT_PCT), para no volver a ver 4 % contra 5 %.
export const INFLACION_PESOS_HOY_PCT = INFLACION_DEFAULT_PCT;

/** Inflación (%) con la que el escenario pasa a pesos de hoy (cada escenario con la suya). */
export const inflacionDe = (r) => {
  const v = r && r.escenario ? r.escenario.inflacionPct : null;
  return v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : INFLACION_PESOS_HOY_PCT;
};

/** Lleva una cifra nominal del año `anio` a pesos de hoy con la inflación dada. */
export const aPesosDeHoy = (nominal, anio, inflacionPct = INFLACION_PESOS_HOY_PCT) => n(nominal) / Math.pow(1 + n(inflacionPct) / 100, Math.max(0, n(anio)));

/** Patrimonio neto del último año del plan en pesos de hoy, con la inflación del escenario. La misma cifra en la barra, la tarjeta, el comparador, el veredicto y el último punto de la gráfica en pesos de hoy. */
export function patrimonioFinalHoy(r, inflacionPct = inflacionDe(r)) {
  const f = (r && r.filas) || [];
  if (!f.length) return 0;
  const fin = f[f.length - 1];
  return aPesosDeHoy(fin.patrimonio, fin.anio, inflacionPct);
}

/** ¿El escenario vende al menos un activo? */
export const hayVenta = (r) => !!(r && Array.isArray(r.vendidos) && r.vendidos.length > 0);
export const rotuloVenta = () => tx("antes de impuestos de la venta", "before taxes on the sale");

/** Misma regla del paso 4 («Alertas de liquidez»): hay alerta si el motor dejó alguna. */
export const hayAlertaLiquidez = (r) => !!(r && Array.isArray(r.alertas) && r.alertas.length > 0);

/**
 * Rendimiento anual de los activos, sin contar el ahorro. Cada año:
 * lo que producen los activos (rentas + valorización; no una pensión u otro
 * ingreso de «Lo que viene» sin activo) ÷ los activos con que
 * arrancó el año. Se encadena (tasa ponderada en el tiempo) y se pasa a real
 * con la inflación dada. Devuelve null si no hay activos.
 */
export function rendimientoSinAhorro(r, inflacionPct = inflacionDe(r)) {
  const f = (r && r.filas) || [];
  if (f.length < 2) return null;
  let factor = 1, anios = 0;
  for (let t = 1; t < f.length; t++) {
    const base = n(f[t - 1].activos);
    if (base <= 0) continue;
    factor *= Math.max(0, 1 + (n(f[t].produce) - n(f[t].ingFuturoSinActivo)) / base);
    anios++;
  }
  if (!anios) return null;
  const nominalPct = (Math.pow(factor, 1 / anios) - 1) * 100;
  const realPct = ((1 + nominalPct / 100) / (1 + n(inflacionPct) / 100) - 1) * 100;
  return { nominalPct, realPct, anios };
}

/**
 * De dónde sale el patrimonio final, en pesos de hoy:
 *   hoy + ahorro + rendimiento real = final
 * ahorro = lo que entra al patrimonio sin ser rendimiento de un activo
 * (sueldo menos gastos, cuotas, gastos y compras de «Lo que viene»).
 * rendimiento real = lo que producen los activos menos lo que la inflación
 * le quita al patrimonio de cada año.
 */
export function desglosePatrimonio(r, inflacionPct = inflacionDe(r)) {
  const f = (r && r.filas) || [];
  if (!f.length) return null;
  const d = (t) => Math.pow(1 + n(inflacionPct) / 100, t);
  let ahorro = 0, rendimiento = 0, inflacion = 0;
  for (let t = 1; t < f.length; t++) {
    const prev = n(f[t - 1].patrimonio), cur = n(f[t].patrimonio), prod = n(f[t].produce) - n(f[t].ingFuturoSinActivo);
    rendimiento += prod / d(t);
    ahorro += (cur - prev - prod) / d(t);
    inflacion += prev * (1 / d(t - 1) - 1 / d(t));
  }
  const fin = f[f.length - 1];
  return {
    hoy: n(f[0].patrimonio),
    despuesDelPlan: f[1] ? n(f[1].patrimonio) / d(1) : n(f[0].patrimonio),
    fin: patrimonioFinalHoy(r, inflacionPct),
    anioFin: n(fin.anio),
    ahorro, rendimiento, inflacion, rendimientoReal: rendimiento - inflacion,
    inflacionPct: n(inflacionPct),
  };
}

/**
 * Lo que muestra la barra de resultado en vivo (pasos 1 a 3).
 * rPlan = el escenario que se está armando; rHoy = «Si me quedo como estoy».
 */
export function resumenBarra(rPlan, rHoy, inflacionPct = inflacionDe(rPlan)) {
  const dp = desglosePatrimonio(rPlan, inflacionPct);
  if (!dp) return null;
  const dh = rHoy ? desglosePatrimonio(rHoy, inflacionPct) : null;
  return {
    anioFin: dp.anioFin,
    anioCalFin: anioCal(dp.anioFin),
    hoy: dp.hoy,
    plan: dp.fin,
    quedarme: dh ? dh.fin : null,
    diferencia: dh ? dp.fin - dh.fin : null,
    conVenta: hayVenta(rPlan),
    alertaLiquidez: hayAlertaLiquidez(rPlan),
    inflacionPct: n(inflacionPct),
  };
}

/**
 * «Lo que viene» del escenario, para su tarjeta: cada compra, gasto o ingreso
 * futuro con su año. El motor ya resta el costo en el año en que cae.
 * tipo: "compra" (monto = pago de ese año) · "gasto" (monto = al año, pesos de hoy) · "ingreso" (monto = al mes)
 */
export function loQueVieneDelPlan(r) {
  const fut = (r && r.futuros) || {};
  const N = Math.max(1, ((r && r.filas) || []).length - 1) || 10;
  const out = [];
  (fut.activos || []).forEach((a) => {
    const pagos = (a.pagos || []).filter((p) => n(p.monto) > 0);
    const total = pagos.reduce((s, p) => s + n(p.monto), 0);
    const anio = pagos.length ? Math.min(...pagos.map((p) => p.anio)) : n(a.entrega);
    // Supuestos visibles (Finanzas): el motor no suma gastos de compra (escritura,
    // registro, impuestos) ni modela un crédito: la compra se paga de contado.
    // Valorización por defecto: finca raíz (presets.fincaRaiz.valorizacionSpread = 0) u
    // otros (otrosRealSpread = 0) → sube con la inflación del escenario, 0 % real.
    out.push({ nombre: a.nombre, tipo: "compra", vivienda: !!a.vivienda, anio, anioFin: n(a.entrega) || anio, monto: total, sinGastosCompra: true, deContado: true, valorizacionPct: a.crec == null ? null : a.crec * 100, valorizacionDefault: a.valorizacionDefault !== false });
  });
  (fut.gastos || []).forEach((g) => out.push({ nombre: g.nombre, tipo: "gasto", anio: g.desde, anioFin: Math.min(N, g.hasta), monto: n(g.anual) }));
  (fut.ingresos || []).forEach((i) => out.push({ nombre: i.nombre, tipo: "ingreso", anio: i.desde, anioFin: Math.min(N, i.hasta), monto: n(i.mensual) }));
  return out.sort((a, b) => a.anio - b.anio);
}
