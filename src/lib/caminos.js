/**
 * caminos.js — De los datos de cualquier usuario a sus caminos (21-oct-2026).
 *
 * El motor (planes.js) es genérico. Este archivo es el puente: toma lo que la
 * persona ya cargó en FINPATHIA (activos, ingresos, gastos, deudas) y su
 * perfil (inflación, supuestos, pensiones), arma el punto de partida y los
 * caminos. Cada camino es una TEORÍA DE CANASTAS con condiciones:
 *
 *   Protección   la vivienda propia + un colchón líquido (meses de gastos)
 *   Rentas       capital que paga la vida cada mes: CDT, renta fija, fondos
 *                de crédito, inmuebles que rentan
 *   Crecimiento  capital que se multiplica: acciones, ETF, cripto, fondos
 *                diversificados
 *   Uso          lo que ni renta ni crece: carro, lotes quietos
 *
 * Un camino dice cuánto va en cada canasta (rangos), a dónde va el excedente y
 * qué no se puede hacer (condiciones). Llamarse "Seguridad" obliga: si un
 * movimiento rompe una condición, el camino lo marca. Los tres por defecto
 * (Seguridad, Balance, Crecimiento) son solo tres juegos de rangos; el usuario
 * crea los suyos con la misma forma.
 *
 * Puro: sin React, sin storage. Todo en COP; montos mensuales salvo capital.
 */
import { simularCamino, estresar, cienMillones } from "./planes.js";
import { montoPromedioMensual, rangoEfectivo } from "./flowHelpers.js";
import { calcularBase } from "./metrics.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, "").trim();

/** Supuestos por defecto del perfil. La persona los cambia una vez y aplican a todo. */
export const PERFIL_DEFAULT = {
  inflacion: 5.0,            // % anual; se indexan gastos cada enero
  horizonteAnios: 10,
  coberturaMin: 120,         // % · entra / sale
  tasaCrecimiento: 12,       // % anual · bolsa, ETF, fondos diversificados
  tasaBtc: 20,
  tasaRentaEstable: 10,      // % anual · CDT, renta fija (pagado, no reinvertido)
  tasaCaja: 0,
  valorizacionInmueble: 5,   // % anual
  valorizacionLote: 6,
  depreciacionVehiculo: -10,
  arriendoPctMensual: 0.5,   // % del valor de la vivienda, si se vive arrendado
  pensiones: [],             // [{ ownerId, mes, monto, nombre }]
};

export const CANASTAS = ["proteccion", "rentas", "crecimiento", "uso"];
export const CANASTA_LABEL = { proteccion: "Protección", rentas: "Rentas", crecimiento: "Crecimiento", uso: "Uso" };
// 21-oct-2026 (Santiago: "no sé cómo explicar a un nuevo usuario qué es
// protección, rentas o crecimiento"). Es la segunda vez que pasa: el 3-ago fue
// con las canastas de Tu Norte y se resolvió con CANASTAS_EXPLICADAS
// (norte.js). Acá la palabra "canasta" se usaba sin definirse nunca, y la
// definición vivía solo en el comentario de cabecera de este archivo.
// La de Protección es la línea que ya se escribió en agosto.
export const CANASTA_CORTO = {
  proteccion: "Lo que te sostiene si todo sale mal",
  rentas: "Lo que paga tu vida cada mes",
  crecimiento: "Lo que se multiplica, pero hoy no te paga",
  uso: "Ni te paga ni crece: lo tienes porque lo usas",
};
/** Por qué una posición cayó en su canasta. Se deduce de lo que produce. */
export function porQueCanasta(p) {
  if (p.vivienda) return "vives aquí";
  switch (canastaDe(p)) {
    case "proteccion": return p.liquido ? "líquido, es tu colchón" : "lo guardas, no lo arriesgas";
    case "rentas": return "te paga cada mes";
    case "crecimiento": return "crece adentro, no te paga";
    default: return p.vehiculo ? "pierde valor con el uso" : p.valorizacion > 0 ? "solo valoriza" : "ni renta ni crece";
  }
}

const TIPOS_LIQUIDOS = new Set(["Cash", "CDT", "Renta Fija"]);
const TIPOS_CRECIMIENTO = new Set(["Acciones", "ETF", "Crypto"]);
const TIPOS_INMUEBLE = new Set(["Real Estate", "Local Comercial", "Bodega"]);
const esLote = (a) => /lote|terreno/i.test(String(a?.n || a?.nombre || ""));
const esViviendaNombre = (a) => /casa|apto|apartamento|vivo|vivienda|hogar/i.test(String(a?.n || a?.nombre || ""));

// ─── Ficha por activo ────────────────────────────────────────────────────────

/**
 * Ficha por defecto: papel (bolsillo del motor), tasa, qué parte se recibe,
 * valorización y si es la vivienda propia. `renta` = renta mensual ya cargada
 * como ingreso de ese activo.
 */
export function fichaPorDefecto(activo, perfil = PERFIL_DEFAULT, renta = 0) {
  const tp = activo?.tp || "";
  const tasaItem = num(activo?.tasa);
  if (TIPOS_LIQUIDOS.has(tp)) return { bolsillo: "sustento", tasa: tasaItem || (tp === "Cash" ? perfil.tasaCaja : perfil.tasaRentaEstable), pagaPct: 100, valorizacion: 0, liquido: true };
  if (tp === "Fondo de Inversión") { const estable = renta > 0 || tasaItem >= 15; return { bolsillo: estable ? "sustento" : "crecimiento", tasa: tasaItem || perfil.tasaCrecimiento, pagaPct: estable ? 100 : 0, valorizacion: 0 }; }
  if (tp === "Crypto") return { bolsillo: "crecimiento", tasa: tasaItem || perfil.tasaBtc, pagaPct: 0, valorizacion: 0 };
  if (TIPOS_CRECIMIENTO.has(tp)) return { bolsillo: "crecimiento", tasa: tasaItem || perfil.tasaCrecimiento, pagaPct: 0, valorizacion: 0 };
  if (TIPOS_INMUEBLE.has(tp)) {
    const lote = esLote(activo);
    return { bolsillo: renta > 0 ? "sustento" : "uso", tasa: 0, pagaPct: 100, valorizacion: num(activo?.valorizacionPct) || (lote ? perfil.valorizacionLote : perfil.valorizacionInmueble), inmueble: true, vivienda: renta <= 0 && !lote && esViviendaNombre(activo) };
  }
  if (tp === "Vehículo") return { bolsillo: "uso", tasa: 0, pagaPct: 0, valorizacion: perfil.depreciacionVehiculo, vehiculo: true };
  return { bolsillo: "uso", tasa: tasaItem, pagaPct: 0, valorizacion: 0 };
}

/**
 * Cuando el usuario elige la canasta de un activo, el papel en el motor se
 * deriva de ella: Protección = vivienda (inmueble) o colchón líquido;
 * Rentas = paga cada mes; Crecimiento = reinvierte; Uso = ni renta ni crece.
 */
export function conCanasta(ficha, perfil = PERFIL_DEFAULT, tipo = "") {
  const k = ficha.canasta;
  if (!k) return ficha;
  const inmueble = TIPOS_INMUEBLE.has(tipo) || ficha.inmueble;
  // 21-oct-2026 — Protección NO es "donde vivo". Poner un inmueble en
  // Protección lo marcaba como la vivienda, así que en la cuenta real dos
  // filas decían "Tu vivienda: protege, no produce" (Puerto madero y orlando)
  // y `medirCanastas` contaba dos casas donde hay una. Un segundo inmueble
  // puede estar en Protección sin que uno viva ahí. La vivienda se detecta
  // por su nombre o por el respaldo del mayor inmueble sin renta; acá solo se
  // conserva, no se inventa.
  if (k === "proteccion") return inmueble ? { ...ficha, vivienda: ficha.vivienda === true, bolsillo: "uso", tasa: 0, pagaPct: 0 } : { ...ficha, vivienda: false, liquido: true, bolsillo: "sustento", pagaPct: 100, valorizacion: 0 };
  if (k === "rentas") return { ...ficha, vivienda: false, bolsillo: "sustento", pagaPct: 100, tasa: inmueble ? 0 : (ficha.tasa > 0 ? ficha.tasa : perfil.tasaRentaEstable) };
  if (k === "crecimiento") return { ...ficha, vivienda: false, liquido: false, bolsillo: "crecimiento", pagaPct: 0, tasa: inmueble ? 0 : (ficha.tasa > 0 ? ficha.tasa : perfil.tasaCrecimiento) };
  return { ...ficha, vivienda: false, liquido: false, bolsillo: "uso", pagaPct: 0 };
}

/** Canasta de una posición. */
export function canastaDe(p) {
  if (p.canasta) return p.canasta; // el usuario decidió
  if (p.vivienda) return "proteccion";
  if (p.bolsillo === "crecimiento") return "crecimiento";
  if (p.bolsillo === "caja" || (p.liquido && !(p.tasa > 0))) return "proteccion"; // efectivo: colchón, nunca "quieto"
  if (p.bolsillo === "sustento" && (p.tasa > 0 || p.renta > 0 || p.inmueble)) return "rentas";
  return "uso";
}

// ─── Punto de partida ────────────────────────────────────────────────────────

const nombreActivo = (a) => a?.n || a?.nombre || "Activo";
const busca = (inv, texto, filtro) => { const f = norm(texto); if (!f) return null; return inv.find((x) => filtro(x) && (norm(nombreActivo(x)).includes(f) || f.includes(norm(nombreActivo(x))))) || null; };
const esArriendoCat = (i) => /^Arriendo|^Arrendamiento|^Rentas de capital/.test(String(i.categoria || ""));
const esRendimientoCat = (i) => /^Intereses|^Rendimiento|^Dividendos|^Utilidad FIC/.test(String(i.categoria || ""));
const esTrabajoCat = (i) => /^Salario|^Honorarios|^Cesant|^Negocio/.test(String(i.categoria || ""));

/**
 * Posiciones, flujos, deudas y gastos a partir del usuario.
 * `fichas` sobreescribe la ficha por activo: { [id]: {bolsillo, tasa, pagaPct, valorizacion, vivienda} }.
 */
export function baseDesdeUsuario(user = {}, perfil = PERFIL_DEFAULT, fichas = {}) {
  const trm = num(user.trm) || 4200;
  const fx = (x) => (x?.moneda === "USD" ? trm : 1);
  const inv = (user.inv || []).filter((a) => a && a.sim !== false);
  const ingresos = (user.ingresos || []).filter((i) => i && i.sim !== false);
  const deudas = (user.deu || user.deudas || []).filter((d) => d && d.sim !== false && num(d.mt) > 0);
  const base = calcularBase({ inv: user.inv, ingresos: user.ingresos, gastos: user.gas || user.gastos, deudas: user.deu || user.deudas, trm });

  // Renta mensual ya cargada por inmueble (activoId o por nombre)
  const rentaDeActivo = {};
  const activoDeArriendo = (i) => (i.activoId ? inv.find((x) => x.id === i.activoId) : null) || busca(inv, i.fuente || i.nombre, (x) => TIPOS_INMUEBLE.has(x.tp));
  const ventanaDeActivo = {};
  ingresos.filter(esArriendoCat).forEach((i) => { const a = activoDeArriendo(i); if (a) { rentaDeActivo[a.id] = (rentaDeActivo[a.id] || 0) + montoPromedioMensual(i) * fx(i); ventanaDeActivo[a.id] = ventanaDeActivo[a.id] || rangoEfectivo(i); } });

  const posiciones = inv.map((a) => {
    const renta = rentaDeActivo[a.id] || 0;
    const ficha = conCanasta({ ...fichaPorDefecto(a, perfil, renta), ...(fichas[a.id] || {}) }, perfil, a.tp);
    return { id: a.id, nombre: nombreActivo(a), capital: num(a.va) * fx(a), tipo: a.tp, owner: a.owner, renta, ventana: ventanaDeActivo[a.id], ...ficha, sale: fichas[a.id]?.estado === "sale" };
  });
  // Vivienda hay UNA. `esViviendaNombre` puede pegarle a varios ("casa X",
  // "casa Y"); si pasa, manda el de mayor capital y el resto deja de serlo.
  const casas = posiciones.filter((p) => p.vivienda).sort((a, b2) => b2.capital - a.capital);
  casas.slice(1).forEach((p) => { p.vivienda = false; });
  // Si ningún inmueble quedó como vivienda, el mayor inmueble sin renta lo es.
  if (!posiciones.some((p) => p.vivienda)) { const cand = posiciones.filter((p) => p.inmueble && p.bolsillo === "uso" && !esLote(p)).sort((a, b) => b.capital - a.capital)[0]; if (cand && fichas[cand.id]?.vivienda !== false) cand.vivienda = true; }

  const flujos = [];
  const usados = new Set();
  ingresos.forEach((i) => {
    const m = montoPromedioMensual(i) * fx(i);
    if (!(m > 0)) return;
    if (esArriendoCat(i)) { flujos.push({ id: `ing_${i.id}`, nombre: i.nombre || "Arriendo", tipo: "ingreso", monto: m, posicionId: activoDeArriendo(i)?.id, indexa: true, origenId: i.id }); return; }
    const cap = num(i.capital) * fx(i), tasa = num(i.tasa);
    if (esRendimientoCat(i) && cap > 0 && tasa > 0) {
      // 21-oct-2026 — La posición se armaba con `capital × tasa NOMINAL`, que
      // ignora la vigencia que la persona cargó. Un ingreso de $122,5M que solo
      // corre en diciembre aparecía como $122,5M TODOS los meses. En la cuenta
      // real eran siete renglones y $193,8M/mes de más ($258,1M mostrados
      // contra $64,2M que de verdad entran).
      //
      // Ahora manda la plata, no la tasa escrita: la tasa de la posición se
      // deriva del monto que de verdad entra (`m`, que ya pasó por
      // montoPromedioMensual y respeta vigencia, frecuencia y montos por mes).
      // Se guarda `tasaDeclarada` para poder decirlo en pantalla en vez de
      // cambiar el número a espaldas de quien lo escribió.
      // Solo manda cuando de verdad cambia algo: una diferencia de centésimas
      // (un monto redondeado a mano) no tiene por qué reescribir la tasa que
      // la persona escribió ni ensuciar la pantalla con 9,996%.
      // 21-oct-2026 — "hasta cuando" era la unica celda de la rejilla sin campo
      // (qué es · cuándo · cuánto vale · cuánto renta). La ventana ya existe en
      // el ingreso; se arrastra a la posición para poder decirla en la fila en
      // vez de dejar al usuario adivinando por qué el monto bajó.
      const ventana = rangoEfectivo(i);
      const difiere = Math.abs((m * 12 / cap) * 100 - tasa) > 0.1;
      const tasaReal = difiere ? (m * 12 / cap) * 100 : tasa;
      const declarada = difiere ? tasa : null;
      // Rendimiento de un capital: si el activo ya está en Patrimonio, se usa su ficha real
      const f = norm(i.fuente || i.nombre);
      const a = inv.find((x) => !TIPOS_INMUEBLE.has(x.tp) && !usados.has(x.id) && ((f && (norm(nombreActivo(x)).includes(f) || f.includes(norm(nombreActivo(x))))) || Math.abs(num(x.va) * fx(x) - cap) / Math.max(1, cap) < 0.02));
      if (a) { usados.add(a.id); const p = posiciones.find((x) => x.id === a.id); if (p && !fichas[a.id]) { p.bolsillo = "sustento"; p.tasa = tasaReal; p.tasaDeclarada = declarada; p.pagaPct = 100; p.valorizacion = 0; p.ventana = ventana; } return; }
      posiciones.push({ id: `cap_${i.id}`, nombre: i.nombre || "Inversión", bolsillo: "sustento", capital: cap, tasa: tasaReal, tasaDeclarada: declarada, pagaPct: 100, valorizacion: 0, tipo: "Capital", owner: i.owner, soloIngreso: true, ventana, ...(fichas[`cap_${i.id}`] || {}) });
      return;
    }
    const trabajo = esTrabajoCat(i);
    flujos.push({ id: `ing_${i.id}`, nombre: i.nombre || i.categoria || "Ingreso", tipo: "ingreso", monto: m, indexa: trabajo, trabajo, origenId: i.id, owner: i.owner });
  });
  // Gastos de vida por categoría (sin cuotas), para que cada uno pueda
  // terminar o cambiar en el tiempo. La base única (base.g) ya netea los
  // costos de los inmuebles arrendados y suma seguridad social e impuesto;
  // lo que no cae en una categoría visible va a "Otros gastos" para que el
  // total sea exactamente base.g.
  const porCat = {};
  Object.entries(user.gas || user.gastos || {}).forEach(([cat, items]) => (items || []).forEach((g) => {
    if (!g || g.sim === false || g.activoId || cat === "Inmueble arrendado") return;
    porCat[cat] = (porCat[cat] || 0) + montoPromedioMensual(g) * fx(g);
  }));
  let sumaCats = 0;
  Object.entries(porCat).filter(([, m]) => m > 0).forEach(([cat, m]) => { sumaCats += m; flujos.push({ id: `gas_${norm(cat).replace(/ /g, "_")}`, nombre: `Gastos · ${cat}`, tipo: "gasto", monto: m, indexa: true, categoria: cat }); });
  const resto = base.g - sumaCats;
  if (resto > 1) flujos.push({ id: "gastos_otros", nombre: "Otros gastos (impuestos, costos netos de inmuebles)", tipo: "gasto", monto: resto, indexa: true });
  else if (resto < -1) { const mayor = flujos.filter((f) => f.tipo === "gasto").sort((a, b) => b.monto - a.monto)[0]; if (mayor) mayor.monto = Math.max(0, mayor.monto + resto); }

  const deudasCfg = deudas.map((d) => ({ id: d.id, nombre: d.n || d.nombre || "Deuda", saldo: num(d.mt) * fx(d), tasa: num(d.ts), cuota: num(d.pg) * fx(d), hipoteca: d.tp === "mortgage", hastaMes: d.hastaMes ? num(d.hastaMes) - 1 : undefined, pagar: !!fichas[`deu_${d.id}`]?.pagar }));

  // Lo decidido en HOY, común a todos los escenarios: lo que sale del plan se
  // vende hoy y libera plata; las deudas marcadas se pagan con eso.
  const costoVenta = num(fichas.__costoVentaPct);
  const liberado = posiciones.filter((p) => p.sale).reduce((s, p) => s + p.capital * (1 - costoVenta / 100), 0);
  const pagado = deudasCfg.filter((d) => d.pagar).reduce((s, d) => s + d.saldo, 0);
  const hoy = { liberado, pagado, porDesplegar: liberado - pagado, costoVentaPct: costoVenta, cuotasQueSalen: deudasCfg.filter((d) => d.pagar).reduce((s, d) => s + d.cuota, 0) };

  return { posiciones, flujos, deudas: deudasCfg, caja: 0, gastosMes: base.g + base.sd, base, trm, hoy };
}

/** Movimientos de mes 0 que vienen de HOY (comunes a todos los escenarios). */
export function movimientosHoy(baseCfg) {
  const out = [];
  const costo = num(baseCfg.hoy?.costoVentaPct);
  baseCfg.posiciones.filter((p) => p.sale && p.capital > 0).forEach((p) => out.push({ mes: 0, tipo: "vender", posicionId: p.id, netoPct: 100 - costo, hoy: true }));
  baseCfg.deudas.filter((d) => d.pagar).forEach((d) => out.push({ mes: 0, tipo: "pagar_deuda", deudaId: d.id, origen: [{ posicionId: "caja", monto: d.saldo }], hoy: true }));
  return out;
}

// ─── Canastas: medir ─────────────────────────────────────────────────────────

/** Reparto por canasta de un conjunto de posiciones (+ caja). */
export function medirCanastas(posiciones, caja = 0, capitalDe = (p) => p.capital) {
  const c = { proteccion: 0, rentas: 0, crecimiento: 0, uso: 0, colchon: caja, vivienda: 0 };
  posiciones.forEach((p) => {
    const k = Math.max(0, capitalDe(p));
    c[canastaDe(p)] += k;
    if (p.vivienda) c.vivienda += k;
    if (p.liquido || p.bolsillo === "caja") c.colchon += k;
  });
  c.proteccion += caja;
  // Los rangos se miden sobre lo MOVIBLE: rentas financieras + crecimiento.
  // Los inmuebles que rentan son rentas, pero ningún camino pide venderlos
  // para cuadrar un porcentaje; se muestran aparte (rentasInmuebles).
  c.rentasInmuebles = posiciones.filter((p) => canastaDe(p) === "rentas" && p.inmueble).reduce((s, p) => s + Math.max(0, capitalDe(p)), 0);
  c.rentasMovibles = c.rentas - c.rentasInmuebles;
  const invertible = c.rentasMovibles + c.crecimiento;
  c.rentasPct = invertible > 0 ? (c.rentasMovibles / invertible) * 100 : 0;
  c.crecimientoPct = invertible > 0 ? (c.crecimiento / invertible) * 100 : 0;
  c.invertible = invertible;
  c.total = c.proteccion + c.rentas + c.crecimiento + c.uso;
  return c;
}

// ─── Los caminos ─────────────────────────────────────────────────────────────

/**
 * Forma de un camino. `canastas` son rangos sobre el capital invertible
 * (rentas + crecimiento); `colchonMeses` sobre los gastos del mes;
 * `vivienda`: "propia" | "arrendado" | "indiferente". `excedente` reparte lo
 * que sobra cada mes por canasta. `condiciones`: lo que el camino no permite.
 */
export const CAMINOS_BASE = [
  { id: "seguridad", nombre: "Seguridad", color: "#3b82f6",
    tesis: "Todo en rentas estables que pagan la vida, y la vivienda como activo de protección: no se vende. La deuda cara se paga primero con lo líquido.",
    canastas: { rentas: { min: 85 }, crecimiento: { max: 15 }, colchonMeses: 24, vivienda: "propia" },
    excedente: [{ canasta: "rentas", pct: 100 }],
    condiciones: ["no_vender_vivienda", "sin_deuda_cara", "no_apalancar"] },
  { id: "balance", nombre: "Balance", color: "#22c55e",
    tesis: "Protección más rentas estables más crecimiento: la vida cubierta con margen y una parte multiplicando. Lo que sobra se reparte.",
    canastas: { rentas: { min: 50 }, crecimiento: { min: 25, max: 50 }, colchonMeses: 12, vivienda: "indiferente" },
    excedente: [{ canasta: "rentas", pct: 50 }, { canasta: "crecimiento", pct: 50 }],
    condiciones: ["sin_deuda_cara"] },
  { id: "crecimiento", nombre: "Crecimiento", color: "#f97316",
    tesis: "Todo produce: acciones, cripto, fondos diversificados e inmuebles que rentan. Se vive arrendado; lo que no produce se vende y se pone a trabajar.",
    canastas: { rentas: { max: 40 }, crecimiento: { min: 60 }, colchonMeses: 6, vivienda: "arrendado" },
    excedente: [{ canasta: "crecimiento", pct: 100 }],
    condiciones: ["todo_produce"] },
];

export const CONDICION_LABEL = {
  no_vender_vivienda: "La vivienda no se vende",
  sin_deuda_cara: "Sin deuda por encima del 18% anual",
  no_apalancar: "No se toma deuda para invertir",
  todo_produce: "Nada quieto: lo que no renta ni crece se vende",
};

const DEUDA_CARA = 18;
const mayor = (arr) => [...arr].sort((a, b) => b.capital - a.capital)[0] || null;

/** Posición destino de una canasta; si no existe, se crea una nueva en cero. */
function destinoDe(canasta, pos, perfil) {
  if (canasta === "crecimiento") {
    const p = mayor(pos.filter((x) => canastaDe(x) === "crecimiento" && x.tipo !== "Crypto"));
    if (p) return p;
    const n = { id: "nuevo_crecimiento", nombre: "Portafolio de crecimiento (nuevo)", bolsillo: "crecimiento", capital: 0, tasa: perfil.tasaCrecimiento, pagaPct: 0, valorizacion: 0, tipo: "ETF", nuevo: true };
    pos.push(n); return n;
  }
  if (canasta === "rentas") {
    const p = mayor(pos.filter((x) => canastaDe(x) === "rentas" && x.tasa > 0 && !x.inmueble));
    if (p) return p;
    const n = { id: "nuevo_rentas", nombre: "Renta estable (nueva)", bolsillo: "sustento", capital: 0, tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, tipo: "CDT", liquido: true, nuevo: true };
    pos.push(n); return n;
  }
  return { id: "caja" };
}

/**
 * Saca `monto` de las posiciones dadas (en el orden recibido) como lista de
 * orígenes. `reserva` es cuánto líquido debe quedar en total (el colchón).
 */
function origenes(posiciones, monto, reserva = 0) {
  const out = []; let falta = monto;
  let liquidoTotal = posiciones.filter((p) => p.liquido).reduce((s, p) => s + p.capital, 0);
  for (const p of posiciones) {
    if (falta <= 0) break;
    let disponible = p.capital;
    if (p.liquido && reserva > 0) disponible = Math.max(0, Math.min(p.capital, liquidoTotal - reserva));
    const t = Math.min(disponible, falta);
    if (t > 0) { out.push({ posicionId: p.id, monto: t }); p.capital -= t; falta -= t; if (p.liquido) liquidoTotal -= t; }
  }
  return { out, conseguido: monto - falta };
}
const porCapital = (arr) => [...arr].sort((a, b) => b.capital - a.capital);
/** Rentas de las que se puede sacar: primero lo líquido que sobra del colchón (rinde menos), después de menor a mayor tasa. */
const rentasMovibles = (pos) => [...porCapital(pos.filter((p) => canastaDe(p) === "rentas" && p.liquido)), ...pos.filter((p) => canastaDe(p) === "rentas" && !p.inmueble && !p.liquido).sort((a, b) => a.tasa - b.tasa)];

const M = (x) => { const a = Math.abs(Number(x) || 0); return (x < 0 ? "−" : "") + (a >= 1e9 ? "$" + (a / 1e9).toFixed(1).replace(".0", "").replace(".", ",") + " mil M" : "$" + Math.round(a / 1e6).toLocaleString("es-CO") + " M"); };

/**
 * Ajuste inicial: los movimientos de mes 0 que llevan el punto de partida a
 * los rangos del camino. Devuelve { posiciones, movimientos, notas }.
 * Trabaja sobre una copia; el motor aplica los movimientos de verdad.
 */
export function ajustarAlCamino(baseCfg, camino, perfil = PERFIL_DEFAULT) {
  const pos = baseCfg.posiciones.map((p) => ({ ...p }));
  const movimientos = [], notas = [];
  const C = camino.canastas || {};
  const cond = new Set(camino.condiciones || []);
  const gastosMes = num(baseCfg.gastosMes);
  const colchonMeta = num(C.colchonMeses) * gastosMes;

  // 0) Lo decidido en HOY: lo que sale ya está vendido y las deudas marcadas
  //    pagadas (eso lo aplica el motor); aquí queda la plata por desplegar.
  let caja = Math.max(0, num(baseCfg.hoy?.porDesplegar));
  pos.filter((p) => p.sale).forEach((p) => { p.capital = 0; });
  const deudasVivas = baseCfg.deudas.filter((d) => !d.pagar);
  const desdeCaja = (destino, monto, texto) => {
    const t = Math.min(caja, Math.max(0, monto)); if (t <= 0) return 0;
    movimientos.push({ mes: 0, tipo: "aportar", posicionId: destino.id, monto: t, origen: [{ posicionId: "caja", monto: t }] });
    destino.capital += t; caja -= t; if (texto) notas.push(texto(t)); return t;
  };
  const aportar = (destino, lista, monto, texto) => {
    const { out, conseguido } = origenes(lista, monto, colchonMeta);
    if (conseguido <= 0) return 0;
    movimientos.push({ mes: 0, tipo: "aportar", posicionId: destino.id, monto: conseguido, origen: out });
    destino.capital += conseguido;
    if (texto) notas.push(texto(conseguido));
    return conseguido;
  };

  // 1) Vivienda
  const vivienda = pos.find((p) => p.vivienda);
  if (C.vivienda === "arrendado" && vivienda && vivienda.capital > 0) {
    movimientos.push({ mes: 0, tipo: "vender", posicionId: vivienda.id });
    const arriendo = vivienda.capital * num(perfil.arriendoPctMensual) / 100;
    movimientos.push({ mes: 0, tipo: "flujo_inicia", flujo: { id: "arriendo_vivienda", nombre: "Arriendo de vivienda", tipo: "gasto", monto: arriendo, indexa: true } });
    let libre = vivienda.capital;
    const palabras = norm(vivienda.nombre).split(" ").filter((w) => w.length > 3 && !/^(casa|apto|apartamento|vivienda|donde|vivo)$/.test(w));
    // La hipoteca de la vivienda: la que comparte nombre con ella; si hay una sola y no es claramente de otro inmueble, esa.
    const hipotecas = baseCfg.deudas.filter((d) => d.hipoteca);
    const palabrasDe = (n) => norm(n).split(" ").filter((w) => w.length > 3 && !/^(casa|apto|apartamento|vivienda|donde|vivo|hipoteca|credito|crédito)$/.test(w));
    const deOtro = (d) => pos.some((p) => p.inmueble && p.id !== vivienda.id && palabrasDe(p.nombre).some((w) => norm(d.nombre).includes(w)));
    const hip = hipotecas.find((d) => palabras.some((w) => norm(d.nombre).includes(w))) || (hipotecas.length === 1 && !deOtro(hipotecas[0]) ? hipotecas[0] : null);
    if (hip) { movimientos.push({ mes: 0, tipo: "pagar_deuda", deudaId: hip.id, origen: [{ posicionId: "caja", monto: hip.saldo }] }); libre -= hip.saldo; }
    const d = destinoDe("crecimiento", pos, perfil);
    movimientos.push({ mes: 0, tipo: "aportar", posicionId: d.id, monto: Math.max(0, libre), origen: [{ posicionId: "caja", monto: Math.max(0, libre) }] });
    d.capital += Math.max(0, libre);
    vivienda.capital = 0;
    notas.push(`Se vende ${vivienda.nombre}${hip ? `, se paga ${hip.nombre}` : ""} y ${M(Math.max(0, libre))} van a ${d.nombre}. Se vive arrendado: ${M(arriendo)} al mes.`);
  }
  if (C.vivienda === "propia" && !vivienda) notas.push("Este camino protege la vivienda propia y hoy no hay una: cuando decidas cuál, agrégala como movimiento de compra.");

  // 2) Todo produce: lo quieto (lotes, inmuebles sin renta; no la vivienda, no el carro) se vende a crecimiento
  if (cond.has("todo_produce")) {
    pos.filter((p) => canastaDe(p) === "uso" && !p.vehiculo && !p.vivienda && p.capital > 0).forEach((p) => {
      const d = destinoDe("crecimiento", pos, perfil);
      movimientos.push({ mes: 0, tipo: "vender", posicionId: p.id });
      movimientos.push({ mes: 0, tipo: "aportar", posicionId: d.id, monto: p.capital, origen: [{ posicionId: "caja", monto: p.capital }] });
      notas.push(`Se vende ${p.nombre} (no produce): ${M(p.capital)} a ${d.nombre}.`);
      d.capital += p.capital; p.capital = 0;
    });
  }

  // 3) Deuda cara
  if (cond.has("sin_deuda_cara")) {
    deudasVivas.filter((d) => d.tasa >= DEUDA_CARA).forEach((d) => {
      // Primero la plata liberada en HOY; después lo líquido (sin tocar el colchón), crecimiento y el resto de rentas
      const deCaja = Math.min(caja, d.saldo);
      const fuentes = [...porCapital(pos.filter((p) => p.liquido && !p.nuevo)), ...porCapital(pos.filter((p) => canastaDe(p) === "crecimiento" && !p.nuevo)), ...porCapital(pos.filter((p) => canastaDe(p) === "rentas" && !p.liquido && !p.inmueble && !p.nuevo))];
      const { out, conseguido } = origenes(fuentes, d.saldo - deCaja, colchonMeta);
      const total = deCaja + conseguido;
      if (total > 0) { caja -= deCaja; movimientos.push({ mes: 0, tipo: "pagar_deuda", deudaId: d.id, origen: [...(deCaja > 0 ? [{ posicionId: "caja", monto: deCaja }] : []), ...out] }); notas.push(`Se paga ${d.nombre} (${d.tasa}%) con ${M(total)}.`); }
      else notas.push(`${d.nombre} está al ${d.tasa}% y no hay con qué pagarla hoy.`);
    });
  }

  // 3b) Colchón: lo liberado en HOY lo llena primero
  if (colchonMeta > 0 && caja > 0) { const m0 = medirCanastas(pos, 0); if (m0.colchon < colchonMeta) desdeCaja(destinoDe("rentas", pos, perfil), colchonMeta - m0.colchon, (x) => `${M(x)} de lo liberado van al colchón líquido (meta ${C.colchonMeses} meses de gastos).`); }
  // 3c) El resto de lo liberado se despliega como reparte el camino su excedente
  if (caja > 0) {
    const reparto = (camino.excedente || []).filter((e) => num(e.pct) > 0);
    const total = caja;
    reparto.forEach((e) => { const d = destinoDe(e.canasta, pos, perfil); desdeCaja(d, total * num(e.pct) / 100, (x) => `${M(x)} de lo liberado van a ${d.nombre}${d.tasa > 0 ? ` al ${d.tasa}%` : ""}.`); });
  }

  // 4) Rangos rentas / crecimiento sobre lo invertible
  const med = () => medirCanastas(pos, 0);
  let m = med();
  const crecMax = C.crecimiento?.max, crecMin = C.crecimiento?.min, rentMin = C.rentas?.min, rentMax = C.rentas?.max;
  const deCrecimiento = () => porCapital(pos.filter((p) => canastaDe(p) === "crecimiento"));
  if (crecMax != null && m.crecimientoPct > crecMax) { aportar(destinoDe("rentas", pos, perfil), deCrecimiento(), m.crecimiento - m.invertible * crecMax / 100, (x) => `${M(x)} salen de crecimiento a rentas estables (máximo ${crecMax}% en crecimiento).`); m = med(); }
  if (rentMin != null && m.rentasPct < rentMin) { aportar(destinoDe("rentas", pos, perfil), deCrecimiento(), m.invertible * rentMin / 100 - m.rentasMovibles, (x) => `${M(x)} pasan a rentas (mínimo ${rentMin}%).`); m = med(); }
  if (crecMin != null && m.crecimientoPct < crecMin) { aportar(destinoDe("crecimiento", pos, perfil), rentasMovibles(pos), m.invertible * crecMin / 100 - m.crecimiento, (x) => `${M(x)} pasan de rentas a crecimiento (mínimo ${crecMin}%).`); m = med(); }
  if (rentMax != null && m.rentasPct > rentMax) { aportar(destinoDe("crecimiento", pos, perfil), rentasMovibles(pos), m.rentasMovibles - m.invertible * rentMax / 100, (x) => `${M(x)} salen de rentas a crecimiento (máximo ${rentMax}% en rentas).`); m = med(); }

  // 5) Colchón líquido (meses de gastos): se llena desde crecimiento salvo que el camino exija crecimiento mínimo
  if (colchonMeta > 0 && m.colchon < colchonMeta) {
    const falta = colchonMeta - m.colchon;
    const fuentes = crecMin != null ? [] : deCrecimiento();
    const got = fuentes.length ? aportar(destinoDe("rentas", pos, perfil), fuentes, falta, (x) => `${M(x)} van al colchón líquido (meta ${C.colchonMeses} meses de gastos).`) : 0;
    if (got < falta) notas.push(`Colchón: hay ${Math.round(gastosMes > 0 ? m.colchon / gastosMes : 0)} meses de gastos líquidos y el camino pide ${C.colchonMeses}. Lo que sobra cada mes lo va llenando.`);
  }

  return { posiciones: pos, movimientos, notas };
}

/** Movimientos comunes del perfil: pensiones. */
function movimientosPerfil(perfil) {
  return (perfil.pensiones || []).filter((p) => num(p.monto) > 0).map((p, k) => ({ mes: Math.max(0, num(p.mes)), tipo: "flujo_inicia", flujo: { id: `pension_${k}`, nombre: p.nombre || "Pensión", tipo: "ingreso", monto: num(p.monto), indexa: true } }));
}

/**
 * Configuración completa de un camino para simularCamino: ajuste inicial +
 * movimientos propios del usuario + reglas derivadas de las canastas.
 */
export function configurarCamino(baseCfg, camino, perfil = PERFIL_DEFAULT) {
  const H = (num(perfil.horizonteAnios) || 10) * 12;
  const ajuste = ajustarAlCamino(baseCfg, camino, perfil);
  const pos = ajuste.posiciones;
  const C = camino.canastas || {};
  const excedente = (camino.excedente || []).map((e) => ({ posicionId: destinoDe(e.canasta, pos, perfil).id, pct: num(e.pct) }));
  const deficitDesde = pos.filter((p) => canastaDe(p) === "rentas" && !p.inmueble).sort((a, b) => (b.liquido ? 1 : 0) - (a.liquido ? 1 : 0)).map((p) => p.id);
  // Colchón: la mayor posición líquida (o una nueva) se llena con el excedente hasta la meta
  let colchon = null;
  if (num(C.colchonMeses) > 0) {
    let liq = mayor(pos.filter((p) => p.liquido));
    if (!liq) { liq = { id: "nuevo_colchon", nombre: "Colchón líquido (nuevo)", bolsillo: "sustento", capital: 0, tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, tipo: "CDT", liquido: true, nuevo: true }; pos.push(liq); }
    const otrosLiquidos = pos.filter((p) => p.liquido && p.id !== liq.id).reduce((s, p) => s + p.capital, 0);
    colchon = { posicionId: liq.id, meta: Math.max(0, num(C.colchonMeses) * num(baseCfg.gastosMes) - otrosLiquidos) };
  }
  // Rebalanceo anual entre crecimiento (A) y rentas movibles (B) para seguir en rango
  const idsCrec = pos.filter((p) => canastaDe(p) === "crecimiento").map((p) => p.id);
  const idsRentas = pos.filter((p) => canastaDe(p) === "rentas" && !p.inmueble).map((p) => p.id);
  const rebalanceo = (C.crecimiento?.max != null || C.crecimiento?.min != null) && idsCrec.length && idsRentas.length
    ? { a: { ids: idsCrec, destinoId: destinoDe("crecimiento", pos, perfil).id }, b: { ids: idsRentas, destinoId: destinoDe("rentas", pos, perfil).id }, aMin: C.crecimiento?.min ?? null, aMax: C.crecimiento?.max ?? null,
        aMeta: C.crecimiento?.min != null && C.crecimiento?.max != null ? (num(C.crecimiento.min) + num(C.crecimiento.max)) / 2 : C.crecimiento?.max != null ? Math.max(0, num(C.crecimiento.max) - 5) : Math.min(100, num(C.crecimiento.min) + 5) }
    : null;
  // El motor recibe las posiciones ORIGINALES (más las nuevas en cero): los movimientos de ajuste mueven el capital.
  const originales = baseCfg.posiciones.map((p) => ({ ...p }));
  pos.filter((p) => p.nuevo).forEach((p) => originales.push({ ...p, capital: 0 }));
  const propios = (camino.movimientos || []).map((m) => ({ ...m, propio: true }));
  return {
    ...camino,
    ajuste,
    cfg: {
      meses: H, caja: baseCfg.caja, posiciones: originales, flujos: baseCfg.flujos, deudas: baseCfg.deudas,
      movimientos: [...movimientosHoy(baseCfg), ...ajuste.movimientos, ...movimientosPerfil(perfil), ...propios],
      reglas: { excedente, deficitDesde, colchon, rebalanceo, inflacion: num(perfil.inflacion), indexarGastos: true, indexarSustento: false, coberturaMin: num(perfil.coberturaMin) || 120 },
    },
  };
}

/** Un camino personalizado parte de la misma forma; nombre y rangos libres. */
export function nuevoCamino(parcial = {}) {
  const plantilla = CAMINOS_BASE[1];
  return { id: parcial.id || `camino_${Date.now()}`, nombre: parcial.nombre || "Mi camino", color: parcial.color || "#a855f7", tesis: parcial.tesis || "", canastas: { ...plantilla.canastas, ...(parcial.canastas || {}) }, excedente: parcial.excedente || plantilla.excedente, condiciones: parcial.condiciones || [], movimientos: parcial.movimientos || [], propio: true };
}


// ─── Escenarios: el despliegue concreto ──────────────────────────────────────
//
// Un escenario es lo que la persona DECIDE, en sus palabras (así está armado
// el plan patrimonial que inspiró esto): qué vendo, qué pago, a dónde va cada
// peso y con qué regla, qué pasa después en el tiempo, y a dónde va lo que
// sobra cada mes. Los tres caminos base son plantillas que llenan esto; la
// persona lo edita o arma el suyo desde cero.
//
//   ventas:     [{posicionId, monto?}]            todo el activo, o una parte
//   pagos:      [deudaId]                         deudas que se pagan con lo liberado
//   despliegue: [{id, destinoId?, nombre, canasta, capital, tasa, pagaPct,
//                 valorizacion, renta, rentaDesde, regla}]
//   eventos:    [movimiento de planes.js]         lo que pasa después (año X: …)
//   excedente:  [{canasta, pct}]                  a dónde va lo que sobra cada mes
//   colchonMeses, canastas, condiciones           opcionales (vigilancia)

const uid = (pref) => `${pref}_${Math.random().toString(36).slice(2, 8)}`;

export function escenarioVacio(parcial = {}) {
  return { id: parcial.id || uid("esc"), nombre: parcial.nombre || "Mi escenario", tesis: parcial.tesis || "", color: parcial.color || "#a855f7", plantilla: parcial.plantilla || null,
    ventas: parcial.ventas || [], pagos: parcial.pagos || [], despliegue: parcial.despliegue || [], eventos: parcial.eventos || [],
    excedente: parcial.excedente || [{ canasta: "rentas", pct: 50 }, { canasta: "crecimiento", pct: 50 }], colchonMeses: parcial.colchonMeses ?? 6,
    canastas: parcial.canastas || null, condiciones: parcial.condiciones || [], propio: true };
}

/** Papel en el motor a partir de la canasta elegida para un destino nuevo. */
function papelDeCanasta(canasta, item, perfil) {
  if (canasta === "crecimiento") return { bolsillo: "crecimiento", pagaPct: 0, tasa: num(item.tasa) || perfil.tasaCrecimiento, valorizacion: num(item.valorizacion) };
  if (canasta === "rentas") return { bolsillo: "sustento", pagaPct: item.pagaPct == null ? 100 : num(item.pagaPct), tasa: num(item.tasa), valorizacion: num(item.valorizacion) };
  if (canasta === "proteccion") return { bolsillo: "uso", pagaPct: 0, tasa: 0, valorizacion: num(item.valorizacion), vivienda: true };
  return { bolsillo: "uso", pagaPct: 0, tasa: 0, valorizacion: num(item.valorizacion) };
}

/**
 * Plantilla → escenario editable: corre el ajuste del camino y lo traduce a
 * ventas, pagos y despliegue con nombres, para que la persona lo vea y lo cambie.
 */
export function escenarioDesdeCamino(baseCfg, camino, perfil = PERFIL_DEFAULT) {
  const aj = ajustarAlCamino(baseCfg, camino, perfil);
  const byId = Object.fromEntries(aj.posiciones.map((p) => [p.id, p]));
  const esc = escenarioVacio({ id: camino.id, nombre: camino.nombre, tesis: camino.tesis, color: camino.color, plantilla: camino.id, excedente: camino.excedente, colchonMeses: camino.canastas?.colchonMeses ?? 6, canastas: camino.canastas || null, condiciones: camino.condiciones || [] });
  esc.propio = false;
  const venta = (posicionId, monto) => {
    if (posicionId === "caja" || !posicionId) return;
    const v = esc.ventas.find((x) => x.posicionId === posicionId);
    if (!v) esc.ventas.push({ posicionId, monto: monto == null ? null : monto });
    else if (v.monto != null && monto != null) v.monto += monto; else v.monto = null;
  };
  const desplegar = (destinoId, capital) => {
    const d = byId[destinoId]; if (!d) return;
    const item = esc.despliegue.find((x) => (d.nuevo ? x.nombre === d.nombre && !x.destinoId : x.destinoId === destinoId));
    if (item) { item.capital += capital; return; }
    esc.despliegue.push(d.nuevo ? { id: uid("d"), destinoId: null, nombre: d.nombre.replace(" (nueva)", "").replace(" (nuevo)", ""), canasta: canastaDe(d), capital, tasa: d.tasa, pagaPct: d.pagaPct, valorizacion: d.valorizacion, regla: d.pagaPct === 100 ? "Paga el 100% del rendimiento cada mes" : "Todo se reinvierte" }
      : { id: uid("d"), destinoId, nombre: d.nombre, canasta: canastaDe(d), capital, tasa: d.tasa, pagaPct: d.pagaPct, valorizacion: d.valorizacion, regla: d.pagaPct === 100 ? "Paga el 100% del rendimiento cada mes" : d.bolsillo === "crecimiento" ? "Todo se reinvierte" : "" });
  };
  aj.movimientos.forEach((m) => {
    if (m.tipo === "vender") venta(m.posicionId, null);
    else if (m.tipo === "aportar") { (m.origen || []).forEach((o) => venta(o.posicionId, o.monto)); desplegar(m.posicionId, num(m.monto)); }
    else if (m.tipo === "pagar_deuda") { (m.origen || []).forEach((o) => venta(o.posicionId, o.monto)); if (!esc.pagos.includes(m.deudaId)) esc.pagos.push(m.deudaId); }
    else if (m.tipo === "flujo_inicia" || m.tipo === "comprar") esc.eventos.push({ ...m, id: uid("ev"), plantilla: true });
  });
  esc.notas = aj.notas;
  return esc;
}

/** Cuánto libera, paga y asigna un escenario; lo que queda sin asignar va a caja. */
export function liquidezEscenario(baseCfg, esc) {
  const byId = Object.fromEntries(baseCfg.posiciones.map((p) => [p.id, p]));
  const liberadoHoy = num(baseCfg.hoy?.liberado), pagadoHoy = num(baseCfg.hoy?.pagado);
  const liberado = liberadoHoy + (esc.ventas || []).reduce((s, v) => { const p = byId[v.posicionId]; if (!p || p.sale) return s; return s + (v.monto != null ? Math.min(num(v.monto), p.capital) : p.capital * (1 - num(esc.costoVentaPct || 0) / 100)); }, 0);
  const pagado = pagadoHoy + (esc.pagos || []).reduce((s, id) => { const d = baseCfg.deudas.find((x) => x.id === id); return s + (d && !d.pagar ? d.saldo : 0); }, 0);
  const asignado = (esc.despliegue || []).reduce((s, d) => s + num(d.capital), 0);
  return { liberado, pagado, asignado, porAsignar: liberado - pagado - asignado, liberadoHoy, pagadoHoy };
}

/** Escenario → configuración para simularCamino. */
export function configurarEscenario(baseCfg, esc, perfil = PERFIL_DEFAULT) {
  const H = (num(perfil.horizonteAnios) || 10) * 12;
  const byId = Object.fromEntries(baseCfg.posiciones.map((p) => [p.id, p]));
  const posiciones = baseCfg.posiciones.map((p) => ({ ...p }));
  const movimientos = [];
  // 1) Ventas (hoy)
  (esc.ventas || []).forEach((v) => {
    const p = byId[v.posicionId]; if (!p || p.sale) return;
    if (v.monto != null) movimientos.push({ mes: 0, tipo: "retirar", posicionId: p.id, monto: Math.min(num(v.monto), p.capital) });
    else movimientos.push({ mes: 0, tipo: "vender", posicionId: p.id, netoPct: 100 - num(esc.costoVentaPct || 0) });
  });
  // 2) Pagos (hoy, con lo liberado)
  (esc.pagos || []).forEach((id) => { const d = baseCfg.deudas.find((x) => x.id === id); if (d && !d.pagar) movimientos.push({ mes: 0, tipo: "pagar_deuda", deudaId: id, origen: [{ posicionId: "caja", monto: d.saldo }] }); });
  // 3) Despliegue (hoy)
  (esc.despliegue || []).forEach((d) => {
    const cap = num(d.capital); if (cap <= 0) return;
    if (d.destinoId && byId[d.destinoId]) { movimientos.push({ mes: 0, tipo: "aportar", posicionId: d.destinoId, monto: cap, origen: [{ posicionId: "caja", monto: cap }] }); if (num(d.tasa) > 0 && num(d.tasa) !== byId[d.destinoId].tasa) movimientos.push({ mes: 0, tipo: "tasa_cambia", posicionId: d.destinoId, tasa: num(d.tasa) }); return; }
    const papel = papelDeCanasta(d.canasta || "rentas", d, perfil);
    const id = d.id || uid("d");
    posiciones.push({ id, nombre: d.nombre || "Nueva inversión", capital: 0, tipo: d.canasta === "crecimiento" ? "ETF" : d.canasta === "rentas" ? (d.inmueble ? "Real Estate" : "CDT") : "Real Estate", liquido: d.canasta === "rentas" && !d.inmueble, inmueble: !!d.inmueble || d.canasta === "proteccion", nuevo: true, ...papel, desdeMes: 0 });
    movimientos.push({ mes: 0, tipo: "aportar", posicionId: id, monto: cap, origen: [{ posicionId: "caja", monto: cap }] });
    if (num(d.renta) > 0) movimientos.push({ mes: Math.max(0, num(d.rentaDesde) || 0), tipo: "flujo_inicia", flujo: { id: `${id}_renta`, nombre: `Renta ${d.nombre}`, tipo: "ingreso", monto: num(d.renta), indexa: true, posicionId: id } });
  });
  // 4) Lo que pasa después: eventos del escenario + comunes del perfil + pensiones
  const eventos = [...(perfil.eventos || []), ...(esc.eventos || [])].map((m) => ({ ...m }));
  // 5) Reglas: excedente y colchón por canasta, sobre el conjunto final de posiciones
  const finales = posiciones;
  const destino = (canasta) => {
    const lista = finales.filter((p) => canastaDe(p) === canasta && (canasta !== "rentas" || (!p.inmueble && p.tasa > 0)) && (canasta !== "crecimiento" || p.tipo !== "Crypto"));
    const cap = (p) => p.capital + (esc.despliegue || []).filter((d) => d.destinoId === p.id || d.id === p.id).reduce((s, d) => s + num(d.capital), 0);
    const best = [...lista].sort((a, b) => cap(b) - cap(a))[0];
    if (best) return best.id;
    const n = canasta === "crecimiento" ? { id: "nuevo_crecimiento", nombre: "Portafolio de crecimiento (nuevo)", bolsillo: "crecimiento", capital: 0, tasa: perfil.tasaCrecimiento, pagaPct: 0, valorizacion: 0, tipo: "ETF", nuevo: true } : { id: "nuevo_rentas", nombre: "Renta estable (nueva)", bolsillo: "sustento", capital: 0, tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, tipo: "CDT", liquido: true, nuevo: true };
    if (!finales.some((p) => p.id === n.id)) finales.push(n);
    return n.id;
  };
  const excedente = (esc.excedente || []).filter((e) => num(e.pct) > 0).map((e) => ({ posicionId: destino(e.canasta), pct: num(e.pct) }));
  const deficitDesde = finales.filter((p) => canastaDe(p) === "rentas" && !p.inmueble).sort((a, b) => (b.liquido ? 1 : 0) - (a.liquido ? 1 : 0)).map((p) => p.id);
  let colchon = null;
  if (num(esc.colchonMeses) > 0) {
    // El colchón vive en la mayor posición líquida (o en una nueva en cero)
    let liq = [...finales].filter((p) => p.liquido && !(esc.ventas || []).some((v) => v.posicionId === p.id && v.monto == null)).sort((a, b) => b.capital - a.capital)[0];
    if (!liq) { liq = { id: "nuevo_colchon", nombre: "Colchón líquido (nuevo)", bolsillo: "sustento", capital: 0, tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, tipo: "CDT", liquido: true, nuevo: true }; finales.push(liq); }
    const otros = finales.filter((p) => p.liquido && p.id !== liq.id).reduce((s, p) => s + p.capital, 0);
    colchon = { posicionId: liq.id, meta: Math.max(0, num(esc.colchonMeses) * num(baseCfg.gastosMes) - otros) };
  }
  const C = esc.canastas || {};
  const idsCrec = finales.filter((p) => canastaDe(p) === "crecimiento").map((p) => p.id);
  const idsRentas = finales.filter((p) => canastaDe(p) === "rentas" && !p.inmueble).map((p) => p.id);
  const rebalanceo = (C.crecimiento?.max != null || C.crecimiento?.min != null) && idsCrec.length && idsRentas.length
    ? { a: { ids: idsCrec, destinoId: destino("crecimiento") }, b: { ids: idsRentas, destinoId: destino("rentas") }, aMin: C.crecimiento?.min ?? null, aMax: C.crecimiento?.max ?? null, aMeta: C.crecimiento?.min != null && C.crecimiento?.max != null ? (num(C.crecimiento.min) + num(C.crecimiento.max)) / 2 : C.crecimiento?.max != null ? Math.max(0, num(C.crecimiento.max) - 5) : Math.min(100, num(C.crecimiento.min) + 5) }
    : null;
  const liq = liquidezEscenario(baseCfg, esc);
  const notas = [];
  const nom = (id) => byId[id]?.nombre || id;
  const salen = baseCfg.posiciones.filter((p) => p.sale).map((p) => p.nombre);
  const pagadasHoy = baseCfg.deudas.filter((d) => d.pagar).map((d) => d.nombre);
  if (salen.length) notas.push(`Sale del plan (decidido en Hoy): ${salen.join(", ")}${pagadasHoy.length ? `; se paga ${pagadasHoy.join(", ")}` : ""}: quedan ${M(num(baseCfg.hoy?.porDesplegar))} por desplegar.`);
  const vendidas = (esc.ventas || []).filter((v) => !byId[v.posicionId]?.sale).map((v) => `${nom(v.posicionId)}${v.monto != null ? ` (${M(v.monto)})` : ""}`);
  if (vendidas.length) notas.push(`Vendes ${vendidas.join(", ")}: liberas ${M(liq.liberado - liq.liberadoHoy)}.`);
  const pagosEsc = (esc.pagos || []).filter((id) => !baseCfg.deudas.find((d) => d.id === id)?.pagar);
  if (pagosEsc.length) notas.push(`Pagas ${pagosEsc.map((id) => baseCfg.deudas.find((d) => d.id === id)?.nombre || id).join(", ")}: ${M(liq.pagado - liq.pagadoHoy)}.`);
  (esc.despliegue || []).filter((d) => num(d.capital) > 0).forEach((d) => notas.push(`${M(d.capital)} a ${d.nombre}${num(d.tasa) > 0 ? ` al ${d.tasa}%` : ""}${d.regla ? ` · ${d.regla}` : ""}.`));
  if (liq.porAsignar > 1e6) notas.push(`Quedan ${M(liq.porAsignar)} sin asignar (se quedan en caja, sin rendir).`);
  if (liq.porAsignar < -1e6) notas.push(`Falta plata: asignas ${M(-liq.porAsignar)} más de lo que liberas.`);
  return {
    ...esc, ajuste: { notas, movimientos }, liquidez: liq,
    cfg: { meses: H, caja: baseCfg.caja, posiciones: finales, flujos: baseCfg.flujos, deudas: baseCfg.deudas, movimientos: [...movimientosHoy(baseCfg), ...movimientos, ...movimientosPerfil(perfil), ...eventos],
      reglas: { excedente, deficitDesde, colchon, rebalanceo, inflacion: num(perfil.inflacion), indexarGastos: true, indexarSustento: false, coberturaMin: num(perfil.coberturaMin) || 120 } },
  };
}

/** Texto que cuenta un camino con nombres y cifras. */
export function narrar(r, baseCfg) {
  const hoy = r.resultado.meses[0];
  const p = r.puntos, fin = r.resultado.anual[r.resultado.anual.length - 1];
  const frases = [];
  frases.push(`Hoy entran ${M(baseCfg.base?.ia + baseCfg.base?.ip || hoy.entra)} al mes y salen ${M(baseCfg.gastosMes)}.`);
  if (r.ajuste?.notas?.length) frases.push(r.ajuste.notas.join(" "));
  const ev = (r.eventos || []).filter((e) => !e.plantilla);
  if (ev.length) frases.push("Después: " + ev.map((e) => `año ${Math.floor(num(e.mes) / 12) + 1}, ${e.tipo === "comprar" ? `compras ${e.nombre}` : e.tipo === "vender" ? `vendes ${baseCfg.posiciones.find((x) => x.id === e.posicionId)?.nombre || ""}` : e.tipo === "flujo_inicia" ? `${e.flujo?.tipo === "gasto" ? "entra el gasto" : "entra"} ${e.flujo?.nombre}` : e.tipo}`).join("; ") + ".");
  frases.push(`En el año 10 entran ${M(fin.entraMes)} al mes contra ${M(fin.saleMes)} de gastos y cuotas: cobertura ${Math.round(fin.cobertura || 0)}%. El patrimonio pasa de ${M(p.patrimonioInicial)} a ${M(p.patrimonioFinal)} (${M(p.patrimonioFinalReal)} en plata de hoy, ${p.crecimientoRealAnual == null ? "" : p.crecimientoRealAnual.toFixed(1).replace(".", ",") + "% real al año"}).`);
  if (p.mesApretado) frases.push(`El mes más apretado es en el año ${Math.floor(p.mesApretado.mes / 12) + 1}, con cobertura ${Math.round(p.mesApretado.cobertura)}%${p.seSostiene ? ": se sostiene." : ": ahí no alcanza."}`);
  if (p.estres) frases.push(`Si crecimiento rinde ${String(Math.round(p.estres.tasa * 10) / 10).replace(".", ",")}% en vez de lo supuesto, el patrimonio termina en ${M(p.estres.patrimonioFinal)}.`);
  if (p.sinMayorFuente) frases.push(`Sin ${p.sinMayorFuente.nombre}, la cobertura baja a ${Math.round(p.sinMayorFuente.cobertura)}%${p.sinMayorFuente.seSostiene ? " y aguanta." : " y no aguanta."}`);
  if (r.vigilancia && !r.vigilancia.cumple) frases.push(`Ojo: ${r.vigilancia.roturas[0].detalle.toLowerCase()} (año ${r.vigilancia.roturas[0].anio}).`);
  return frases;
}

/** $100 M en cada tipo de inversión que la persona tiene o podría tener, a 3, 5 y 10 años. */
export function cienEnCada(baseCfg, perfil = PERFIL_DEFAULT) {
  const filas = [];
  const vistos = new Set();
  const add = (nombre, grupo, supuesto, tasa, valorizacion, impR, impV, nota) => { const k = `${nombre}`; if (vistos.has(k)) return; vistos.add(k); filas.push({ inversion: nombre, grupo, supuesto, ...cienMillones({ tasa, valorizacion, impuestoRendimientoPct: impR, impuestoVentaPct: impV }), nota }); };
  baseCfg.posiciones.forEach((p) => {
    if (p.vivienda || p.vehiculo) return;
    const rentaPct = p.inmueble && p.capital > 0 ? (p.renta * 12 / p.capital) * 100 : 0;
    if (p.inmueble) add(p.nombre, "Inmuebles", `${rentaPct.toFixed(1).replace(".", ",")}% de renta + ${p.valorizacion}% de valorización`, rentaPct, p.valorizacion, 35, 15, p.renta > 0 ? "Renta neta de costos; valorización al vender." : "Solo valoriza; no paga la vida.");
    else if (p.tasa > 0) add(p.nombre, canastaDe(p) === "crecimiento" ? "Crecimiento" : "Renta", `${p.tasa}% anual${p.pagaPct === 100 ? ", pagado cada mes" : ", reinvertido"}`, p.tasa, p.valorizacion, p.pagaPct === 100 ? 35 : 0, p.pagaPct === 100 ? 0 : 15, p.pagaPct === 100 ? "El rendimiento tributa cada año." : "Tributa al vender.");
  });
  add("Renta estable (CDT, renta fija)", "Renta", `${perfil.tasaRentaEstable}% anual, pagado cada mes`, perfil.tasaRentaEstable, 0, 35, 0, "Lo más seguro; tributa cada año.");
  add("Bolsa / ETF diversificado", "Crecimiento", `${perfil.tasaCrecimiento}% anual, reinvertido`, perfil.tasaCrecimiento, 0, 0, 15, "Tributa al vender.");
  add("Bitcoin", "Crecimiento", `${perfil.tasaBtc}% anual, reinvertido`, perfil.tasaBtc, 0, 0, 15, "Volátil: el supuesto es el que tú pongas.");
  return filas.sort((a, b) => b.a10 - a.a10);
}

// ─── Vigilancia: ¿el camino se cumple? ───────────────────────────────────────

/**
 * Revisa año a año que el resultado respete las canastas y condiciones.
 * Devuelve { cumple, roturas:[{anio, que, detalle}] }.
 */
export function vigilarCamino(camino, cfg, resultado) {
  const roturas = [];
  const C = camino.canastas || {};
  const cond = new Set(camino.condiciones || []);
  const posMeta = cfg.posiciones;
  resultado.anual.forEach((a, k) => {
    const mesFin = resultado.meses[Math.min(resultado.meses.length - 1, k * 12 + 11)];
    const anio = k + 1;
    const m = medirCanastas(posMeta, mesFin.caja, (p) => mesFin.detalle[p.id]?.capital ?? 0);
    if (C.crecimiento?.max != null && m.crecimientoPct > C.crecimiento.max + 2) roturas.push({ anio, que: "crecimiento", detalle: `Crecimiento llega a ${Math.round(m.crecimientoPct)}% (máximo ${C.crecimiento.max}%)` });
    if (C.crecimiento?.min != null && m.crecimientoPct < C.crecimiento.min - 2) roturas.push({ anio, que: "crecimiento", detalle: `Crecimiento cae a ${Math.round(m.crecimientoPct)}% (mínimo ${C.crecimiento.min}%)` });
    if (C.rentas?.min != null && m.rentasPct < C.rentas.min - 2) roturas.push({ anio, que: "rentas", detalle: `Rentas caen a ${Math.round(m.rentasPct)}% (mínimo ${C.rentas.min}%)` });
    if (C.rentas?.max != null && m.rentasPct > C.rentas.max + 2) roturas.push({ anio, que: "rentas", detalle: `Rentas llegan a ${Math.round(m.rentasPct)}% (máximo ${C.rentas.max}%)` });
    const gastos = mesFin.sale;
    if (C.colchonMeses && gastos > 0 && anio > 1 && m.colchon < C.colchonMeses * gastos * 0.9) roturas.push({ anio, que: "colchon", detalle: `Colchón de ${Math.round(m.colchon / gastos)} meses (meta ${C.colchonMeses})` });
  });
  // Condiciones sobre movimientos propios del usuario
  (camino.movimientos || []).forEach((mv) => {
    const p = posMeta.find((x) => x.id === mv.posicionId);
    const anio = Math.floor(num(mv.mes) / 12) + 1;
    if (cond.has("no_vender_vivienda") && mv.tipo === "vender" && p?.vivienda) roturas.push({ anio, que: "condicion", detalle: `Vender ${p.nombre} rompe "${CONDICION_LABEL.no_vender_vivienda}"` });
    if (cond.has("no_apalancar") && mv.tipo === "deuda_nueva") roturas.push({ anio, que: "condicion", detalle: `Tomar deuda rompe "${CONDICION_LABEL.no_apalancar}"` });
  });
  if (cond.has("sin_deuda_cara")) resultado.deudas.filter((d) => !d.pagada && d.tasa >= DEUDA_CARA && d.saldo > 1).forEach((d) => roturas.push({ anio: 1, que: "deuda", detalle: `${d.nombre} sigue al ${d.tasa}%` }));
  return { cumple: roturas.length === 0, roturas };
}

// ─── Lado a lado ─────────────────────────────────────────────────────────────

/** Corre todos los caminos y devuelve los 8 puntos de cada uno, lado a lado. */
export function compararCaminos(caminos, baseCfg, perfil = PERFIL_DEFAULT) {
  const tasaEstres = Math.max(0, num(perfil.tasaCrecimiento) * 0.65);
  return caminos.map((c0) => {
    const c = c0.cfg ? c0 : c0.despliegue ? configurarEscenario(baseCfg, c0, perfil) : configurarCamino(baseCfg, c0, perfil);
    const r = simularCamino(c.cfg);
    const vigilancia = vigilarCamino(c, c.cfg, r);
    const fin = r.meses[r.meses.length - 1];
    const capFin = (p) => fin.detalle[p.id]?.capital ?? 0;
    const mayorRenta = c.cfg.posiciones.filter((p) => canastaDe(p) === "rentas" && p.tasa > 0).sort((a, b) => capFin(b) * b.tasa - capFin(a) * a.tasa)[0];
    const estres = estresar(c.cfg, { tasaCrecimiento: tasaEstres });
    const sinMayor = mayorRenta ? estresar(c.cfg, { sinPosicionId: mayorRenta.id }) : null;
    return {
      ...c, resultado: r, vigilancia,
      canastasHoy: medirCanastas(baseCfg.posiciones, baseCfg.caja),
      canastasFin: medirCanastas(c.cfg.posiciones, fin.caja, capFin),
      puntos: { ...r.puntos, estres: { tasa: tasaEstres, patrimonioFinal: estres.puntos.patrimonioFinal }, sinMayorFuente: mayorRenta ? { nombre: mayorRenta.nombre, cobertura: sinMayor.puntos.cobertura, seSostiene: sinMayor.puntos.seSostiene } : null },
    };
  });
}
