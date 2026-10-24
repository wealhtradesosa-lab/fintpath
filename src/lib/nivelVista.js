// 24-oct-2026 — Textos de la tarjeta «Tu Nivel de Libertad Financiera».
// Luis veía la barra llena con «136%», el texto «la barra topa en 100% — vas en
// 136%», el badge en Abundancia y abajo un cuadro que decía «¡Independencia!».
// Todo sale ahora de UN solo nivel (metrics.js → nivelLibertad) y de los mismos
// umbrales en plata (umbralNivel). Este módulo solo arma las frases.
import { NIVELES, umbralNivel, fmtPctEs, calcularMetricas } from "./metrics.js";
import { montoPromedioMensual, totalAnualItem, getFrecuencia, estaPagadoEnAño, getMesActual, MESES } from "./flowHelpers.js";

/**
 * @param {{ip:number, ob:number, nivel:object|null}} p  nivel = salida de nivelLibertad
 * @returns {null | { nombre, n, pct, sobraPct, titular, desborde, siguiente, faltaSiguiente }}
 */
export function vistaNivel({ ip = 0, ob = 0, nivel = null } = {}) {
  if (!(ob > 0) || !nivel?.nivel) return null;
  const n = nivel.nivel;
  const nombre = NIVELES[n - 1].nombre;
  const pct = pctPiso(ip, ob);
  const sobraPct = pct > 100 ? pct - 100 : 0;
  const titular = `Estás en ${nombre} (nivel ${n}/5). Tu ingreso pasivo cubre el ${fmtPctEs(pct, 0)} de tus gastos y cuotas`
    + (sobraPct > 0 ? `: te sobra un ${fmtPctEs(sobraPct, 0)} cada mes.` : ".");
  const desborde = sobraPct > 0 ? `+${fmtPctEs(sobraPct, 0)} por encima` : null;
  const sig = n < 5 ? NIVELES[n] : null;
  const ctx = { ob, obEsencial: nivel.obEsencial || ob };
  const meta = sig ? umbralNivel(sig, ctx) : null;
  return {
    nombre, n, pct, sobraPct, titular, desborde,
    siguiente: sig ? sig.nombre : null,
    faltaSiguiente: meta != null ? Math.max(0, meta - ip) : null,
  };
}

/**
 * % entero que se muestra, redondeado HACIA ABAJO: 129,99% → 129%, nunca 130%
 * (si no, el titular diría «130%» con el nivel aún en Independencia). El
 * epsilon evita que 1,3 × ob en coma flotante (129,9999…) caiga a 129.
 */
export function pctPiso(ip, ob) {
  if (!(ob > 0)) return 0;
  return Math.floor((ip / ob) * 100 + 1e-9);
}

/** ✓ «alcanzado» solo para niveles ya superados. Déficit es el punto de partida: nunca lleva ✓. */
export function llevaCheck(id, actual) {
  return id > 1 && estadoNivel(id, actual) === "pasado";
}

/** Estado de cada tarjeta: "pasado" (✓, apagado), "actual" (resaltado) o "pendiente". */
export function estadoNivel(id, actual) {
  if (!actual) return "pendiente";
  return id < actual ? "pasado" : id === actual ? "actual" : "pendiente";
}

// Escala de la barra: 0–150%. Así Abundancia (130%) queda adentro con margen y
// un 136% se ve pasado de esa marca, en vez de llenar la barra entera.
export const TOPE_BARRA = 1.5;
export function posEnBarra(cobertura) {
  return Math.max(0, Math.min((cobertura / TOPE_BARRA) * 100, 100));
}

/**
 * Meta de cada tarjeta. Déficit no tiene meta (es el punto de partida).
 * Estabilidad usa la regla que ya existe en nivelLibertad: se llega con el
 * flujo del mes ≥ $0 (lo que entra cubre lo que sale), no con ingreso pasivo.
 * Seguridad / Independencia / Abundancia: ingreso pasivo de umbralNivel.
 */
export function metaNivel(def, ctx) {
  if (!def || def.clave === "deficit") return null;
  if (def.clave === "estabilidad") return { tipo: "flujo", monto: 0 };
  return { tipo: "pasivo", monto: umbralNivel(def, ctx) };
}

const NOMBRE_FREQ = { anual: "anual", trimestral: "trimestral", semestral: "semestral", unico: "pago único" };
/**
 * Ingresos ocultos (sim === false): nombre, monto mensual en COP y nota. Solo
 * para mostrarle al usuario sus propios datos; no va a analytics ni a logs.
 * Base única: promedio mensual del año. Mensual/variable → montoPromedioMensual;
 * no mensuales → total del año / 12, aunque ya se hayan cobrado (antes salían
 * en $0/mes). El total del aviso es la suma de esta lista.
 */
export function ingresosOcultos(ingresos = [], trm = null, año = getMesActual().año) {
  const tasa = trmUsable(trm);
  return (ingresos || []).filter((i) => i && i.sim === false).map((i) => {
    // Sin tasa real no se inventa una (nunca 4.200): el monto queda pendiente.
    if (i.moneda === "USD" && tasa == null) {
      return { nombre: String(i.nombre || i.categoria || "Ingreso sin nombre"), mensual: null, nota: "pendiente de tasa", revisar: false, pendienteTasa: true };
    }
    const fx = i.moneda === "USD" ? tasa : 1;
    const freq = getFrecuencia(i);
    const noMensual = freq !== "mensual" && freq !== "variable";
    const mensual = (noMensual ? (totalAnualItem(i) || 0) / 12 : (montoPromedioMensual(i) || 0)) * fx;
    let nota = null;
    if (noMensual) {
      const f = NOMBRE_FREQ[freq] || freq;
      if (estaPagadoEnAño(i, año)) {
        const mes = Number(i.mesPago) >= 1 && Number(i.mesPago) <= 12 ? MESES[Number(i.mesPago) - 1].l.toLowerCase() : null;
        nota = mes ? `${f}, ya cobrado en ${mes}` : `${f}, ya cobrado este año`;
      } else nota = `${f}, prorrateado por mes`;
    }
    // Registro viejo: categoría «Inversión» sin código fiscal. Cuenta como
    // pasivo (metrics.js:42) pero puede ser una venta. Solo se marca para que
    // el usuario lo revise; no cambia el nivel.
    const revisar = String(i.categoria || "").trim() === "Inversión" && !i.fiscalCode;
    return { nombre: String(i.nombre || i.categoria || "Ingreso sin nombre"), mensual, nota, revisar };
  });
}
export const sumaOcultos = (lista = []) => lista.reduce((s, x) => s + (x.mensual || 0), 0);

// Confirmaciones del usuario («sí, es renta de una inversión»). Solo nombres,
// en el navegador del usuario; no van a analytics ni a logs.
const CLAVE_CONFIRMADOS = "fp_inversion_confirmada";
export function leerConfirmados(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { return new Set(JSON.parse(store?.getItem(CLAVE_CONFIRMADOS) || "[]")); } catch { return new Set(); }
}
export function confirmarRenta(nombre, store = typeof localStorage !== "undefined" ? localStorage : null) {
  const set = leerConfirmados(store); set.add(nombre);
  try { store?.setItem(CLAVE_CONFIRMADOS, JSON.stringify([...set])); } catch { /* sin storage */ }
  return set;
}

/**
 * 24-oct-2026 (QA #58) — El nivel REAL sale solo de los datos guardados.
 * Los sliders y escenarios (Crisis, Optimista…) no lo tocan: se calculan aparte
 * y, si cambian algo, se muestran como «Nivel en este escenario».
 * Ingreso laboral (salario, prima, bono) nunca es pasivo (metrics.js → esLaboral).
 */
export function metricasReales(user = {}, { retencionMensual = 0, impuestoNeto = 0, mes, trm } = {}) {
  // 24-oct-2026 (QA #58) — Misma TRM que el resto de la app (la del Banco de la
  // República o la última real guardada). Nunca 4.200: si no hay tasa, los
  // montos en USD quedan FUERA del nivel y se marca «pendiente de tasa», igual
  // que la lista de ingresos ocultos.
  const tasa = trmUsable(trm !== undefined ? trm : user.trm);
  const esUSD = (x) => x && x.moneda === "USD";
  let nUSD = 0;
  const sinUSD = (arr) => (arr || []).filter((x) => { if (tasa == null && esUSD(x) && x.sim !== false) { nUSD++; return false; } return true; });
  const gastos = {};
  Object.entries(user.gastos || {}).forEach(([c, items]) => { gastos[c] = sinUSD(items); });
  const met = calcularMetricas({
    ingresos: sinUSD(user.ingresos), gastos, deudas: sinUSD(user.deudas),
    inv: sinUSD(user.inv), trm: tasa ?? 1, retencionMensual, impuestoNeto,
  }, { base: "mes", mes });
  return { ...met, trm: tasa, trmPendiente: tasa == null && nUSD > 0, nUSDExcluidos: nUSD };
}

/** TRM utilizable: número > 0. Si no hay, null (nunca un valor inventado). */
export function trmUsable(trm) {
  const n = Number(trm);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Texto aparte para el escenario; null si no hay simulación o no cambia nada. */
export function etiquetaEscenario(real, esc, simulando) {
  if (!simulando || !esc?.nivel?.nivel || !(esc.ob > 0)) return null;
  const n = esc.nivel.nivel;
  const pct = pctPiso(esc.ip, esc.ob);
  if (real?.nivel?.nivel === n && pctPiso(real.ip, real.ob) === pct) return null;
  return `Nivel en este escenario: ${NIVELES[n - 1].nombre} (${fmtPctEs(pct, 0)}). Es una simulación: tu nivel real no cambia.`;
}

/** Retención e impuesto neto mensuales de los datos guardados (misma regla que baseT). */
export function impuestoBase(impuestoData) {
  let ib = 0, rb = 0;
  ((impuestoData && impuestoData.detalle) || []).forEach((td) => {
    ib += td.impBruto != null ? td.impBruto : (td.impuesto || 0);
    rb += (td.reteN || 0);
  });
  return { retencionMensual: Math.round(rb / 12), impuestoNeto: Math.max(0, Math.round((ib - rb) / 12)) };
}

export const PISTA_ESENCIALES = "Marca tus gastos esenciales para ver cuándo llegas a Seguridad";
/** Solo copy: pista cuando ningún gasto está marcado como esencial (no cambia el nivel). */
export function pistaEsenciales(met) {
  if (!met || !(met.ob > 0) || met.esencialesClasificados) return null;
  return PISTA_ESENCIALES;
}
