/**
 * metrics.js — Base única de métricas de patrimonio (spec Finanzas 2026-10-11).
 *
 * POR QUÉ EXISTE
 * El "nivel de libertad" se calculaba en 5 lugares distintos (simulador,
 * Dashboard, reporte PDF, coach Estratega, export del simulador) y en todos
 * como ingreso TOTAL ÷ egresos. Un asalariado de $5M con $1,8M de arriendo y
 * patrimonio $0 salía «Libertad Absoluta 5/5 · Pasivos = 278%» mientras el
 * Dashboard decía «Ingreso pasivo 0%». Además cada lugar tenía su propia
 * lista de categorías pasivas (["Arriendo","Rendimiento","Dividendos",
 * "Inversión"]) y ninguna reconocía los ingresos creados desde Patrimonio
 * (categoría "Rentas de capital"), así que un arriendo de $1,9M contaba 0%.
 *
 * Todo lo de abajo es PURO: recibe datos, devuelve números. Sin React, sin
 * Supabase. Toda tarjeta que muestre nivel, cobertura o ingreso pasivo debe
 * salir de acá.
 *
 * DEFINICIONES (COP mensual):
 *   IA  ingreso activo: salario, honorarios, negocio, cesantías, otros no
 *       pasivos. Neto de retención en la fuente cuando se pasa `retencionMensual`.
 *   IP  ingreso pasivo: arriendo NETO (bruto − administración − predial/12 −
 *       mantenimiento, cuando esos gastos están vinculados al activo o
 *       clasificados como gasto del inmueble arrendado), intereses, CDT, FIC,
 *       rendimientos, dividendos, regalías, pensión ya recibida.
 *       NO salario, NO honorarios, NO valorización, NO venta de activos.
 *   G   gastos de vida sin cuotas (incluye aportes de "Seguridad Social" e
 *       impuesto neto a pagar si se pasa). Excluye los gastos del inmueble
 *       arrendado que ya se netearon contra su renta.
 *   SD  servicio de deuda (cuotas, capital + interés).
 *   FL = IA + IP − G − SD      OB = G + SD
 */
import { montoPromedioMensual } from "./flowHelpers.js";

// ─── Clasificación de ingresos ─────────────────────────────────────────────
const CATS_PASIVAS = new Set([
  "Arriendo", "Arrendamiento", "Rendimiento", "Rendimientos", "Rentas de capital",
  "Dividendos", "Intereses bancarios", "Intereses", "Utilidad FIC", "Regalías",
  "Pensión",
  // Legacy: "Inversión" sin fiscalCode es como se cargaban los rendimientos de
  // inversiones antes del catálogo fiscal. Con fiscalCode CAP_VENTA_ACTIVOS es
  // una venta (realización de valorización) y NO es pasivo.
  "Inversión",
]);
const CATS_ACTIVAS = new Set([
  "Salario", "Honorarios", "Freelance", "Comisiones", "Cesantías", "Negocio",
]);

/** "pasivo" | "activo". Todo lo que no es claramente pasivo es activo. */
export function tipoIngreso(i) {
  const fc = String(i?.fiscalCode || "");
  if (fc) {
    if (fc === "CAP_VENTA_ACTIVOS") return "activo";
    if (fc.startsWith("LAB_") || fc === "NOL_HONORARIOS_INDEP" || fc === "NOL_NEGOCIO") return "activo";
    if (fc.startsWith("CAP_") || fc.startsWith("DIV_") || fc.startsWith("NOL_ARRIENDO_") || fc.startsWith("PEN_")) return "pasivo";
    if (fc.startsWith("GO_")) return "activo"; // herencia/lotería: no recurrente
  }
  const cat = String(i?.categoria || "").trim();
  if (CATS_ACTIVAS.has(cat)) return "activo";
  if (CATS_PASIVAS.has(cat)) return "pasivo";
  // Un ingreso vinculado a un activo (creado desde Patrimonio) es renta del activo.
  if (i?.activoId) return "pasivo";
  return "activo";
}

/** Gasto propio de un inmueble arrendado (admin, predial, mantenimiento...). */
export function esGastoInmuebleArrendado(cat, g) {
  const fc = String(g?.fiscalCode || "");
  return fc.startsWith("GAS_INMUEBLE_") || /inmueble arrendado/i.test(String(cat || ""));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fx = (item, trm) => (item?.moneda === "USD" ? trm : 1);
const mensualIngreso = (i, trm) => montoPromedioMensual({ ...i, mensual: num(i?.mensual) * fx(i, trm) });
const mensualGasto = (g, trm) => montoPromedioMensual(g) * fx(g, trm);
const cuotaDeuda = (d, trm) => montoPromedioMensual({ ...d, mensual: num(d?.pg ?? d?.pago) * fx(d, trm) });

// ─── Clasificación de activos (liquidez / invertibles) ─────────────────────
const TYPE_MAP = { Other: "Otro", Investment: "Fondo de Inversión", Income: "Otro", Trading: "Acciones", Lote: "Real Estate" };
export function tipoActivo(i) {
  let tp = String(i?.tp || i?.tipo || i?.type || "").trim();
  if (TYPE_MAP[tp]) tp = TYPE_MAP[tp];
  if (tp) return tp;
  const nm = String(i?.n || i?.nombre || "").toLowerCase();
  if (/cdt|renta fija|bono/.test(nm)) return "CDT";
  if (/fondo|fiduci|fic\b/.test(nm)) return "Fondo de Inversión";
  if (/cash|ahorro|cuenta|efectivo/.test(nm)) return "Cash";
  if (/apart|apto|casa|lote|inmueble|oficina|bodega|local/.test(nm)) return "Real Estate";
  if (/carro|moto|veh/.test(nm)) return "Vehículo";
  if (/btc|bitcoin|crypto|eth/.test(nm)) return "Crypto";
  if (/accion|etf|stock/.test(nm)) return "Acciones";
  return "Otro";
}
const TIPOS_LIQUIDOS = new Set(["Cash", "CDT", "Renta Fija", "Fondo de Inversión"]);
const TIPOS_INMUEBLE = new Set(["Real Estate", "Local Comercial", "Bodega"]);
const TIPOS_FINANCIEROS = new Set(["Cash", "CDT", "Renta Fija", "Fondo de Inversión", "Acciones", "ETF", "Crypto"]);

/**
 * Líquido = disponible en < 30 días sin penalidad: caja, cuentas, CDT, fondos
 * a la vista. Un activo marcado `liquido: false` (o con `permanencia: true`,
 * pacto de permanencia) se excluye; `liquido: true` fuerza incluirlo.
 * Nunca líquidos: inmuebles, vehículos, pensión, cesantías, acciones, ETF, BTC.
 */
export function esLiquido(i) {
  if (i?.liquido === true) return true;
  if (i?.liquido === false || i?.permanencia === true) return false;
  return TIPOS_LIQUIDOS.has(tipoActivo(i));
}

// ─── Base común ───────────────────────────────────────────────────────────
/**
 * @param {object} d
 *   ingresos[], gastos{cat:[items]} (acepta también `gas`), deudas[] (o `deu`),
 *   inv[], trm, retencionMensual, impuestoNeto
 */
export function calcularBase(d = {}) {
  const trm = num(d.trm) || 4200;
  const ingresos = (d.ingresos || []).filter((i) => i && i.sim !== false);
  const gastos = d.gastos || d.gas || {};
  const deudas = (d.deudas || d.deu || []).filter((x) => x && x.sim !== false);
  const inv = (d.inv || []).filter((x) => x && x.sim !== false);

  // 1) Ingresos brutos por tipo; el pasivo, agrupado por activo vinculado.
  let iaBruto = 0, ipBruto = 0;
  const rentaPorActivo = {};      // activoId → renta mensual bruta
  let rentaSinVinculo = 0;        // arriendos sin activoId
  const detallePasivo = [];
  ingresos.forEach((i) => {
    const m = mensualIngreso(i, trm);
    if (tipoIngreso(i) === "pasivo") {
      ipBruto += m;
      detallePasivo.push({ nombre: i.nombre || i.categoria || "Ingreso", mensual: m, activoId: i.activoId || null });
      if (i.activoId) rentaPorActivo[i.activoId] = (rentaPorActivo[i.activoId] || 0) + m;
      else if (/^NOL_ARRIENDO_|^CAP_ARRIENDO_/.test(String(i.fiscalCode || "")) || /^Arriendo|^Arrendamiento/.test(String(i.categoria || ""))) rentaSinVinculo += m;
    } else {
      iaBruto += m;
    }
  });

  // 2) Gastos: los costos de un activo que renta se netean contra su renta.
  let aportesObligatorios = 0, gastosVida = 0;
  const costoPorActivo = {};
  let costoInmuebleSinVinculo = 0;
  Object.entries(gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g) => {
      if (!g || g.sim === false) return;
      const m = mensualGasto(g, trm);
      if (g.activoId && rentaPorActivo[g.activoId] != null) {
        costoPorActivo[g.activoId] = (costoPorActivo[g.activoId] || 0) + m;
      } else if (!g.activoId && esGastoInmuebleArrendado(cat, g) && rentaSinVinculo > 0) {
        costoInmuebleSinVinculo += m;
      } else if (cat === "Seguridad Social") {
        aportesObligatorios += m;
      } else {
        gastosVida += m;
      }
    });
  });
  // Neteo con piso en 0: si los costos superan la renta, el exceso vuelve a G.
  let costosNeteados = 0, excesoCostos = 0;
  Object.entries(costoPorActivo).forEach(([id, c]) => {
    const r = rentaPorActivo[id] || 0;
    const usado = Math.min(c, r);
    costosNeteados += usado; excesoCostos += c - usado;
  });
  {
    const usado = Math.min(costoInmuebleSinVinculo, rentaSinVinculo);
    costosNeteados += usado; excesoCostos += costoInmuebleSinVinculo - usado;
  }
  const ip = Math.max(0, ipBruto - costosNeteados);

  const retencionMensual = num(d.retencionMensual);
  const impuestoNeto = num(d.impuestoNeto);
  const ia = iaBruto - retencionMensual;
  const g = aportesObligatorios + gastosVida + excesoCostos + impuestoNeto;
  const sd = deudas.filter((x) => num(x.mt) > 0).reduce((s, x) => s + cuotaDeuda(x, trm), 0);
  const ob = g + sd;
  const fl = ia + ip - ob;

  // 3) Balance
  const valorActivo = (i) => num(i.va) * fx(i, trm);
  const activosTotal = inv.reduce((s, i) => s + valorActivo(i), 0);
  const deudaTotal = deudas.reduce((s, x) => s + num(x.mt) * fx(x, trm), 0);
  const patrimonioNeto = activosTotal - deudaTotal;
  const liquidos = inv.filter(esLiquido).reduce((s, i) => s + valorActivo(i), 0);
  const colchonMeses = ob > 0 ? liquidos / ob : null;
  // Invertibles (spec §5): inmuebles con renta o valorización, financieros,
  // caja. Se excluyen vehículos y bienes de uso.
  const invertiblesLista = inv.filter((i) => {
    const tp = tipoActivo(i);
    if (TIPOS_FINANCIEROS.has(tp)) return true;
    if (TIPOS_INMUEBLE.has(tp)) return (rentaPorActivo[i.id] || 0) > 0 || num(i.va) > num(i.vc);
    return false;
  });
  const invertibles = invertiblesLista.reduce((s, i) => s + valorActivo(i), 0);

  const ingresoTotal = iaBruto + ipBruto; // bruto: base de % sobre ingreso
  return {
    trm,
    iaBruto, ia, ipBruto, ip, costosNeteados,
    g, sd, ob, fl,
    aportesObligatorios, gastosVida, impuestoNeto, retencionMensual,
    ingresoTotal,
    // % del ingreso que no depende del trabajo (composición, sobre bruto)
    pctIngresoPasivo: ingresoTotal > 0 ? (ipBruto / ingresoTotal) * 100 : 0,
    // Cobertura pasiva = IP / OB (el índice del nivel)
    coberturaPasiva: ob > 0 ? (ip / ob) * 100 : 0,
    activosTotal, deudaTotal, patrimonioNeto,
    liquidos, colchonMeses, invertibles, invertiblesIds: invertiblesLista.map((i) => i.id),
    rentaPorActivo, detallePasivo,
  };
}

// ─── Nivel de libertad (spec §1) ──────────────────────────────────────────
export const NIVELES = [
  { id: 1, clave: "deficit",     nombre: "Déficit",          min: null, icon: "⚠️", color: "#ef4444",
    desc: "Tu flujo del mes es negativo",
    detail: "Gastas más de lo que entra. Antes de pensar en ingreso pasivo, el primer paso es que tu flujo libre (ingresos menos gastos y cuotas) sea positivo." },
  { id: 2, clave: "estabilidad", nombre: "Estabilidad",      min: 0,    icon: "🛡️", color: "#3b82f6",
    desc: "Flujo positivo; pasivos < 25% de tus gastos",
    detail: "Tu flujo es positivo: cubres tus gastos y cuotas con lo que ganas. Tu ingreso pasivo (arriendos netos, intereses, dividendos) cubre menos del 25% de tus gastos y cuotas." },
  { id: 3, clave: "seguridad",   nombre: "Seguridad",        min: 25,   icon: "⚡", color: "#22d3ee",
    desc: "Pasivos cubren 25–50% de tus gastos",
    detail: "Tus activos ya pagan entre el 25% y el 50% de tus gastos y cuotas. Si tu ingreso por trabajo bajara, tus activos amortiguan una parte importante." },
  { id: 4, clave: "libertad_parcial", nombre: "Libertad parcial", min: 50, icon: "🚀", color: "#f97316",
    desc: "Pasivos cubren 50–100% de tus gastos",
    detail: "Tus activos pagan al menos la mitad de tus gastos y cuotas. Trabajar empieza a ser una elección parcial." },
  { id: 5, clave: "independencia", nombre: "Independencia",  min: 100,  icon: "👑", color: "#eab308",
    desc: "Pasivos cubren el 100% de tus gastos",
    detail: "Tu ingreso pasivo neto cubre todos tus gastos y cuotas. Podrías dejar de trabajar y mantener tu nivel de vida con lo que generan tus activos." },
];

/**
 * Nivel 1–5, o null si no hay obligaciones cargadas (sin datos).
 *   N1 FL < 0 · N2 < 25% · N3 25–50% · N4 50–100% · N5 ≥ 100%
 *   Candado: patrimonio neto < 0 → máximo N2.
 */
export function nivelLibertad({ ip = 0, ob = 0, fl = 0, patrimonioNeto = 0 } = {}) {
  if (!(ob > 0)) return { nivel: null, cobertura: 0, candado: null, ...NIVEL_VACIO };
  const cobertura = (ip / ob) * 100;
  let nivel, candado = null;
  if (fl < 0) { nivel = 1; candado = "deficit"; }
  else if (cobertura >= 100) nivel = 5;
  else if (cobertura >= 50) nivel = 4;
  else if (cobertura >= 25) nivel = 3;
  else nivel = 2;
  if (patrimonioNeto < 0 && nivel > 2) { nivel = 2; candado = "patrimonio_negativo"; }
  const data = NIVELES[nivel - 1];
  const sig = nivel < 5 ? NIVELES[nivel] : null;
  // Lo que falta de ingreso pasivo para el siguiente umbral (si aplica).
  const ipNecesarioSiguiente = sig && sig.min != null ? (sig.min / 100) * ob : null;
  return {
    nivel, cobertura, candado, nombre: data.nombre, data,
    siguiente: sig,
    faltaIPSiguiente: ipNecesarioSiguiente != null ? Math.max(0, ipNecesarioSiguiente - ip) : null,
  };
}
const NIVEL_VACIO = { nombre: null, data: null, siguiente: null, faltaIPSiguiente: null };

/** Atajo: base + nivel. */
export function calcularMetricas(d = {}) {
  const base = calcularBase(d);
  return { ...base, nivel: nivelLibertad(base) };
}
