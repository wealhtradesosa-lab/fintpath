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
 *  4) CF+ → aporte a reserva / Tu Norte
 *  5) Fiscal SOLO si UVT restantes Art.336 + CF cubre + saldo a pagar > 0
 *     (borrador; no tip; no toca taxCO.js)
 */

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
 * @param {object} [input.impuestoData]  salida de estimarImpuesto (solo lectura)
 * @returns {{ id: string, frase: string, monto: number|null, porQue: string, chip: string, path: string, detalle?: object }}
 */
export function elegirUnaAccion(input = {}) {
  const cf = num(input.cfMensual);
  const deudas = input.deudas || [];
  const metas = input.metas || [];
  const fiscal = readFiscalEspacio(input.impuestoData);

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

  // 4) CF+ → reserva / Tu Norte (antes que fiscal)
  const zReserva = Math.round(cf * 0.3); // 30% dentro del rango 20–50%
  if (zReserva > 0) {
    return {
      id: "reserva_norte",
      path: "reserva",
      frase: `Apartá ${fmtCop(zReserva)} a reserva / Tu Norte`,
      monto: zReserva,
      porQue:
        "Sin deuda cara ni meta con gap: el excedente del período fortalece reserva o el norte patrimonial.",
      chip: "Fondeado con tu CF",
      detalle: { cfMensual: cf, pct: 0.3 },
    };
  }

  // 5) Fiscal — SOLO si UVT restantes Art.336 + CF cubre + saldo a pagar > 0
  //    Copy borrador; NO toca taxCO.js
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
      return {
        id: "espacio_336",
        path: "fiscal",
        frase: `Te quedan ~${fiscal.uvtRestantes} UVT del tope Art. 336; un AFC/PV de ${fmtCop(aporte)} baja el saldo a pagar ~${fmtCop(ahorro)}`,
        monto: aporte,
        porQue:
          `Saldo a pagar estimado ${fmtCop(fiscal.saldoAPagar)} (borrador; no es tip ni liquidación DIAN).`,
        chip: "Fondeado con tu CF · estimación",
        detalle: { ...fiscal, aporte, ahorroEstimado: ahorro, cfMensual: cf },
      };
    }
  }

  // Fallback: reserva aunque el monto redondee a 0
  return {
    id: "reserva_norte",
    path: "reserva",
    frase: `Apartá ${fmtCop(zReserva)} a reserva / Tu Norte`,
    monto: zReserva,
    porQue:
      "Sin deuda cara ni meta con gap: el excedente del período fortalece reserva o el norte patrimonial.",
    chip: "Fondeado con tu CF",
    detalle: { cfMensual: cf, pct: 0.3 },
  };
}

function fmtCop(n) {
  return "$" + Math.round(num(n)).toLocaleString("es-CO");
}

export default elegirUnaAccion;