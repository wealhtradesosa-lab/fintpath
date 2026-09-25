/**
 * ctaUnaAccion.js — P0.1 selector determinista de “una acción” fondeada.
 *
 * NO toca taxCO.js / Art.206 / 336. Solo lee saldoAPagar / espacio UVT
 * del detalle ya calculado por estimarImpuesto (impuestoData).
 *
 * Prioridad (primera que aplique):
 *  1) CF ≤ 0 → no aumentar gasto / estabilizar CF
 *  2) Deuda con saldo y mayor tasa → abono extra $X
 *  3) Meta con gap de fondeo → apartar $Z
 *  4) Colchón líquido corto (< ~6 meses de egresos, o sin datos → asumir corto)
 *     → reserva (por qué cita meses de colchón)
 *  5) Fiscal SOLO si UVT restantes Art.336 + saldoAPagar > 0 + CF cubre
 *     (borrador; por qué cita meses colchón + UVT + saldo; no tip; no toca taxCO.js)
 *  6) Else → aporte a norte / inversión (no reserva ciega)
 */

/** Meses de egresos que definen colchón “suficiente”. */
export const MESES_COLCHON_OBJETIVO = 6;

import { montoPromedioMensual } from "./flowHelpers.js";

/** @param {number} n */
function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Deuda con mayor tasa E.A. y saldo > 0.
 * Campos legacy: ts (tasa %), mt (saldo), pg (cuota), n (nombre).
 */
export function pickDeudaCara(deudas = []) {
  let best = null;
  for (const d of deudas || []) {
    const saldo = num(d.mt ?? d.saldo ?? d.balance);
    if (saldo <= 0) continue;
    const tasa = num(d.ts ?? d.tasa ?? d.rate);
    if (!best || tasa > best.tasa) {
      best = {
        id: d.id || d.n || "deuda",
        nombre: d.n || d.nombre || "deuda",
        saldo,
        tasa,
        cuota: num(d.pg ?? d.cuota ?? d.payment),
      };
    }
  }
  return best;
}

/**
 * Meta activa con mayor gap (monto − ahorrado). Prioriza prioridad alta.
 */
export function pickMetaConGap(metas = []) {
  const activas = (metas || [])
    .map((m) => {
      const monto = num(m.monto);
      const ahorrado = num(m.ahorrado);
      const gap = Math.max(0, monto - ahorrado);
      return {
        id: m.id || m.nombre || "meta",
        nombre: m.nombre || "meta",
        monto,
        ahorrado,
        gap,
        prioridad: m.prioridad || "media",
      };
    })
    .filter((m) => m.gap > 0);

  if (activas.length === 0) return null;

  const priRank = { alta: 0, media: 1, baja: 2 };
  activas.sort((a, b) => {
    const pa = priRank[a.prioridad] ?? 1;
    const pb = priRank[b.prioridad] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.gap - a.gap;
  });
  return activas[0];
}

/**
 * Lee espacio Art.336 / saldo a pagar del detalle de estimarImpuesto.
 * Solo lectura — no recalcula el motor.
 */
export function readFiscalEspacio(impuestoData) {
  const detalle = (impuestoData && impuestoData.detalle) || [];
  let espacioCop = 0;
  let saldoAPagar = 0;
  let lim40 = 0;
  let uvtValue = 0;
  let topeArt336UVT = 0;

  for (const td of detalle) {
    espacioCop += Math.max(0, num(td.espacioParaPVyAFC));
    saldoAPagar += Math.max(0, num(td.saldoAPagar ?? td.impuesto));
    lim40 = Math.max(lim40, num(td.lim40 ?? td.tope336));
    topeArt336UVT = Math.max(topeArt336UVT, num(td.topeArt336UVT));
    // lim40 está en COP; uvt implícito si tenemos tope UVT
    if (td.topeArt336UVT && td.lim1340) {
      const u = num(td.lim1340) / num(td.topeArt336UVT);
      if (u > 0) uvtValue = u;
    }
  }

  // Fallback UVT AG 2025 si el detalle no trae lim1340
  if (!uvtValue) uvtValue = 49799;

  const uvtRestantes =
    uvtValue > 0 ? Math.floor(espacioCop / uvtValue) : 0;

  return {
    espacioCop: Math.round(espacioCop),
    uvtRestantes,
    uvtValue,
    saldoAPagar: Math.round(saldoAPagar),
    lim40: Math.round(lim40),
    topeArt336UVT,
  };
}

/**
 * Heurística de liquidez (colchón):
 *  - Suma valor actual (va / valor_actual / valor) de user.inv cuyo tipo o
 *    nombre sea cash/savings-like: Cash, efectivo, ahorro, cuenta, savings,
 *    liquid. NO incluye CDT / fondos / RE (menos líquidos para emergencia).
 *  - + bank si está presente: user.bank | banco | bancos | cuentasBancarias
 *    (número, o array con saldo/balance/mt/va).
 * Documentado a propósito: estimación de UI, no auditoría patrimonial.
 *
 * @returns {{ liquidos: number, hasLiquidData: boolean, fuentes: string[] }}
 */
export function estimateLiquidos(user = {}) {
  const fuentes = [];
  let liquidos = 0;
  let hasLiquidData = false;

  const inv = user.inv || user.inversiones || [];
  const cashRe =
    /cash|efectivo|ahorro|cuenta|savings|liquid|disponible/i;

  for (const i of inv) {
    if (!i || i.sim === false) continue;
    const tipo = String(i.tp || i.tipo || i.type || "").trim();
    const nombre = String(i.n || i.nombre || i.name || "").trim();
    const isCashLike =
      /^cash$/i.test(tipo) ||
      cashRe.test(tipo) ||
      cashRe.test(nombre);
    if (!isCashLike) continue;
    const va = num(i.va ?? i.valor_actual ?? i.valor ?? 0);
    if (va <= 0) continue;
    liquidos += va;
    hasLiquidData = true;
    fuentes.push(nombre || tipo || "cash");
  }

  // Bank opcional (aún no hay módulo dedicado en todos los perfiles)
  const bankRaw =
    user.bank ?? user.banco ?? user.bancos ?? user.cuentasBancarias;
  if (bankRaw != null) {
    hasLiquidData = true;
    if (typeof bankRaw === "number" || typeof bankRaw === "string") {
      const v = num(bankRaw);
      if (v > 0) {
        liquidos += v;
        fuentes.push("bank");
      }
    } else if (Array.isArray(bankRaw)) {
      for (const b of bankRaw) {
        const v = num(
          typeof b === "number"
            ? b
            : b?.saldo ?? b?.balance ?? b?.mt ?? b?.va ?? 0
        );
        if (v > 0) {
          liquidos += v;
          fuentes.push(b?.n || b?.nombre || "bank");
        }
      }
    } else if (typeof bankRaw === "object") {
      const v = num(
        bankRaw.saldo ?? bankRaw.balance ?? bankRaw.mt ?? bankRaw.va ?? 0
      );
      if (v > 0) {
        liquidos += v;
        fuentes.push("bank");
      }
    }
  }

  return {
    liquidos: Math.round(liquidos),
    hasLiquidData,
    fuentes,
  };
}

/**
 * Heurística de egresos mensuales para colchón:
 *  1) Preferir egresosMensuales del sim CF (input.egresosMensuales / simT.te).
 *  2) Si no: sumar gastos de user.gastos|gas + cuotas deudas (pg/pago).
 * Usa montoPromedioMensual de flowHelpers para respetar frecuencia y vigencia.
 */
export function estimateEgresosMensuales(input = {}) {
  const fromSim = num(
    input.egresosMensuales ?? input.egresosTotales ?? input.te
  );
  if (fromSim > 0) return Math.round(fromSim);

  const user = input.user || {};
  const gastos = user.gastos || user.gas || {};
  let sum = 0;
  for (const items of Object.values(gastos || {})) {
    for (const g of items || []) {
      if (!g || g.sim === false) continue;
      // 25-sep-2026 — `m` es residual en gastos variables (el motor usa
      // montosMensuales). Leerlo crudo inflaba el colchón exigido.
      sum += montoPromedioMensual(g) || num(g.monto ?? g.amount);
    }
  }
  for (const d of user.deudas || user.deu || []) {
    if (!d || d.sim === false) continue;
    if (num(d.mt ?? d.saldo) <= 0) continue;
    sum += num(d.pg ?? d.pago ?? d.cuota);
  }
  return Math.round(sum);
}

/**
 * Meses de colchón = líquidos / egresos mensuales.
 * Sin datos de liquidez → asumir corto (meses = 0, short = true).
 */
export function computeColchon(user = {}, egresosMensuales = 0) {
  const { liquidos, hasLiquidData, fuentes } = estimateLiquidos(user);
  const egresos = Math.max(0, num(egresosMensuales));

  if (!hasLiquidData) {
    return {
      liquidos,
      egresosMensuales: egresos,
      meses: 0,
      short: true,
      sinDatos: true,
      fuentes,
      objetivo: MESES_COLCHON_OBJETIVO,
    };
  }

  const meses =
    egresos > 0 ? liquidos / egresos : liquidos > 0 ? Infinity : 0;
  const mesesRedondeados =
    meses === Infinity ? Infinity : Math.round(meses * 10) / 10;
  const short =
    meses === Infinity ? false : meses < MESES_COLCHON_OBJETIVO;

  return {
    liquidos,
    egresosMensuales: egresos,
    meses: mesesRedondeados,
    short,
    sinDatos: false,
    fuentes,
    objetivo: MESES_COLCHON_OBJETIVO,
  };
}

function fmtMesesColchon(meses) {
  if (meses === Infinity) return "∞";
  if (!Number.isFinite(meses)) return "0";
  return String(Math.round(meses * 10) / 10);
}

/**
 * Estima ahorro aproximado en saldo a pagar si se usa espacio PV/AFC.
 * Heurística conservadora: tasa marginal ~19% acotada al saldo a pagar.
 * Es borrador de UI — NO es tip ni liquidación.
 */
function estimarAhorroSaldo(aporteCop, saldoAPagar) {
  const bruto = Math.round(aporteCop * 0.19);
  return Math.min(bruto, Math.max(0, saldoAPagar));
}

/**
 * Selector principal.
 *
 * @param {object} input
 * @param {number} input.cfMensual  simT.cf
 * @param {object[]} [input.deudas]
 * @param {object[]} [input.metas]
 * @param {object} [input.user]  para inv / bank / gastos (colchón)
 * @param {number} [input.egresosMensuales]  simT.egresosTotales / te
 * @param {object} [input.impuestoData]  salida de estimarImpuesto (solo lectura)
 * @returns {{ id: string, frase: string, monto: number|null, porQue: string, chip: string, path: string, detalle?: object }}
 */
export function elegirUnaAccion(input = {}) {
  const cf = num(input.cfMensual);
  const deudas = input.deudas || input.user?.deudas || input.user?.deu || [];
  const metas = input.metas || input.user?.metas || [];
  const user = input.user || {
    inv: input.inv || [],
    deudas,
    gastos: input.gastos || {},
    bank: input.bank,
  };
  const fiscal = readFiscalEspacio(input.impuestoData);
  const egresos = estimateEgresosMensuales({
    ...input,
    user,
  });
  const colchon = computeColchon(user, egresos);

  // 1) CF ≤ 0 → estabilizar / no aumentar gasto
  if (cf <= 0) {
    const anual = Math.round(cf * 12);
    return {
      id: "estabilizar_cf",
      path: "cf_rojo",
      frase:
        cf < 0
          ? "No aumentes gasto fijo: estabilizá el cash flow"
          : "No aumentes gasto fijo: el cash flow está en cero",
      monto: anual !== 0 ? anual : null,
      porQue:
        anual < 0
          ? `Con CF de ${fmtCop(anual)}/año te comés el patrimonio si sostienes este ritmo.`
          : "Sin excedente no hay abono extra ni reserva; primero equilibrá ingresos y egresos.",
      chip: "CF no alcanza — no aumentes gasto",
      detalle: { cfMensual: cf, cfAnual: anual },
    };
  }

  // 2) Deuda cara con saldo
  const deuda = pickDeudaCara(deudas);
  if (deuda) {
    const halfCf = Math.round(cf * 0.5);
    const unaCuota = deuda.cuota > 0 ? deuda.cuota : halfCf;
    const x = Math.max(0, Math.min(halfCf, unaCuota, deuda.saldo));
    if (x > 0) {
      return {
        id: "abono_deuda",
        path: "deuda",
        frase: `Esta semana: aboná ${fmtCop(x)} extra a ${deuda.nombre}`,
        monto: x,
        porQue: `Es tu deuda con mayor tasa (${deuda.tasa.toFixed(1)}% E.A.) y saldo ${fmtCop(deuda.saldo)}.`,
        chip: "Fondeado con tu CF",
        detalle: { ...deuda, cfMensual: cf },
      };
    }
  }

  // 3) Meta con gap
  const meta = pickMetaConGap(metas);
  if (meta) {
    const z = Math.max(
      0,
      Math.min(Math.round(cf * 0.4), meta.gap, Math.round(cf))
    );
    if (z > 0) {
      return {
        id: "fondear_meta",
        path: "meta",
        frase: `Apartá ${fmtCop(z)} hacia “${meta.nombre}”`,
        monto: z,
        porQue: `Te faltan ${fmtCop(meta.gap)} para esa meta; este paso usa parte del CF del período.`,
        chip: "Fondeado con tu CF",
        detalle: { ...meta, cfMensual: cf },
      };
    }
  }

  // 4) Colchón corto (< ~6 meses) o sin datos de liquidez → reserva
  if (colchon.short) {
    const zReserva = Math.round(cf * 0.3);
    const mesesTxt = colchon.sinDatos
      ? "sin datos de liquidez (asumimos colchón corto)"
      : `~${fmtMesesColchon(colchon.meses)} meses de egresos`;
    return {
      id: "reserva_colchon",
      path: "reserva",
      frase: `Apartá ${fmtCop(zReserva)} a reserva (colchón)`,
      monto: zReserva,
      porQue: colchon.sinDatos
        ? `Sin datos de liquidez suficientes, asumimos colchón corto (<${MESES_COLCHON_OBJETIVO} meses). Priorizá reserva antes de fiscal o norte.`
        : `Tu colchón líquido cubre ${mesesTxt} (meta ~${MESES_COLCHON_OBJETIVO}). Priorizá reserva antes de fiscal o norte.`,
      chip: "Fondeado con tu CF · colchón",
      detalle: {
        cfMensual: cf,
        pct: 0.3,
        colchon,
      },
    };
  }

  // 5) Fiscal — UVT restantes Art.336 + saldoAPagar > 0 + CF cubre
  //    Copy borrador; NO toca taxCO.js; por qué cita colchón + UVT + saldo
  if (
    fiscal.uvtRestantes > 0 &&
    fiscal.espacioCop > 0 &&
    fiscal.saldoAPagar > 0 &&
    cf > 0
  ) {
    const aporte = Math.max(
      0,
      Math.min(fiscal.espacioCop, Math.round(cf * 0.5), Math.round(cf))
    );
    if (aporte > 0) {
      const ahorro = estimarAhorroSaldo(aporte, fiscal.saldoAPagar);
      const mesesTxt = fmtMesesColchon(colchon.meses);
      return {
        id: "espacio_336",
        path: "fiscal",
        frase: `Te quedan ~${fiscal.uvtRestantes} UVT del tope Art. 336; un AFC/PV de ${fmtCop(aporte)} baja el saldo a pagar ~${fmtCop(ahorro)}`,
        monto: aporte,
        porQue: `Colchón ~${mesesTxt} meses (≥${MESES_COLCHON_OBJETIVO}); ~${fiscal.uvtRestantes} UVT restantes Art.336; saldo a pagar estimado ${fmtCop(fiscal.saldoAPagar)} (borrador; no es tip ni liquidación DIAN).`,
        chip: "Fondeado con tu CF · estimación",
        detalle: {
          ...fiscal,
          aporte,
          ahorroEstimado: ahorro,
          cfMensual: cf,
          colchon,
        },
      };
    }
  }

  // 6) Norte / inversión (no reserva ciega)
  const zNorte = Math.round(cf * 0.3);
  const mesesTxt = fmtMesesColchon(colchon.meses);
  return {
    id: "aporte_norte",
    path: "norte",
    frase: `Apartá ${fmtCop(zNorte)} a Tu Norte / inversión`,
    monto: zNorte,
    porQue: `Colchón ~${mesesTxt} meses (≥${MESES_COLCHON_OBJETIVO}) y sin espacio fiscal prioritario: el excedente del período va a norte patrimonial / inversión — no a reserva ciega.`,
    chip: "Fondeado con tu CF · norte",
    detalle: { cfMensual: cf, pct: 0.3, colchon },
  };
}

function fmtCop(n) {
  return "$" + Math.round(num(n)).toLocaleString("es-CO");
}

export default elegirUnaAccion;