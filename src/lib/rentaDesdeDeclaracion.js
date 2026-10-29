// ═══════════════════════════════════════════════════════════════════════════
// Renta anclada en la declaración del año anterior (Colombia)
// ─────────────────────────────────────────────────────────────────────────
// 29-oct-2026 (Santiago): "FINPATHIA me muestra pagos enormes frente a lo que
// hace mi contador… si uno carga la declaración del año anterior y la
// plataforma pregunta qué cambió, ¿no logramos más acertividad?".
//
// En vez de reconstruir la renta desde cero con lo registrado en la app, este
// motor parte del impuesto que el contador YA declaró y le aplica los cambios
// del año, uno por uno, para poder explicar cada salto. Así conserva todo lo
// que el contador aplicó (costos, exentas, deducciones) aunque no lo veamos.
//
// Todo es puro: sin React, sin estado. Lo usan EstimadoRenta.jsx (lo que viene)
// e HistorialDeclaraciones.jsx (lo que pasó). Validado primero como prototipo.
//
// Normas: Art. 241 (tabla personas), Art. 240 (35% sociedades), Art. 336
// (tope 40% / 1.340 UVT; dependientes 72 UVT y 1% factura electrónica por
// fuera del tope, Ley 2277 de 2022), Art. 807 (anticipo), Art. 809 (reducción
// del anticipo), Arts. 292-3 a 297-3 (impuesto al patrimonio, umbral 72.000
// UVT), Art. 242 y 254-1 (dividendos: se suman a la cédula general y se
// descuenta el 19% de lo que exceda 1.090 UVT), Arts. 257-258 (donaciones).
// ═══════════════════════════════════════════════════════════════════════════

import { calcImpRenta } from "./tablaArt241.js";
import { uvtForYear } from "./taxCO.js";

export const TARIFA_SOCIEDADES = 0.35;
export const MAX_DECLARACIONES = 4;
export const UMBRAL_PATRIMONIO_UVT = 72000;
export const EXCLUSION_CASA_UVT = 12000;
export const UMBRAL_PATRIMONIO_EXTRAORDINARIO_UVT = 200000; // Decreto 173 de 2026 (sociedades, en revisión de la Corte)

/** Tipos de ingreso nuevo: cada uno tributa distinto. */
export const TIPOS_INGRESO = [
  ["laboral", "Salario u honorarios"], ["arriendo", "Arriendo"], ["capital", "Intereses o rendimientos"],
  ["dividendos", "Dividendos o utilidades de una empresa"], ["otro", "Otro"],
];
export const tipoDeCategoria = (cat = "") => {
  const c = String(cat).toLowerCase();
  if (/salari|honorari|comisi|prima|bonific|cesant|laboral/.test(c)) return "laboral";
  if (/arriendo|arrend|alquiler/.test(c)) return "arriendo";
  if (/dividend|utilidad|participaci/.test(c)) return "dividendos";
  if (/inter|rendim|cdt|fondo/.test(c)) return "capital";
  return "otro";
};

/** De dónde vinieron los ingresos de una declaración F-210, por cédula (si el lector los trajo). */
export const CEDULAS_F210 = [
  ["ingresosTrabajo", "Salario (rentas de trabajo)", "laboral"],
  ["ingresosHonorarios", "Honorarios y servicios (trabajo no laboral)", "laboral"],
  ["ingresosCapital", "Rentas de capital: intereses, arriendos, regalías", "capital"],
  ["ingresosNoLaborales", "Rentas no laborales", "otro"],
  ["ingresosPensiones", "Pensiones", "otro"],
  ["ingresosDividendos", "Dividendos y participaciones", "dividendos"],
];
export function origenIngresos(d) {
  if (!d || d.tipo === "F110") return [];
  const R = d.renglones || {};
  return CEDULAS_F210.map(([k, nombre, tipo]) => ({ id: k, nombre, tipo, monto: num(R[k]) })).filter((x) => x.monto > 0);
}

/** Respuestas por defecto a «¿qué cambió este año?». */
export const RESPUESTAS_DEFAULT = Object.freeze({
  g: 0.05, sigue: null, filas: [], nuevos: [], perdidos: [], nuevo: 0, nuevoGastos: 0, perdido: 0, aportes: 0, dep: 0, goSel: "", go: 0, ant: null, casa: 0, estr: {}, off: {},
});

const num = (v) => Number(v) || 0;

/** Declaraciones del titular, de la más vieja a la más nueva. */
export function declaracionesOrdenadas(owner) {
  return (Array.isArray(owner?.declaraciones) ? owner.declaraciones : [])
    .filter((d) => d && d.renglones && Number(d.anoGravable))
    .slice()
    .sort((a, b) => Number(a.anoGravable) - Number(b.anoGravable));
}
export const ultimaDeclaracion = (owner) => declaracionesOrdenadas(owner).at(-1) || null;

export const esF110 = (d) => d?.tipo === "F110";
/** Impuesto de renta declarado: F-210 el calculado; F-110 el neto (después de descuentos). */
export const impuestoDeclarado = (d) => {
  const r = d?.renglones || {};
  return esF110(d) ? num(r.impuestoNeto) || num(r.impuestoCalculado) : num(r.impuestoCalculado);
};
export const retencionDeclarada = (d) => num(esF110(d) ? d?.renglones?.autorretencion : d?.renglones?.retefuente);

/** Base gravable que corresponde a un impuesto de la tabla del Art. 241 (inversa por bisección). */
export function baseDesdeImpuesto241(imp, uvt) {
  if (!(imp > 0)) return 0;
  let lo = 0, hi = 1e13;
  for (let i = 0; i < 90; i++) {
    const m = (lo + hi) / 2;
    if (calcImpRenta(m / uvt, uvt) < imp) lo = m; else hi = m;
  }
  return lo;
}
export const impuesto241 = (base, uvt) => Math.max(0, calcImpRenta(Math.max(0, base) / uvt, uvt));
export function tarifaMarginal241(base, uvt) {
  const u = base / uvt;
  if (u > 31000) return 0.39; if (u > 18970) return 0.37; if (u > 8670) return 0.35;
  if (u > 4100) return 0.33; if (u > 1700) return 0.28; if (u > 1090) return 0.19; return 0;
}

// ─── Anticipo (Art. 807) ──────────────────────────────────────────────────
/** 25% el primer año que declara, 50% el segundo, 75% del tercero en adelante. */
export const pctAnticipo = (declaracionesPrevias) => declaracionesPrevias >= 2 ? 0.75 : declaracionesPrevias === 1 ? 0.5 : 0.25;
/** El menor de los dos procedimientos, menos las retenciones del año. Nunca negativo. */
export function anticipoArt807(impAno, impPrev, ret, pct) {
  const p1 = impAno * pct;
  const p2 = impPrev != null ? ((impAno + impPrev) / 2) * pct : Infinity;
  return Math.max(0, Math.min(p1, p2) - num(ret));
}
/** Anticipo que el titular ya pagó para el año en curso: el renglón si se leyó; si no, estimado. */
export function anticipoPagado(owner) {
  const ds = declaracionesOrdenadas(owner); const u = ds.at(-1); if (!u) return { valor: 0, leido: false };
  const leido = num(u.renglones.anticipoAnoSiguiente);
  if (leido > 0) return { valor: leido, leido: true };
  const prev = ds.at(-2);
  const v = anticipoArt807(impuestoDeclarado(u), prev ? impuestoDeclarado(prev) : null, retencionDeclarada(u), pctAnticipo(ds.length - 1));
  return { valor: Math.round(v / 1e5) * 1e5, leido: false };
}

// ─── Ganancia ocasional desde el solucionador ─────────────────────────────
/** Cálculos guardados del solucionador que corresponden al tipo de titular. */
export function calculosGODelTitular(calculosGO, owner) {
  const tipo = owner?.type === "juridica" ? "juridica" : "natural";
  return (Array.isArray(calculosGO) ? calculosGO : []).filter((c) => {
    if (c?.ownerId) return c.ownerId === owner?.id;
    const t = c?.datos?.titular === "juridica" ? "juridica" : "natural";
    return t === tipo;
  });
}

// ─── Estimado del año ─────────────────────────────────────────────────────
/**
 * Estima la renta del año siguiente a la última declaración.
 * @param {object} owner  titular con declaraciones
 * @param {object} resp   respuestas a «¿qué cambió?» (ver RESPUESTAS_DEFAULT)
 * @param {object} [opt]  { calculosGO }
 */
export function estimarDesdeDeclaracion(owner, resp = {}, opt = {}) {
  const d = ultimaDeclaracion(owner); if (!d) return null;
  const r = { ...RESPUESTAS_DEFAULT, ...resp };
  const R = d.renglones, nat = !esF110(d) && owner?.type !== "juridica";
  const ano = Number(d.anoGravable), anoEst = ano + 1;
  const uvtBase = uvtForYear(ano), uvt = uvtForYear(anoEst);
  const brutos = num(R.ingresosBrutos) || 1;
  // «Lo de siempre»: si escribió cuánto va a recibir (r.sigue), manda eso; si no, el % (r.g).
  const g = r.sigue != null && r.sigue !== "" ? Math.max(-1, num(r.sigue) / brutos - 1) : num(r.g);
  const impBase = impuestoDeclarado(d);
  const base0 = nat ? baseDesdeImpuesto241(num(R.impuestoCalculado), uvtBase)
    : (num(R.rentaLiquidaGravable) || num(R.impuestoCalculado) / TARIFA_SOCIEDADES);
  const descuentos = nat ? 0 : Math.max(0, num(R.impuestoCalculado) - impBase);
  const pct = base0 / brutos; // qué parte de cada peso facturado terminó gravado
  let descDiv = 0; // descuento del 19% de dividendos (Art. 254-1) que se va acumulando
  const tax = (b) => nat ? Math.max(0, impuesto241(b, uvt) - descDiv) : Math.max(0, Math.max(0, b) * TARIFA_SOCIEDADES - descuentos);

  const pasos = []; let b = base0, prev = impBase;
  // Cada cambio se puede apagar (r.off[clave]) para simular sin él: queda en la lista, sin efecto.
  const off = r.off || {};
  const paso = (clave, texto, nb) => {
    if (off[clave]) { pasos.push({ clave, texto, delta: 0, off: true }); return; }
    b = Math.max(0, nb); const t = tax(b); pasos.push({ clave, texto, delta: t - prev }); prev = t;
  };
  if (nat) paso("uvt", `UVT nueva (${uvt.toLocaleString("es-CO")}): la tabla sube con la inflación`, b);
  // Tabla de ingresos (29-oct-2026): cada línea del año pasado dice si sigue, cambia o ya no; más las nuevas.
  // Se traduce a «perdidos» (lo que baja) y «nuevos» (lo que sube o llega, con su tipo).
  const filas = Array.isArray(r.filas) && r.filas.length ? r.filas : null;
  let perdidosL = Array.isArray(r.perdidos) ? r.perdidos : [], nuevosL = Array.isArray(r.nuevos) ? r.nuevos : [];
  let restoBase = null, objetivoFilas = 0;
  if (filas) {
    perdidosL = []; nuevosL = [];
    let sumAntes = 0;
    for (const f of filas) {
      const antes = num(f.antes); sumAntes += antes;
      const ahora = f.estado === "no" ? 0 : f.estado === "cambia" ? num(f.ahora) : antes * (1 + g);
      objetivoFilas += ahora;
      const nombre = (f.nombre || "").trim() || "Ingreso";
      if (ahora < antes) perdidosL.push({ id: f.id, monto: antes - ahora, etiqueta: ahora ? `${nombre}: ${mm(antes)} → ${mm(ahora)}` : `Ya no recibes: ${nombre} (${mm(antes)})` });
      else if (ahora > antes) nuevosL.push({ id: f.id, tipo: f.tipo, costos: f.costos, monto: ahora - antes,
        etiqueta: antes ? (f.estado === "cambia" ? `${nombre}: ${mm(antes)} → ${mm(ahora)}` : `${nombre}: ajuste por inflación`) : `Nuevo: ${nombre} (${mm(ahora)})` });
    }
    restoBase = Math.max(0, brutos - sumAntes); // lo declarado que no quedó en ninguna línea
  }
  // Ingresos que dejan de recibirse, uno por uno (antes del ajuste por inflación de lo que sigue)
  let perdidoTotal = 0;
  for (const p of perdidosL) {
    const m = num(p.monto); if (!m) continue;
    const clave = "p_" + p.id, etiqueta = p.etiqueta || `Ya no recibes: ${(p.nombre || "").trim() || "un ingreso"} (${mm(m)})`;
    if (off[clave]) { paso(clave, etiqueta, b); continue; }
    const quita = Math.min(m, Math.max(0, brutos - perdidoTotal)); // no se puede perder más de lo declarado
    perdidoTotal += quita;
    paso(clave, etiqueta, b - quita * pct);
  }
  const sigueBase = Math.max(0, brutos - perdidoTotal);
  if (filas) { if (g && restoBase > 0) paso("ingresos", `El resto de lo declarado (${mm(restoBase)}) sube con la inflación`, b + restoBase * g * pct); }
  else if (g && r.sigue == null) paso("ingresos", `Lo que sigue igual se ajusta por inflación (+${Math.round(g * 100)}%)`, b + sigueBase * g * pct);
  else if (g) paso("ingresos", r.sigue != null && r.sigue !== ""
    ? `Lo de siempre pasa de ${mm(brutos)} a ${mm(brutos * (1 + g))} (${g > 0 ? "+" : "−"}${Math.round(Math.abs(g) * 100)}%)`
    : `Ingresos de siempre ${g > 0 ? "suben" : "bajan"} ~${Math.round(Math.abs(g) * 100)}%`, b + brutos * g * pct);
  if (num(r.nuevo)) paso("nuevo", "Ingreso nuevo" + (num(r.nuevoGastos) ? " menos sus costos" : ""), b + Math.max(0, num(r.nuevo) - num(r.nuevoGastos)));
  // Ingresos nuevos, uno por uno, según su tipo
  const usado = ["rentaExenta25", "deducIntereses", "deducMedicina", "deducDependientes", "pvAFC"].reduce((a, k) => a + num(R[k]), 0);
  let espacio = Math.max(0, Math.min(0.4 * (brutos - num(R.ingresosNoConstitutivos)), 1340 * uvt) - usado * (uvt / uvtBase));
  let retNuevos = 0;
  for (const n of nuevosL) {
    const m = num(n.monto); if (!m) continue;
    const clave = "n_" + n.id, tipo = n.tipo || "otro";
    const nombre = (n.nombre || "").trim() || (TIPOS_INGRESO.find(([k]) => k === tipo)?.[1] ?? "Ingreso nuevo");
    const etiqueta = n.etiqueta || `Nuevo: ${nombre} (${mm(m)})`;
    if (off[clave]) { paso(clave, etiqueta, b); continue; }
    if (!nat) { paso(clave, etiqueta, b + Math.max(0, m - num(n.costos))); continue; }
    if (tipo === "laboral") {
      const noConst = m * 0.08; // aportes obligatorios a salud y pensión
      const exenta = Math.min((m - noConst) * 0.25, 790 * uvt, espacio); espacio -= exenta;
      const antes = prev; paso(clave, etiqueta, b + m - noConst - exenta); retNuevos += Math.max(0, prev - antes);
    } else if (tipo === "dividendos") {
      descDiv += 0.19 * Math.max(0, m - 1090 * uvt); retNuevos += 0.15 * Math.max(0, m - 1090 * uvt);
      paso(clave, etiqueta, b + m);
    } else {
      if (tipo === "arriendo") retNuevos += 0.035 * m; else if (tipo === "capital") retNuevos += 0.07 * m;
      paso(clave, etiqueta, b + Math.max(0, m - num(n.costos)));
    }
  }
  if (num(r.perdido)) paso("perdido", "Ingreso que deja de recibirse", b - num(r.perdido) * pct);
  if (nat && num(r.aportes)) paso("aportes", "Aportes voluntarios a pensión o AFC", b - Math.min(num(r.aportes), 0.3 * brutos));
  if (nat && num(r.dep)) paso("dep", num(r.dep) > 0 ? `${num(r.dep)} dependiente(s) más` : "Un dependiente menos", b - 72 * uvt * num(r.dep));
  const renta = tax(b);

  const gc = (opt.calculosGO || []).find((c) => c.id === r.goSel) || null;
  const goBruto = gc ? num(gc.resumen?.final) : r.goSel === "manual" ? num(r.go) : 0;
  const go = off.go ? 0 : goBruto;
  if (goBruto) pasos.push({ clave: "go", texto: gc ? `Venta: ${gc.nombre} (ganancia ocasional ya optimizada en el solucionador)` : "Venta de un activo (ganancia ocasional)", delta: go, off: !!off.go });
  const total = renta + go;

  const gEf = off.ingresos ? 0 : g;
  const ret = filas ? retencionDeclarada(d) * (sigueBase / brutos) + retNuevos : retencionDeclarada(d) * (sigueBase / brutos) * (1 + gEf) + retNuevos;
  const ingNuevos = nuevosL.reduce((a, n) => a + (off["n_" + n.id] ? 0 : num(n.monto)), 0);
  const ingresosEst = filas
    ? objetivoFilas + restoBase * (1 + gEf) + perdidosL.reduce((a, p) => a + (off["p_" + p.id] ? num(p.monto) : 0), 0) - nuevosL.reduce((a, n) => a + (off["n_" + n.id] ? num(n.monto) : 0), 0)
    : (r.sigue != null && r.sigue !== "" ? brutos * (1 + gEf) : sigueBase * (1 + gEf)) + ingNuevos;
  const ap = anticipoPagado(owner);
  const antPagado = r.ant == null ? ap.valor : num(r.ant);
  const saldo = total - ret - antPagado;
  const nDecl = declaracionesOrdenadas(owner).length;
  const pctA = pctAnticipo(nDecl);
  const anticipoSiguiente = anticipoArt807(renta, impBase, ret, pctA);
  const totalAlDeclarar = Math.max(0, saldo + anticipoSiguiente);

  return {
    d, nat, ano, anoEst, uvt, uvtBase, impBase, base0, base: b, brutos, renta, go, gc, total,
    rango: [total * 0.9, total * 1.1], perdidoTotal, ingNuevos, ingresosEst, ret, antPagado, antLeido: r.ant == null && ap.leido, saldo,
    pctA, anticipoSiguiente, totalAlDeclarar, pasos, marginal: nat ? tarifaMarginal241(b, uvt) : TARIFA_SOCIEDADES,
  };
}

// ─── Revisión de titular ──────────────────────────────────────────────────
/** Avisa si lo registrado a nombre del titular es mucho más de lo que declaró (señal de ingresos de una sociedad a nombre de la persona). */
export function revisarTitular(ingresosApp, e) {
  if (ingresosApp == null || !e) return null;
  const esperado = e.brutos * (1 + Math.max(0, num(RESPUESTAS_DEFAULT.g)));
  return { alerta: ingresosApp > esperado * 1.3, ingresosApp, declarado: e.brutos };
}

// ─── Oportunidades ────────────────────────────────────────────────────────
/** Lista de oportunidades que aplican. Las que no son acción (info) explican algo; las demás tienen ahorro(v). */
export function oportunidades(owner, e) {
  if (!e) return [];
  const R = e.d.renglones, ops = [], t = e.marginal, uvt = e.uvt;
  if (e.nat) {
    const usado = ["rentaExenta25", "deducIntereses", "deducMedicina", "deducDependientes", "pvAFC"].reduce((a, k) => a + num(R[k]), 0);
    const tope = Math.min(0.4 * (num(R.ingresosBrutos) - num(R.ingresosNoConstitutivos)), 1340 * uvt);
    const espacio = Math.max(0, tope - usado * (uvt / e.uvtBase));
    if (espacio > 3e6) ops.push({ id: "afc", titulo: "Aportes voluntarios a pensión o cuenta AFC", campo: "Cuánto aportarías antes del 31 de diciembre",
      sugerido: Math.round(Math.min(espacio, 0.3 * num(R.ingresosBrutos)) / 1e6) * 1e6,
      ahorro: (v) => Math.min(num(v), espacio, 0.3 * num(R.ingresosBrutos)) * t,
      porque: `Aún te quedan unos ${mm(espacio)} de espacio en el tope de exentas y deducciones (40% o 1.340 UVT). Lo que aportes ahí deja de pagar renta a tu tarifa marginal del ${Math.round(t * 100)}%.`,
      norma: "Arts. 126-1, 126-4 y 336 del Estatuto Tributario", ojo: "La plata tiene reglas de permanencia: si la retiras antes, se devuelve el beneficio." });
    else ops.push({ id: "afc_info", info: true, titulo: "Aportes voluntarios a pensión o AFC: ya usas el tope",
      porque: `En ${e.ano} usaste ${mm(usado)} en exentas y deducciones y el tope de este año es ${mm(tope)}. Aportar más no te bajaría la renta: mira los beneficios que van por fuera del tope.`,
      norma: "Art. 336 del Estatuto Tributario" });
    ops.push({ id: "fe", titulo: "Deducción del 1% de compras con factura electrónica", campo: "Compras del año con factura electrónica a tu nombre",
      ahorro: (v) => Math.min(0.01 * num(v), 240 * uvt) * t,
      porque: `Va por fuera del tope. El 1% de lo que compres con factura electrónica a tu nombre (hasta 240 UVT, ${mm(240 * uvt)}) se resta de la base.`,
      norma: "Art. 336, numeral 5 (Ley 2277 de 2022)", ojo: "Pagadas con tarjeta, transferencia u otro medio electrónico, y que no las hayas restado ya como costo." });
    ops.push({ id: "dep", titulo: "Dependientes adicionales", campo: "Dependientes que no declaraste el año pasado (máx. 4)", entero: true,
      ahorro: (v) => Math.min(4, num(v)) * 72 * uvt * t,
      porque: `Cada dependiente resta 72 UVT (${mm(72 * uvt)}) por fuera del tope, además del 10% que ya pudiste tomar.`,
      norma: "Art. 336, numeral 3 (Ley 2277 de 2022)", ojo: "Hijos menores o estudiando, padres o cónyuge que dependan económicamente de ti, con certificado." });
    ops.push({ id: "arr", titulo: "Costos de los arriendos o rentas de capital", campo: "Costos que no se restaron (predial, administración, intereses, mantenimiento)",
      ahorro: (v) => num(v) * t,
      porque: "Si recibes arriendos, sus costos se restan del ingreso. Suelen quedarse por fuera cuando los paga otra persona o no se guardan los soportes.",
      norma: "Arts. 107 y 338 del Estatuto Tributario", ojo: "Solo los que no estaban ya en la declaración, con factura a tu nombre." });
  } else {
    ops.push({ id: "gastos", titulo: "Gastos e inversiones causados antes del 31 de diciembre", campo: "Gastos necesarios que vas a causar y soportar este año",
      ahorro: (v) => num(v) * TARIFA_SOCIEDADES,
      porque: "Cada peso de gasto necesario del negocio, causado y con factura en el año, baja la renta al 35%.",
      norma: "Art. 107 del Estatuto Tributario", ojo: "Tiene que ser necesario para el negocio: no sirve gastar por gastar." });
    ops.push({ id: "don", titulo: "Donaciones a entidades del régimen especial", campo: "Donación que harías este año",
      ahorro: (v) => Math.min(0.25 * num(v), 0.25 * e.renta),
      porque: "El 25% de lo donado a entidades sin ánimo de lucro calificadas se descuenta directamente del impuesto.",
      norma: "Arts. 257 y 258 del Estatuto Tributario", ojo: "La entidad debe estar en el régimen tributario especial y certificar la donación." });
  }
  if (e.anticipoSiguiente > 0) ops.push({ id: "ant_info", info: true, titulo: `Anticipo de ${e.anoEst + 1}: ${mm(e.anticipoSiguiente)}`,
    porque: `Al declarar, además del saldo, se paga por adelantado el ${Math.round(e.pctA * 100)}% del impuesto del año siguiente. Si tus ingresos de ${e.anoEst + 1} van a bajar (vendes un activo que da renta, te jubilas, termina un contrato), puedes pedir a la DIAN que te lo reduzcan.`,
    norma: "Arts. 807 y 809 del Estatuto Tributario" });
  if (e.gc) ops.push({ id: "go_ok", info: true, irA: "gocasional", titulo: `Venta ya optimizada: ${e.gc.nombre}`,
    porque: `La ganancia ocasional pasó de ${mm(e.gc.resumen?.hoy)} a ${mm(e.gc.resumen?.final)} con las estrategias que marcaste en el solucionador. Ese valor ya está en el estimado.`,
    norma: "Arts. 69, 70, 72, 73 y 311-1 del Estatuto Tributario", link: "Ver o ajustar en el solucionador" });
  else ops.push({ id: "go_info", info: true, irA: "gocasional", titulo: "¿Vas a vender un inmueble o un activo?",
    porque: "La venta paga ganancia ocasional (15%) aparte de la renta. El solucionador te muestra cómo bajarla: reajuste fiscal, avalúo catastral, mejoras, la fecha de la escritura y más.",
    norma: "Arts. 69, 70, 72, 73 y 311-1 del Estatuto Tributario", link: "Abrir el solucionador de ganancia ocasional" });
  return ops;
}
/** Suma lo que ahorran las estrategias marcadas. */
export function ahorroMarcado(ops, estr = {}) {
  return ops.reduce((a, op) => a + (!op.info && estr[op.id]?.on ? op.ahorro(estr[op.id].v) : 0), 0);
}

// ─── Impuesto al patrimonio (personas) ────────────────────────────────────
/** Impuesto en UVT para una base en UVT. Tramo del 1,5% solo hasta 2026; desde 2027 es 1%. */
export function impuestoPatrimonioUVT(baseUvt, ano) {
  const b = baseUvt; if (b <= 72000) return 0;
  if (b <= 122000) return (b - 72000) * 0.005;
  if (b <= 239000) return (b - 122000) * 0.01 + 250;
  return (b - 239000) * (ano <= 2026 ? 0.015 : 0.01) + 1420;
}
export function patrimonioInfo(owner, casa = 0) {
  const ds = declaracionesOrdenadas(owner).filter((d) => d.renglones.patrimonioLiquido != null && num(d.renglones.patrimonioLiquido) > 0);
  const u = ds.at(-1); if (!u) return null;
  const anoA = Number(u.anoGravable) + 1, anoB = anoA + 1; // 1 de enero del año en curso y del siguiente
  const uvtA = uvtForYear(anoA), uvtB = uvtForYear(anoB) === uvtA ? uvtA * 1.05 : uvtForYear(anoB);
  if (owner?.type === "juridica" || esF110(u)) {
    const pl = num(u.renglones.patrimonioLiquido);
    return { sociedad: true, patrimonio: pl, extraordinario: pl >= UMBRAL_PATRIMONIO_EXTRAORDINARIO_UVT * uvtA };
  }
  const pats = ds.map((d) => num(d.renglones.patrimonioLiquido));
  const crec = pats.length > 1 ? Math.pow(pats.at(-1) / pats[0], 1 / (pats.length - 1)) - 1 : 0;
  const exc = Math.min(num(casa), EXCLUSION_CASA_UVT * uvtA);
  const patA = pats.at(-1), patB = patA * (1 + crec);
  const umbral = UMBRAL_PATRIMONIO_UVT * uvtA;
  const impA = impuestoPatrimonioUVT(Math.max(0, patA - exc) / uvtA, anoA) * uvtA;
  const impB = impuestoPatrimonioUVT(Math.max(0, patB - exc) / uvtB, anoB) * uvtB;
  return { sociedad: false, anoA, anoB, patA, patB, crec, exc, umbral, impA, impB, uvtA,
    aplica: patA - exc >= umbral, cerca: patA - exc < umbral && patB - exc >= umbral * 0.9 };
}

// ─── Dividendos: repartir utilidades de una sociedad a una persona ────────
export function impuestoDividendos(basePersona, dividendo, uvt) {
  const v = num(dividendo);
  const extra = Math.max(0, impuesto241(basePersona + v, uvt) - impuesto241(basePersona, uvt) - 0.19 * Math.max(0, v - 1090 * uvt));
  const retencion = 0.15 * Math.max(0, v - 1090 * uvt);
  const utilidadAntes = v / (1 - TARIFA_SOCIEDADES);
  return { extra, neto: v - extra, retencion, cargaTotal: v ? (utilidadAntes * TARIFA_SOCIEDADES + extra) / utilidadAntes : 0, empresa: utilidadAntes * TARIFA_SOCIEDADES };
}

// ─── Historial ────────────────────────────────────────────────────────────
export function serieHistorial(owner) {
  return declaracionesOrdenadas(owner).slice(-MAX_DECLARACIONES).map((d) => {
    const R = d.renglones, imp = impuestoDeclarado(d), ing = num(R.ingresosBrutos);
    return { ano: Number(d.anoGravable), ing, imp, tasa: ing ? imp / ing : 0, ret: retencionDeclarada(d),
      saldo: R.saldoPagar != null ? num(R.saldoPagar) : Math.max(0, imp - retencionDeclarada(d)),
      patBruto: R.patrimonioBruto != null ? num(R.patrimonioBruto) : null, deudas: R.deudas != null ? num(R.deudas) : null,
      pat: R.patrimonioLiquido != null ? num(R.patrimonioLiquido) : null };
  });
}
const crecimientoAnual = (a, b, n) => (a > 0 && b > 0 && n > 0 ? Math.pow(b / a, 1 / n) - 1 : null);

/** Indicadores, hallazgos y proyección «hacia dónde va». */
export function analisisHistorial(owner) {
  const s = serieHistorial(owner); if (!s.length) return null;
  const n = s.length, u = s.at(-1), p = s.at(-2) || null, d = ultimaDeclaracion(owner), R = d.renglones;
  const nat = !esF110(d) && owner?.type !== "juridica";
  const cagr = n > 1 ? crecimientoAnual(s[0].ing, u.ing, n - 1) : null;
  const usado = nat ? ["rentaExenta25", "deducIntereses", "deducMedicina", "deducDependientes", "pvAFC"].reduce((a, k) => a + num(R[k]), 0) : 0;
  const tope = nat ? Math.min(0.4 * (num(R.ingresosBrutos) - num(R.ingresosNoConstitutivos)), 1340 * uvtForYear(u.ano)) : 0;
  const kpis = {
    impuesto: u.imp, impuestoVar: p && p.imp ? (u.imp - p.imp) / p.imp : null,
    tasa: u.tasa, tasaVarPts: p ? (u.tasa - p.tasa) * 100 : null,
    cagr, patrimonio: u.pat, patrimonioVar: p && p.pat ? (u.pat - p.pat) / p.pat : null,
    endeudamiento: u.patBruto ? u.deudas / u.patBruto : null,
    cubierto: u.imp ? Math.min(1, u.ret / u.imp) : null,
    usado, tope, margenFiscal: !nat && num(R.ingresosBrutos) ? num(R.rentaLiquidaGravable) / num(R.ingresosBrutos) : null,
  };
  // Hacia dónde va: si los ingresos siguen la tendencia y nada más cambia
  const gT = Math.max(-0.3, Math.min(0.3, cagr ?? 0.05));
  const e = estimarDesdeDeclaracion(owner, { g: gT });
  const pats = s.map((x) => x.pat).filter((x) => x != null && x > 0);
  const gPat = pats.length > 1 ? crecimientoAnual(pats[0], pats.at(-1), pats.length - 1) : 0;
  const proy = { ano: u.ano + 1, g: gT, ing: u.ing * (1 + gT), imp: e?.renta ?? 0, tasa: e ? e.renta / (u.ing * (1 + gT) || 1) : 0, pat: u.pat != null ? u.pat * (1 + gPat) : null, gPat };

  const hallazgos = [];
  if (p && p.ing && p.imp) {
    const di = (u.ing - p.ing) / p.ing, dt = (u.imp - p.imp) / p.imp;
    hallazgos.push({ nivel: dt > di + 0.02 ? "alerta" : "bien", texto: `El impuesto ${dt >= 0 ? "subió" : "bajó"} ${pct(Math.abs(dt), 0)} mientras los ingresos ${di >= 0 ? "subieron" : "bajaron"} ${pct(Math.abs(di), 0)}${dt > di + 0.02 ? ": el impuesto creció más rápido que lo que entra, típico cuando se sube de escalón en la tabla o se agotan los beneficios." : dt < di - 0.02 ? ": pagaste proporcionalmente menos." : ", en la misma línea."}` });
  }
  if (nat && tope && usado > tope) hallazgos.push({ nivel: "alerta", texto: `Declaraste ${mm(usado)} en exentas y deducciones, pero el tope era ${mm(tope)}: ${mm(usado - tope)} no te restaron nada. En la Calculadora de declaración están los beneficios que van por fuera del tope.` });
  if (kpis.cubierto != null && kpis.cubierto < 0.6) hallazgos.push({ nivel: "alerta", texto: `Solo ${pct(kpis.cubierto, 0)} del impuesto se cubrió con retenciones: al declarar te toca un pago grande. Conviene ir separando plata durante el año.` });
  if (p && p.deudas != null && u.deudas != null && u.deudas < p.deudas) hallazgos.push({ nivel: "bien", texto: `Bajó la deuda de ${mm(p.deudas)} a ${mm(u.deudas)}: el patrimonio líquido creció también por eso.` });
  if (n > 2) hallazgos.push({ nivel: u.tasa > s[0].tasa ? "alerta" : "bien", texto: `En ${n} años la tasa efectiva pasó de ${pct(s[0].tasa)} a ${pct(u.tasa)}${u.tasa > s[0].tasa ? ": cada año se va una porción mayor de lo que entra." : "."}` });
  if (nat && u.pat != null) {
    const um = UMBRAL_PATRIMONIO_UVT * uvtForYear(u.ano + 1);
    if (u.pat >= um) hallazgos.push({ nivel: "alerta", texto: `Tu patrimonio líquido (${mm(u.pat)}) supera el umbral del impuesto al patrimonio (${mm(um)}). Míralo en la Calculadora de declaración.` });
    else if (u.pat >= um * 0.85) hallazgos.push({ nivel: "alerta", texto: `Tu patrimonio líquido (${mm(u.pat)}) se acerca al umbral del impuesto al patrimonio (${mm(um)}).` });
  }
  if (proy.imp > u.imp * 1.1) hallazgos.push({ nivel: "alerta", texto: `Si la tendencia sigue, en ${proy.ano} pagarías ${mm(proy.imp - u.imp)} más que en ${u.ano}. Revisa las oportunidades en la Calculadora de declaración.` });
  if (n < MAX_DECLARACIONES) hallazgos.push({ nivel: "info", texto: `Tienes ${n} de ${MAX_DECLARACIONES} declaraciones. Sube las que faltan para ver mejor la tendencia.` });
  return { serie: s, nat, kpis, proy, hallazgos };
}

// ─── Formato ──────────────────────────────────────────────────────────────
export function mm(v) {
  const x = num(v) / 1e6;
  return (x < 0 ? "−" : "") + "$" + Math.abs(x).toLocaleString("es-CO", { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 1 }) + " MM";
}
export const pct = (v, d = 1) => (num(v) * 100).toLocaleString("es-CO", { maximumFractionDigits: d }) + "%";
