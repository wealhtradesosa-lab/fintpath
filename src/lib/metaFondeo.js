/**
 * metaFondeo.js — P0.2: meta → aporte desde CF → gap + trade-offs.
 *
 * Solo cálculo. No toca taxCO / simulador / #19 / FlujoAnual.
 * CF mensual llega ya neto (post-cuotas) desde App t.cf / simT.cf / FlujoAnual.
 *
 * P0.3 hook: extraADeudas resta del CF disponible para metas.
 */

/** @param {unknown} n */
function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Convierte monto a COP si la meta está en USD.
 * @param {number} monto
 * @param {string} [moneda]
 * @param {number} [trm]
 */
export function montoEnCOP(monto, moneda = "COP", trm = 4200) {
  const m = num(monto);
  if (String(moneda || "COP").toUpperCase() === "USD") {
    return Math.round(m * Math.max(0, num(trm) || 4200));
  }
  return Math.round(m);
}

/**
 * Meses hasta fechaMeta (YYYY-MM o YYYY-MM-DD).
 * Si fecha pasada / inválida → mesesRestantes = 1 y vencida = true.
 * Si no hay fecha → mesesRestantes = null (no calcular aporte).
 */
export function mesesHastaFecha(fechaMeta, hoy = new Date()) {
  if (!fechaMeta) {
    return { mesesRestantes: null, vencida: false, fechaObj: null };
  }
  const raw = String(fechaMeta).trim();
  // Normalizar YYYY-MM → primer día del mes siguiente conceptual: usar día 1
  const fechaObj = new Date(raw.length === 7 ? raw + "-01" : raw);
  if (Number.isNaN(fechaObj.getTime())) {
    return { mesesRestantes: null, vencida: false, fechaObj: null };
  }
  const start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const end = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), 1);
  const meses =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (meses <= 0) {
    return { mesesRestantes: 1, vencida: true, fechaObj };
  }
  return { mesesRestantes: meses, vencida: false, fechaObj };
}

/**
 * CF disponible para metas = CF post-cuotas − extra a deudas.
 * extraADeudas viene de Plan a cero (P0.3) vía App.
 */
export function cfDisponibleMetas(cfMensual, extraADeudas = 0) {
  return num(cfMensual) - num(extraADeudas);
}

/**
 * Calcula fondeo de una meta.
 *
 * @param {object} meta
 * @param {object} opts
 * @param {number} opts.cfMensual — CF post-cuotas (t.cf / simT.cf)
 * @param {number} [opts.trm]
 * @param {number} [opts.extraADeudas=0] — P0.3 hook
 * @param {Date} [opts.hoy]
 */
export function calcularFondeoMeta(meta = {}, opts = {}) {
  const trm = num(opts.trm) || 4200;
  const extraADeudas = num(opts.extraADeudas); // V1 = 0
  const cfFuente = cfDisponibleMetas(opts.cfMensual, extraADeudas);
  const moneda = meta.moneda || "COP";
  const objetivoCOP = montoEnCOP(meta.monto, moneda, trm);
  const acumuladoCOP = montoEnCOP(meta.ahorrado, moneda, trm);
  const restante = Math.max(0, objetivoCOP - acumuladoCOP);
  const pctAvance =
    objetivoCOP > 0
      ? Math.min(100, (acumuladoCOP / objetivoCOP) * 100)
      : 0;
  const done = objetivoCOP > 0 && restante <= 0;

  const { mesesRestantes, vencida, fechaObj } = mesesHastaFecha(
    meta.fechaMeta,
    opts.hoy || new Date()
  );

  const sinMonto = !(objetivoCOP > 0);
  const sinFecha = mesesRestantes == null;

  let aporteSugerido = null;
  if (!sinMonto && !sinFecha && !done) {
    aporteSugerido = Math.round(restante / Math.max(1, mesesRestantes));
  } else if (!sinMonto && vencida && !done) {
    aporteSugerido = Math.round(restante); // de una vez
  }

  const gap =
    aporteSugerido != null ? aporteSugerido - cfFuente : null;

  // Alcanza / No alcanza
  let veredicto = null; // "alcanza" | "no_alcanza" | null
  let frase = null;
  if (sinMonto) {
    frase = "Indicá un monto objetivo para ver si el CF la fondea.";
  } else if (done) {
    veredicto = "alcanza";
    frase = "Meta completada: acumulado cubre el objetivo.";
  } else if (sinFecha) {
    frase = "Indicá una fecha para calcular el aporte mensual.";
  } else if (cfFuente <= 0) {
    veredicto = "no_alcanza";
    frase =
      "Con CF ≤ 0 no hay aporte; primero estabilizá el flujo.";
  } else if (gap != null && gap <= 0) {
    veredicto = "alcanza";
    frase = `Con $${Math.round(aporteSugerido).toLocaleString("es-CO")}/mes desde tu CF llegas en ${mesesRestantes} meses.`;
  } else if (gap != null && gap > 0) {
    veredicto = "no_alcanza";
    frase = `Tu CF da $${Math.round(cfFuente).toLocaleString("es-CO")}/mes; necesitás $${Math.round(aporteSugerido).toLocaleString("es-CO")}. Gap $${Math.round(gap).toLocaleString("es-CO")}.`;
  }

  const tradeOffs = buildTradeOffs({
    restante,
    mesesRestantes,
    cfFuente,
    aporteSugerido,
    gap,
    vencida,
    done,
    sinMonto,
    sinFecha,
  });

  return {
    objetivoCOP,
    acumuladoCOP,
    restante,
    pctAvance,
    done,
    mesesRestantes,
    vencida,
    fechaObj,
    aporteSugerido,
    cfDisponible: Math.round(cfFuente),
    extraADeudas: Math.round(extraADeudas),
    gap: gap != null ? Math.round(gap) : null,
    veredicto,
    frase,
    tradeOffs,
    monedaOrigen: String(moneda || "COP").toUpperCase(),
    trm,
    sinMonto,
    sinFecha,
  };
}

/**
 * Trade-offs clicables: solo recalculan; no ejecutan pagos.
 * 1) Recortar gasto $G/mes → llega en M
 * 2) Alargar fecha a M' (aporte = CF)
 * 3) Bajar monto a lo fondeable con CF × meses
 * 4) Posponer (chip; sin cálculo)
 */
export function buildTradeOffs({
  restante,
  mesesRestantes,
  cfFuente,
  aporteSugerido,
  gap,
  vencida,
  done,
  sinMonto,
  sinFecha,
}) {
  if (done || sinMonto || sinFecha || aporteSugerido == null) return [];

  const M = Math.max(1, mesesRestantes || 1);
  const cf = num(cfFuente);
  const G = Math.max(0, Math.round(gap || 0));
  const items = [];

  // 1) Recortar gasto
  if (G > 0) {
    items.push({
      id: "recortar",
      label: `Recortar gasto $${G.toLocaleString("es-CO")}/mes → llegás en ${M} meses`,
      recalculo: {
        tipo: "recortar_gasto",
        recorteMensual: G,
        meses: M,
        aporteEfectivo: Math.round(aporteSugerido),
      },
    });
  } else if (cf <= 0 && restante > 0) {
    // CF≤0: trade-off 1 sigue útil como número (cuánto hay que abrir de CF)
    items.push({
      id: "recortar",
      label: `Abrir CF de $${Math.round(aporteSugerido).toLocaleString("es-CO")}/mes → llegás en ${M} meses`,
      recalculo: {
        tipo: "recortar_gasto",
        recorteMensual: Math.round(aporteSugerido),
        meses: M,
        aporteEfectivo: Math.round(aporteSugerido),
      },
    });
  }

  // 2) Alargar fecha (aporte = CF disponible)
  if (cf > 0 && restante > 0) {
    const mesesConCF = Math.max(1, Math.ceil(restante / cf));
    items.push({
      id: "alargar",
      label: `Alargar fecha a ${mesesConCF} meses (aporte = $${Math.round(cf).toLocaleString("es-CO")}/mes)`,
      recalculo: {
        tipo: "alargar_fecha",
        meses: mesesConCF,
        aporte: Math.round(cf),
      },
    });
  } else if (cf <= 0) {
    items.push({
      id: "alargar",
      label: "Alargar fecha no alcanza: CF ≤ 0 (sin aporte mensual)",
      recalculo: { tipo: "alargar_fecha", meses: null, aporte: 0 },
    });
  }

  // 3) Bajar monto a lo fondeable CF × meses
  if (cf > 0 && M > 0) {
    const montoFondeable = Math.round(cf * M);
    items.push({
      id: "bajar",
      label: `Bajar monto a $${montoFondeable.toLocaleString("es-CO")} (CF × ${M} meses)`,
      recalculo: {
        tipo: "bajar_monto",
        montoFondeable,
        meses: M,
        aporte: Math.round(cf),
      },
    });
  } else if (cf <= 0) {
    items.push({
      id: "bajar",
      label: "Bajar monto: con CF ≤ 0 lo fondeable este mes es $0",
      recalculo: { tipo: "bajar_monto", montoFondeable: 0, meses: M, aporte: 0 },
    });
  }

  // 4) Posponer (sin cálculo)
  items.push({
    id: "posponer",
    label: "Posponer meta",
    recalculo: { tipo: "posponer" },
  });

  return items;
}

/**
 * Nota V1: muchas metas compiten por el mismo CF (no se reparte).
 */
export const NOTA_CF_COMPARTIDO =
  "CF es el mismo para todas — priorizá. En V1 no se reparte el CF entre metas.";

export const EMPTY_STATE_COPY =
  "Creá una meta con monto y fecha para ver si el CF la fondea.";

export const FUENTE_CF_DEFAULT =
  "CF mensual post-cuotas (t.cf / FlujoAnual; mismo neteo que #19 / simT.cf). Extra a deudas restado del CF cuando Plan a cero (P0.3) está activo.";
