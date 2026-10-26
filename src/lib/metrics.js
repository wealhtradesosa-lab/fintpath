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
import { montoPromedioMensual, montoDelMes, getMesActual } from "./flowHelpers.js";

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

// Ingresos laborales: nunca son pasivos, aunque estén vinculados a un activo
// o traigan un código CAP_/DIV_ por error de carga.
const CATS_LABORALES = new Set([
  ...CATS_ACTIVAS, "Prima", "Prima de servicios", "Bono", "Bonos", "Bonificación",
  "Bonificaciones", "Intereses cesantías", "Intereses sobre cesantías", "Vacaciones",
  "Horas extra", "Auxilio", "Prestaciones",
]);
export function esLaboral(i) {
  const fc = String(i?.fiscalCode || "");
  if (fc.startsWith("LAB_") || fc === "NOL_HONORARIOS_INDEP" || fc === "NOL_NEGOCIO") return true;
  return CATS_LABORALES.has(String(i?.categoria || "").trim());
}

/** "pasivo" | "activo". Todo lo que no es claramente pasivo es activo. */
export function tipoIngreso(i) {
  if (esLaboral(i)) return "activo";
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
  // Un ingreso vinculado a un activo (creado desde Patrimonio) es renta del
  // activo, salvo que sea laboral (eso ya salió arriba).
  if (i?.activoId) return "pasivo";
  return "activo";
}

// ─── Gasto esencial vs. prescindible ──────────────────────────────────────
// 21-oct-2026. Santiago: "jamás 20 mm son seguridad en mi caso". Los escalones
// se definían por fracciones inventadas de los gastos (25%, 50%); "Seguridad"
// era el 25% y con gastos de ~$104M/mes eso rotulaba Seguridad a $26M. Nadie
// está seguro con la cuarta parte de lo que necesita. Seguridad pasa a medirse
// contra lo ESENCIAL: lo que uno no puede apagar si deja de trabajar.
const CATS_ESENCIALES = new Set([
  "Vivienda", "Arrendamiento", "Alimentación", "Alimentacion", "Mercado",
  "Servicios", "Servicios públicos", "Salud", "Seguros", "Educación", "Educacion",
  "Transporte", "Mantenimiento", "Seguridad Social", "Impuesto", "Impuestos",
]);
/** ¿Es un gasto que no se puede apagar? Manda la marca del item si existe. */
export function esGastoEsencial(cat, g) {
  if (g && typeof g.esencial === "boolean") return g.esencial;
  return CATS_ESENCIALES.has(String(cat || "").trim());
}

/** Gasto propio de un inmueble arrendado (admin, predial, mantenimiento...). */
export function esGastoInmuebleArrendado(cat, g) {
  const fc = String(g?.fiscalCode || "");
  return fc.startsWith("GAS_INMUEBLE_") || /inmueble arrendado/i.test(String(cat || ""));
}

// Mes que se está midiendo (lo fija calcularBase antes de sumar). Module-level
// porque cuotaDeuda necesita saberlo para su respaldo de vigencia.
const mensContexto = { anio: null, mes: null };
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fx = (item, trm) => (item?.moneda === "USD" ? trm : 1);
// `mens` mensualiza un item. Dos bases, MISMO motor (ver calcularBase):
//   "promedio" — el promedio del año (lo de siempre)
//   "mes"      — lo que de verdad se paga en un mes concreto
const mensualIngreso = (i, trm, mens) => mens({ ...i, mensual: num(i?.mensual) * fx(i, trm) });
const mensualGasto = (g, trm, mens) => mens(g) * fx(g, trm);
// Una cuota de deuda NO es un gasto variable: se paga igual todos los meses de
// su vigencia. Si quedó marcada "variable" sin montos cargados, la base "mes"
// la leía como $0 y la deuda desaparecía (en la cuenta de Santiago, $7,4M/mes
// en dos créditos). Dentro de su vigencia, la cuota guardada manda.
const cuotaDeuda = (d, trm, mens) => {
  const cuota = num(d?.pg ?? d?.pago) * fx(d, trm);
  const v = mens({ ...d, mensual: cuota });
  if (v > 0 || cuota <= 0) return v;
  const desde = num(d?.desdeMes) || 1, hasta = num(d?.hastaMes) || 12;
  const { mes } = mensContexto;
  return mes >= desde && mes <= hasta ? cuota : 0;
};

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
 * @param {object} opts
 *   base: "promedio" (default, el promedio del año) | "mes" (lo que se paga en
 *         un mes concreto). 21-oct-2026 — el nivel de libertad se medía contra
 *         el promedio y eso mentía: la Seguridad Social de Santiago, $27,6M que
 *         paga HOY, entraba como $6,9M porque arranca en octubre y se repartía
 *         sobre 12 meses. La barra ahora mide contra el mes.
 *   anio, mes: el mes a medir cuando base = "mes" (default: el mes en curso).
 */
export function calcularBase(d = {}, opts = {}) {
  const { base = "promedio", anio, mes } = opts;
  const hoy = getMesActual();
  const aMed = anio || hoy.año, mMed = mes || hoy.mes;
  // Prima/Bono (no mensual): siempre ÷ 12, como en Flujo de caja, aunque el mes
  // medido no sea el del cobro. Así la tasa de ahorro no salta ese mes ni queda en 0 el resto.
  const mensBase = base === "mes" ? (it) => montoDelMes(it, aMed, mMed) : montoPromedioMensual;
  const mens = (it) => (String(it?.categoria || "").trim() === "Prima/Bono" ? montoPromedioMensual(it) : mensBase(it));
  mensContexto.anio = aMed; mensContexto.mes = base === "mes" ? mMed : null;
  const trm = num(d.trm) || 4200;
  const visible = (x) => x && x.sim !== false;
  const ingresos = (d.ingresos || []).filter(visible);
  const gastos = d.gastos || d.gas || {};
  const deudas = (d.deudas || d.deu || []).filter(visible);
  const inv = (d.inv || []).filter(visible);

  // Lo que el ojo ⬜ de las listas dejó fuera. No se suma (ocultar es una
  // decisión del usuario y esconder ingresos a la vez que gastos desbalancearía
  // la cobertura), pero se devuelve para que la UI pueda decirlo en voz alta en
  // vez de que la plata desaparezca sin rastro.
  const ocultos = { gastos: 0, nGastos: 0, ingresos: 0, nIngresos: 0 };
  Object.entries(d.gastos || d.gas || {}).forEach(([, items]) => {
    (items || []).forEach((g) => {
      if (g && g.sim === false) { ocultos.gastos += mensualGasto(g, trm, mens); ocultos.nGastos++; }
    });
  });
  (d.ingresos || []).forEach((i) => {
    if (i && i.sim === false) { ocultos.ingresos += mensualIngreso(i, trm, mens); ocultos.nIngresos++; }
  });

  // 1) Ingresos brutos por tipo; el pasivo, agrupado por activo vinculado.
  let iaBruto = 0, ipBruto = 0;
  const rentaPorActivo = {};      // activoId → renta mensual bruta
  let rentaSinVinculo = 0;        // arriendos sin activoId
  const detallePasivo = [];
  ingresos.forEach((i) => {
    const m = mensualIngreso(i, trm, mens);
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
  let aportesObligatorios = 0, gastosVida = 0, gastosVidaEsencial = 0;
  const costoPorActivo = {};
  let costoInmuebleSinVinculo = 0;
  // Origen de la renta del activo (`rentaOrigen`): 'manual' = el usuario escribió
  // el % y ya es neta → se usa tal cual: sus gastos vinculados (administración,
  // predial, mantenimiento) NO se descuentan de nuevo ni van a G (ya están dentro
  // de la renta neta). 'derivada' o sin indicador (activos viejos) = bruta.
  const manualIds = new Set(inv.filter((x) => x.rentaOrigen === "manual").map((x) => x.id));
  let costosAbsorbidosManual = 0;
  Object.entries(gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g) => {
      if (!g || g.sim === false) return;
      const m = mensualGasto(g, trm, mens);
      if (g.activoId && manualIds.has(g.activoId) && rentaPorActivo[g.activoId] != null) {
        costosAbsorbidosManual += m;
      } else if (g.activoId && rentaPorActivo[g.activoId] != null) {
        costoPorActivo[g.activoId] = (costoPorActivo[g.activoId] || 0) + m;
      } else if (!g.activoId && esGastoInmuebleArrendado(cat, g) && rentaSinVinculo > 0) {
        costoInmuebleSinVinculo += m;
      } else if (cat === "Seguridad Social") {
        aportesObligatorios += m;
      } else {
        gastosVida += m;
        if (esGastoEsencial(cat, g)) gastosVidaEsencial += m;
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
  // Renta neta mensual por activo vinculado (renta − costos propios, piso 0).
  const rentaNetaPorActivo = {};
  Object.keys(rentaPorActivo).forEach((id) => {
    rentaNetaPorActivo[id] = Math.max(0, rentaPorActivo[id] - (costoPorActivo[id] || 0));
  });

  const retencionMensual = num(d.retencionMensual);
  const impuestoNeto = num(d.impuestoNeto);
  const ia = iaBruto - retencionMensual;
  const g = aportesObligatorios + gastosVida + excesoCostos + impuestoNeto;
  // 21-oct-2026 — El filtro era `num(x.mt) > 0`: una deuda cuya cuota se sigue
  // pagando, pero a la que nadie le cargó el saldo, perdía su cuota ENTERA de
  // la obligación del mes. En la cuenta de Santiago eran $2,5M/mes invisibles.
  // Ahora manda la cuota: si este mes hay que pagarla, cuenta.
  const sd = deudas.reduce((s, x) => s + cuotaDeuda(x, trm, mens), 0);
  const ob = g + sd;
  // Obligación esencial: el piso. Los aportes obligatorios y las cuotas de deuda
  // entran siempre (no son opcionales). Si los gastos no están clasificados no se
  // inventa una fracción: obEsencial = ob, y "Seguridad" queda tan exigente como
  // "Independencia". Mejor exigir de más que prometer una seguridad que no es.
  const esencialesClasificados = gastosVidaEsencial > 0;
  const obEsencial = esencialesClasificados
    ? gastosVidaEsencial + aportesObligatorios + excesoCostos + impuestoNeto + sd
    : ob;
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

  const ingresoTotal = iaBruto + ipBruto; // bruto: solo para la composición activo/pasivo
  // Ingreso NETO de retención: base única de ahorro y carga de deuda. El flujo
  // libre (fl) ya es neto de retención, así que el denominador debe serlo también.
  // La retención no se vuelve a restar en el saldo a pagar de Renta (impuestoNeto ya viene neto).
  const ingresoNeto = ia + ipBruto;
  const ahorroPct = ingresoNeto > 0 ? (fl / ingresoNeto) * 100 : 0;
  const cargaDeudaPct = ingresoNeto > 0 ? (sd / ingresoNeto) * 100 : 0;
  return {
    trm, base, anioMedido: aMed, mesMedido: mMed, ocultos,
    iaBruto, ia, ipBruto, ip, costosNeteados, costosAbsorbidosManual,
    g, sd, ob, fl, obEsencial, gastosVidaEsencial, esencialesClasificados,
    aportesObligatorios, gastosVida, impuestoNeto, retencionMensual,
    ingresoTotal, ingresoNeto, ahorroPct, cargaDeudaPct,
    // % del ingreso que no depende del trabajo (composición, sobre bruto)
    pctIngresoPasivo: ingresoTotal > 0 ? (ipBruto / ingresoTotal) * 100 : 0,
    // Cobertura pasiva = IP / OB (el índice del nivel)
    coberturaPasiva: ob > 0 ? (ip / ob) * 100 : 0,
    activosTotal, deudaTotal, patrimonioNeto,
    liquidos, colchonMeses, invertibles, invertiblesIds: invertiblesLista.map((i) => i.id),
    rentaPorActivo, rentaNetaPorActivo, detallePasivo,
    // Valorización anual declarada (campo opcional `valorizacionPct` del activo).
    valorizacionAnual: inv.reduce((s, i) => s + valorActivo(i) * (num(i.valorizacionPct) / 100), 0),
    inv,
  };
}

// ─── Nivel de libertad ────────────────────────────────────────────────────
// 21-oct-2026 — Los escalones eran fracciones inventadas de los gastos: 25% se
// llamaba "Seguridad" y 50% "Libertad parcial". Santiago, cinco veces: "jamás
// 20 mm son seguridad en mi caso", "ni en libertad parcial con 42mm". Tenía
// razón: con el 25% de lo que uno necesita no hay ninguna seguridad, y con la
// mitad no se es libre ni a medias — se sigue trabajando exactamente igual.
//
// Ahora cada escalón se mide contra una plata REAL, no contra un porcentaje:
//   N1 Déficit       gastas más de lo que entra
//   N2 Estabilidad   el flujo da, pero tus activos no pagan ni lo esencial
//   N3 Seguridad     tus activos pagan LO ESENCIAL + las cuotas
//   N4 Independencia tus activos pagan TODO tu nivel de vida
//   N5 Abundancia    lo pagan con 30% de margen
//
// `umbral` dice contra qué se compara el ingreso pasivo: "esencial", "total", o
// null cuando el escalón lo decide el flujo y no el ingreso pasivo.
export const NIVELES = [
  { id: 1, clave: "deficit", nombre: "Déficit", umbral: null, factor: 0, icon: "⚠️", color: "#ef4444",
    desc: "Gastas más de lo que entra",
    detail: "Tu flujo del mes es negativo. Antes de pensar en ingreso pasivo, el primer paso es que lo que entra cubra lo que sale." },
  { id: 2, clave: "estabilidad", nombre: "Estabilidad", umbral: null, factor: 0, icon: "🛡️", color: "#3b82f6",
    desc: "Te alcanza, pero trabajando",
    detail: "Cubres tus gastos y cuotas con lo que ganas. Si dejaras de trabajar, tu ingreso pasivo todavía no paga ni lo esencial." },
  { id: 3, clave: "seguridad", nombre: "Seguridad", umbral: "esencial", factor: 1, icon: "⚡", color: "#22d3ee",
    desc: "Tus activos pagan lo que no puedes apagar",
    detail: "Tu ingreso pasivo cubre lo esencial: techo, comida, servicios, salud, educación, transporte, seguros, aportes y las cuotas de tus deudas. Si tu ingreso por trabajo desapareciera, recortarías lo demás, pero no pierdes el piso." },
  { id: 4, clave: "independencia", nombre: "Independencia", umbral: "total", factor: 1, icon: "🚀", color: "#f97316",
    desc: "Tus activos pagan todo tu nivel de vida",
    detail: "Tu ingreso pasivo neto cubre el 100% de tus gastos y cuotas, sin recortar nada. Trabajar pasa a ser una elección." },
  // 24-oct-2026 (Santiago, con 136 % de cobertura: "¿136 % sí es para estar
  // en abundancia? Abundancia creería yo es cuando se alcanzan porcentajes
  // más altos"). Antes bastaba 130 %. Abundancia es pagar la vida DOS veces
  // con los activos: 200 %.
  { id: 5, clave: "abundancia", nombre: "Abundancia", umbral: "total", factor: 2, icon: "👑", color: "#eab308",
    desc: "Lo pagan dos veces",
    detail: "Tu ingreso pasivo es el doble de tus gastos y cuotas. Ese margen absorbe la inflación, un año malo de rentas o un gasto grande sin tocar el capital, y deja plata para reinvertir cada mes." },
];

/** Ingreso pasivo mensual que exige un escalón. null si no se mide así. */
export function umbralNivel(nivelDef, { ob = 0, obEsencial = 0 } = {}) {
  if (!nivelDef || !nivelDef.umbral) return null;
  const base = nivelDef.umbral === "esencial" ? (obEsencial || ob) : ob;
  return base * (nivelDef.factor || 1);
}

/**
 * Nivel 1–5, o null si no hay obligaciones cargadas.
 *   N1 FL < 0 · N2 IP < esencial · N3 IP ≥ esencial · N4 IP ≥ total · N5 IP ≥ 1,3× total
 *   Candado: patrimonio neto < 0 → máximo N2.
 */
export function nivelLibertad({ ip = 0, ob = 0, obEsencial = null, fl = 0, patrimonioNeto = 0 } = {}) {
  if (!(ob > 0)) return { nivel: null, cobertura: 0, candado: null, ...NIVEL_VACIO };
  const obEs = obEsencial > 0 ? obEsencial : ob;
  const ctx = { ob, obEsencial: obEs };
  const cobertura = (ip / ob) * 100;
  // 21-oct-2026 — El escalón sale SIEMPRE de lo que pagan los activos. Antes el
  // flujo negativo tiraba el nivel a 1/5 pisando la cobertura, y la tarjeta se
  // contradecía consigo misma: la barra dibujada en 67% con el badge en
  // "⚠️ Déficit 1/5" y los escalones de arriba apagados. El déficit sigue
  // dejando a alguien en Déficit cuando sus activos no pagan ni lo esencial
  // (que es lo que el nivel 1 quiere decir), pero ya no borra un escalón que
  // los activos SÍ se ganaron: eso se reporta aparte, en `deficitFlujo`, para
  // que la UI lo diga encima de la tarjeta.
  let nivel;
  if (ip >= ob * 1.3) nivel = 5;
  else if (ip >= ob) nivel = 4;
  else if (ip >= obEs) nivel = 3;
  else nivel = fl < 0 ? 1 : 2;
  let candado = nivel === 1 ? "deficit" : null;
  const deficitFlujo = fl < 0;
  if (patrimonioNeto < 0 && nivel > 2) { nivel = 2; candado = "patrimonio_negativo"; }
  const data = NIVELES[nivel - 1];
  const sig = nivel < 5 ? NIVELES[nivel] : null;
  const ipNecesarioSiguiente = umbralNivel(sig, ctx);
  return {
    nivel, cobertura, candado, deficitFlujo, nombre: data.nombre, data, siguiente: sig,
    obEsencial: obEs,
    coberturaEsencial: obEs > 0 ? (ip / obEs) * 100 : 0,
    faltaIPSiguiente: ipNecesarioSiguiente != null ? Math.max(0, ipNecesarioSiguiente - ip) : null,
  };
}
const NIVEL_VACIO = { nombre: null, data: null, siguiente: null, faltaIPSiguiente: null, obEsencial: 0, coberturaEsencial: 0, deficitFlujo: false };

/**
 * Atajo: base + nivel, SIEMPRE en la misma base. Quien quiera medir contra lo
 * que se paga este mes pide `{ base: "mes" }` y recibe todo en esa base: mezclar
 * una cobertura del promedio con un nivel del mes da textos que se contradicen.
 */
export function calcularMetricas(d = {}, opts = {}) {
  const base = calcularBase(d, opts);
  return { ...base, nivel: nivelLibertad(base) };
}

// ─── Salud financiera 0–100 (spec §2) ─────────────────────────────────────
const interp = (x, x0, x1) => {   // lineal: x0→0, x1→100 (x1<x0 invierte); acotado
  const t = (x - x0) / (x1 - x0);
  return Math.max(0, Math.min(1, t)) * 100;
};
export const BANDAS_SALUD = [
  { min: 80, nombre: "Excelente" }, { min: 60, nombre: "Buena" },
  { min: 40, nombre: "Frágil" },    { min: 0,  nombre: "Crítica" },
];
export function saludFinanciera(b) {
  // Sin ingresos ni obligaciones cargados no hay nada que puntuar: antes una cuenta vacía sacaba 40 por
  // «deuda 0» y «apalancamiento 0».
  if (b.ingresoNeto != null && !(b.ingresoNeto > 0) && !(b.ob > 0)) return { score: null, banda: "Sin datos", componentes: {}, candado: null };
  // Misma base (ingreso neto de retención) en numerador y denominador.
  const ahorroPct = b.ahorroPct != null ? b.ahorroPct : 0;
  const deudaPct = b.cargaDeudaPct != null ? b.cargaDeudaPct : 0;
  const dA = b.activosTotal > 0 ? (b.deudaTotal / b.activosTotal) * 100 : 0;
  const col = b.colchonMeses == null ? 0 : b.colchonMeses;
  const cob = b.coberturaPasiva || 0;
  const comp = {
    ahorro:       { valor: ahorroPct, puntos: interp(ahorroPct, 0, 20),  peso: 25 },
    cargaDeuda:   { valor: deudaPct,  puntos: interp(deudaPct, 45, 15),  peso: 25 },
    colchon:      { valor: col,       puntos: interp(col, 0, 6),         peso: 25 },
    apalancamiento: { valor: dA,      puntos: interp(dA, 80, 30),        peso: 15 },
    cobertura:    { valor: cob,       puntos: interp(cob, 0, 50),        peso: 10 },
  };
  let score = Object.values(comp).reduce((s, c) => s + (c.puntos * c.peso) / 100, 0);
  let candado = null;
  if ((b.fl < 0 || b.patrimonioNeto < 0) && score > 39) { score = 39; candado = b.fl < 0 ? "deficit" : "patrimonio_negativo"; }
  score = Math.round(score);
  return { score, banda: BANDAS_SALUD.find((x) => score >= x.min).nombre, componentes: comp, candado };
}

// ─── Renta anual y yield on cost (spec §4) ────────────────────────────────
/** Renta anual del portafolio = IP × 12 (neto; sin salario ni valorización). */
export function rentaYYield(b) {
  const rentaAnual = b.ip * 12;
  const ids = Object.keys(b.rentaNetaPorActivo || {});
  const activos = (b.inv || []).filter((i) => ids.includes(i.id));
  const fxa = (i) => (i.moneda === "USD" ? b.trm : 1);
  let costo = 0, sinCosto = false;
  activos.forEach((i) => {
    const vc = num(i.vc) * fxa(i);
    if (vc > 0) costo += vc; else { costo += num(i.va) * fxa(i); sinCosto = true; }
  });
  const rentaVinculada = ids.reduce((s, id) => s + b.rentaNetaPorActivo[id], 0) * 12;
  return {
    rentaAnual,
    yield: costo > 0 ? (rentaVinculada / costo) * 100 : null,
    base: costo,
    sobreValorActual: sinCosto,
    etiqueta: sinCosto ? "Rendimiento por renta (sobre valor actual)" : "Yield on cost",
  };
}

// ─── Inflación (spec §5) ──────────────────────────────────────────────────
/**
 * Supuesto de inflación GLOBAL (% anual): un solo valor editable por el usuario
 * (`user.inflacionPct`) que alimenta la proyección y el mensaje del portafolio.
 * Default 4%. Cualquier cifra externa (p. ej. IPC publicado) es solo referencia.
 */
export const INFLACION_DEFAULT_PCT = 4;
export function inflacionGlobal(v) {
  const n = Number(v);
  return v === "" || v == null || !Number.isFinite(n) || n < 0 ? INFLACION_DEFAULT_PCT : n;
}
/** Margen real (puntos) bajo el cual "le gana" se dice "por poco". */
export const MARGEN_POCO_PCT = 1;
/**
 * Clasificación del margen real (puntos porcentuales):
 *   ≥ 1 → "gana" · (0,1) → "gana_poco" · [−1,0] → "no_gana_poco" · < −1 → "no_gana"
 */
export function clasificarMargen(real) {
  const r = Math.round(real * 1e9) / 1e9; // evita ruido de punto flotante en los bordes
  if (r >= MARGEN_POCO_PCT) return "gana";
  if (r > 0) return "gana_poco";
  if (r >= -MARGEN_POCO_PCT) return "no_gana_poco";
  return "no_gana";
}
export function gananciaVsInflacion(b, inflacionPct) {
  inflacionPct = inflacionGlobal(inflacionPct);
  if (!(b.invertibles > 0)) return null;
  const nominal = ((b.ip * 12 + b.valorizacionAnual) / b.invertibles) * 100;
  const real = Math.round((nominal - inflacionPct) * 1e9) / 1e9;
  const clase = clasificarMargen(real);
  const x = Math.abs(real).toFixed(1).replace(".", ",");
  const txt = {
    gana: `Tu portafolio le gana a la inflación (+${x}% real al año)`,
    gana_poco: `Tu portafolio le gana a la inflación por poco (+${x}% real al año)`,
    no_gana_poco: `A tu portafolio le falta poco para ganarle a la inflación (${real < 0 ? "−" : ""}${x}% real)`,
    no_gana: `No le gana a la inflación (−${x}% real)`,
  }[clase];
  return {
    nominal, real, inflacion: inflacionPct, clase,
    leGana: clase === "gana" || clase === "gana_poco",
    porPoco: clase === "gana_poco" || clase === "no_gana_poco",
    mensaje: txt,
  };
}

export { fmtPctEs, fmtNumEs, fmtMilesEs, fmtTasaEs, parseDecimalEs } from "./formato.js";

/** Meses con plural correcto y coma es-CO: «1 mes», «1,3 meses», «3 meses». */
export function fmtMeses(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  const txt = v.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${txt} ${v === 1 ? "mes" : "meses"}`;
}
