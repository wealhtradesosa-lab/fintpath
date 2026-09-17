/**
 * planDeudas.js — P0.3: Plan a cero ligado al CF.
 *
 * Solo cálculo. No toca taxCO / simulador / math #19 (solo llama proyectarPatrimonio)
 * ni FlujoAnual. CF mensual llega ya neto (post-cuotas) — misma fuente #19 / t.cf.
 *
 * Hook P0.2: exportar extraADeudas (el extra del plan cuando se ataca deuda).
 */

import { costoCredito, tasaMensualEq } from "./flowHelpers.js";
import {
  proyectarPatrimonio,
  estimarAmortizacionAnual,
  snapshotPatrimonio,
  DEFAULTS_PROYECCION,
} from "./proyeccionPatrimonio.js";

const CAP_MESES = 600; // 50 años

/** @param {unknown} n */
function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Deudas activas normalizadas a COP (USD→COP vía TRM).
 * Excluye sim === false. Tasa faltante/0 → se ordena por saldo (documentado).
 *
 * @param {object[]} deudas
 * @param {number} [trm=4200]
 */
export function listarDeudasActivas(deudas = [], trm = 4200) {
  const t = Math.max(0, num(trm) || 4200);
  return (deudas || [])
    .filter((d) => d && d.sim !== false)
    .map((d) => {
      const fx = String(d.moneda || "COP").toUpperCase() === "USD" ? t : 1;
      const saldoCOP = Math.round(num(d.mt) * fx);
      const cuotaCOP = Math.round(num(d.pg) * fx);
      const tasaEA = num(d.ts); // % E.A.
      const cc = costoCredito(d);
      // Interés mensual en COP: mismo espíritu que costoCredito
      const esSimple = d?.tipoInteres === "simple";
      const rMes =
        tasaEA <= 0
          ? 0
          : esSimple
            ? tasaEA / 100 / 12
            : tasaMensualEq(tasaEA);
      const interesMesCOP = saldoCOP * rMes;
      const noAmortiza =
        !!cc.noAmortiza ||
        (saldoCOP > 0 && cuotaCOP > 0 && rMes > 0 && cuotaCOP <= interesMesCOP);
      return {
        id: d.id,
        nombre: d.n || d.nombre || "(sin nombre)",
        saldoCOP,
        cuotaCOP,
        tasaEA,
        rMes,
        noAmortiza,
        monedaOrigen: String(d.moneda || "COP").toUpperCase(),
        mtOrig: num(d.mt),
        pgOrig: num(d.pg),
      };
    })
    .filter((d) => d.saldoCOP > 0);
}

/**
 * Orden de ataque.
 * @param {"avalanche"|"snowball"} metodo
 * avalanche (default): mayor tasa primero; empate → mayor saldo.
 * snowball: menor saldo primero; empate → mayor tasa.
 * Tasa 0 / faltante: cae al final en avalanche (por saldo); en snowball por saldo.
 */
export function ordenarDeudas(deudasNorm = [], metodo = "avalanche") {
  const arr = [...deudasNorm];
  if (metodo === "snowball") {
    arr.sort((a, b) => {
      if (a.saldoCOP !== b.saldoCOP) return a.saldoCOP - b.saldoCOP;
      return (b.tasaEA || 0) - (a.tasaEA || 0);
    });
  } else {
    // avalanche
    arr.sort((a, b) => {
      const ta = a.tasaEA || 0;
      const tb = b.tasaEA || 0;
      if (tb !== ta) return tb - ta;
      return b.saldoCOP - a.saldoCOP;
    });
  }
  return arr;
}

/**
 * Frase legible: "Primero [A] ($saldo @ tasa%). Luego [B]…"
 */
export function fraseOrden(deudasOrdenadas = [], fmt) {
  const fm =
    fmt ||
    ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  if (!deudasOrdenadas.length) return "";
  const parts = deudasOrdenadas.map((d, i) => {
    const tasa =
      d.tasaEA > 0
        ? `${Number(d.tasaEA).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`
        : "sin tasa";
    const chunk = `${d.nombre} (${fm(d.saldoCOP)} @ ${tasa})`;
    if (i === 0) return `Primero ${chunk}`;
    if (i === 1) return `Luego ${chunk}`;
    return chunk;
  });
  if (parts.length === 1) return parts[0] + ".";
  if (parts.length === 2) return parts[0] + ". " + parts[1] + ".";
  return (
    parts[0] +
    ". " +
    parts[1] +
    ". Después: " +
    parts.slice(2).join(" · ") +
    "."
  );
}

/**
 * Extra mensual default = max(0, CF post-cuotas).
 */
export function extraDefaultDesdeCF(cfMensual) {
  return Math.max(0, Math.round(num(cfMensual)));
}

/**
 * Simulación mes a mes hasta cero (o cap).
 * - Cuota mínima en todas; 100% del extra a la #1 del orden hasta 0, luego #2…
 * - Interés mensual ≈ rMes sobre saldo (espíritu costoCredito).
 *
 * @returns {{
 *   meses: number|null,
 *   converge: boolean,
 *   labelMeses: string,
 *   porDeuda: object[],
 *   algunaNoAmortiza: boolean,
 *   saldoFinal: number,
 * }}
 */
export function simularPlanACero(deudasOrdenadas = [], extraMensual = 0) {
  const extra = Math.max(0, num(extraMensual));
  if (!deudasOrdenadas.length) {
    return {
      meses: 0,
      converge: true,
      labelMeses: "0 meses",
      porDeuda: [],
      algunaNoAmortiza: false,
      saldoFinal: 0,
    };
  }

  // Estado mutable
  const state = deudasOrdenadas.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    saldo: d.saldoCOP,
    cuota: d.cuotaCOP,
    rMes: d.rMes,
    tasaEA: d.tasaEA,
    noAmortiza: d.noAmortiza,
    mesCero: null,
  }));

  const algunaNoAmortiza = state.some((d) => d.noAmortiza);
  let months = 0;

  while (months < CAP_MESES) {
    if (state.every((d) => d.saldo <= 0.5)) break;
    months += 1;
    let poolExtra = extra;

    // 1) Interés + cuota mínima en todas
    for (const d of state) {
      if (d.saldo <= 0) continue;
      const interes = d.saldo * d.rMes;
      d.saldo += interes;
      const pagoMin = Math.min(d.cuota, d.saldo);
      d.saldo -= pagoMin;
      // Si la cuota supera el saldo, el sobrante refuerza el extra del mes
      const sobrante = Math.max(0, d.cuota - pagoMin);
      poolExtra += sobrante;
      if (d.saldo <= 0.5) {
        d.saldo = 0;
        if (d.mesCero == null) d.mesCero = months;
      }
    }

    // 2) Extra 100% a la primera con saldo > 0 (orden avalanche/snowball)
    for (const d of state) {
      if (poolExtra <= 0) break;
      if (d.saldo <= 0) continue;
      const abono = Math.min(poolExtra, d.saldo);
      d.saldo -= abono;
      poolExtra -= abono;
      if (d.saldo <= 0.5) {
        d.saldo = 0;
        if (d.mesCero == null) d.mesCero = months;
      }
    }
  }

  const saldoFinal = Math.round(state.reduce((s, d) => s + d.saldo, 0));
  const converge = saldoFinal <= 0;
  const meses = converge ? months : null;

  let labelMeses;
  if (!converge || months >= CAP_MESES && saldoFinal > 0) {
    labelMeses = ">50 años";
  } else if (meses === 0) {
    labelMeses = "0 meses";
  } else if (meses === 1) {
    labelMeses = "1 mes";
  } else if (meses < 12) {
    labelMeses = `${meses} meses`;
  } else {
    const y = Math.floor(meses / 12);
    const m = meses % 12;
    // 16-sep-2026 (Santiago: "3a es que 3 años?"). Si hay que preguntarlo, la
    // abreviatura no está ahorrando nada. "2a 8m" se lee rápido solo si ya
    // sabés qué significa; escrito completo no necesita traducción.
    const añosTxt = `${y} ${y === 1 ? "año" : "años"}`;
    labelMeses =
      m === 0
        ? `${meses} meses (${añosTxt})`
        : `${meses} meses (${añosTxt} y ${m} ${m === 1 ? "mes" : "meses"})`;
  }

  return {
    meses,
    converge: !!converge && saldoFinal <= 0,
    labelMeses,
    porDeuda: state.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      mesCero: d.mesCero,
      saldoFinal: Math.round(d.saldo),
      noAmortiza: d.noAmortiza,
      tasaEA: d.tasaEA,
      saldo0: deudasOrdenadas.find((x) => x.id === d.id)?.saldoCOP || 0,
      cuota: d.cuota,
    })),
    algunaNoAmortiza,
    saldoFinal,
  };
}

/**
 * Trade-off 3 años reusando proyectarPatrimonio (#19) SIN cambiar su math.
 *
 * A — atacar deuda: CF a activos ≈ (cf − extra); amort += extra×12
 * B — extra queda en patrimonio con el MISMO supuesto #19 (valorización
 *     retornoExcedente default 6%, pre-impuestos). NO es consejo de inversión
 *     ni AFC/PV / beneficio fiscal (#20).
 */
export function tradeOffVsInvertir({
  user = {},
  cfMensual = 0,
  extraMensual = 0,
  deudas = null,
  retornoExcedente = DEFAULTS_PROYECCION.retornoExcedente,
  inflacionAnual = DEFAULTS_PROYECCION.inflacionAnual,
} = {}) {
  const cf = num(cfMensual);
  const extra = Math.max(0, num(extraMensual));
  const trm = user?.trm || 4200;
  const deu = deudas != null ? deudas : user?.deudas || user?.deu || [];
  const snap = snapshotPatrimonio(
    { ...user, deudas: deu, trm },
    {}
  );
  const amortBase = estimarAmortizacionAnual(deu, trm);

  // A: extra va a bajar deudas → menos CF a activos, más amortización
  const cfA = Math.max(0, cf - extra);
  const amortA = amortBase + Math.round(extra * 12);
  const proyA = proyectarPatrimonio({
    activos0: snap.activos,
    deudas0: snap.deudasTotales,
    patrimonioNeto0: snap.patrimonioNeto,
    cfAnual: Math.round(cfA * 12),
    amortizacionAnual: amortA,
    retornoExcedente,
    inflacionAnual,
    horizontes: [3],
  });

  // B: extra queda en patrimonio (CF completo a activos) bajo supuesto #19; deudas solo mínimas
  const proyB = proyectarPatrimonio({
    activos0: snap.activos,
    deudas0: snap.deudasTotales,
    patrimonioNeto0: snap.patrimonioNeto,
    cfAnual: Math.round(cf * 12),
    amortizacionAnual: amortBase,
    retornoExcedente,
    inflacionAnual,
    horizontes: [3],
  });

  const hA = proyA.porHorizonte[0];
  const hB = proyB.porHorizonte[0];
  const serieB3 = proyB.serie.find((s) => s.año === 3) || proyB.serie[proyB.serie.length - 1];

  return {
    escenarioA: {
      patrimonio3a: hA.patrimonio,
      veredicto: hA.veredicto, // "crece" | "se_come"
      cfMensualActivos: cfA,
      amortizacionAnual: amortA,
    },
    escenarioB: {
      patrimonio3a: hB.patrimonio,
      veredicto: hB.veredicto,
      cfMensualActivos: cf,
      amortizacionAnual: amortBase,
      deudasRestantes3a: serieB3.deudas,
    },
    snap,
    retornoExcedente,
    inflacionAnual,
  };
}

/**
 * Copy duro del trade-off (ES).
 * Escenario B = supuesto #19 (valorización pre-impuestos), nunca “invertí al X%” / AFC/PV.
 */
export function fraseTradeOff({
  extraMensual,
  labelMeses,
  trade,
  fmt,
} = {}) {
  const fm =
    fmt ||
    ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  const x = Math.round(num(extraMensual));
  if (!trade) return "";
  const verA =
    trade.escenarioA.veredicto === "crece" ? "Crece" : "Se come";
  const verB =
    trade.escenarioB.veredicto === "crece" ? "Crece" : "Se come";
  const pct = Math.round((Number(trade.retornoExcedente) || 0.06) * 1000) / 10;
  // 16-sep-2026 (Santiago: "esto no se entiende, confuso, mal redactado, poco
  // claro"). El texto anterior era una sola linea con cinco cifras, dos
  // escenarios, dos veredictos, una referencia interna al "supuesto #19" y un
  // disclaimer, separados por puntos medios. Nombraba un supuesto por su numero
  // de ficha interna, que al usuario no le dice nada, y dejaba implicito lo
  // unico que importa: cual de los dos caminos deja mas patrimonio.
  //
  // Ahora se estructura como la decision que es -- dos opciones comparables --
  // y se cierra con la diferencia calculada, que es la respuesta.
  const difA = num(trade.escenarioA.patrimonio3a) - num(trade.escenarioB.patrimonio3a);
  const gana = difA >= 0 ? "pagar las deudas" : "dejarlo invertido";
  const dif = fm(Math.abs(difA));

  return (
    `Si destinás ${fm(x)} al mes a pagar deudas: quedás en cero en ${labelMeses}, ` +
    `y a 3 años tu patrimonio sería ${fm(trade.escenarioA.patrimonio3a)}.\n` +
    `Si en cambio dejás esa plata invertida: a 3 años tu patrimonio sería ` +
    `${fm(trade.escenarioB.patrimonio3a)}, pero seguirías debiendo ` +
    `${fm(trade.escenarioB.deudasRestantes3a)}.\n` +
    `A 3 años conviene ${gana}, por una diferencia de ${dif}. ` +
    `Supone que lo invertido se valoriza ${pct}% anual, antes de impuestos. ` +
    `Es una comparación, no una recomendación de inversión.`
  );
}

/**
 * Orquestador: plan completo a partir de user.deudas + CF.
 *
 * @returns plan + extraADeudas (hook P0.2)
 */
export function calcularPlanDeudas({
  deudas = [],
  cfMensual = 0,
  extraOverride = null,
  metodo = "avalanche", // "avalanche" | "snowball"
  trm = 4200,
  user = {},
  fmt,
} = {}) {
  const activas = listarDeudasActivas(deudas, trm);
  const ordenadas = ordenarDeudas(activas, metodo);
  const cf = num(cfMensual);
  const extraDefault = extraDefaultDesdeCF(cf);
  const extra =
    extraOverride != null && extraOverride !== ""
      ? Math.max(0, num(extraOverride))
      : extraDefault;
  const usandoCF = extraOverride == null || extraOverride === "";

  if (!ordenadas.length) {
    return {
      vacio: true,
      emptyCopy:
        "No hay deudas activas — el CF puede ir a metas/norte.",
      ordenadas: [],
      frase: "",
      extra,
      extraDefault,
      usandoCF,
      cfMensual: cf,
      sim: null,
      trade: null,
      fraseTrade: "",
      extraADeudas: 0,
      cfSinPositivo: cf <= 0,
    };
  }

  const sim = simularPlanACero(ordenadas, extra);
  const trade = tradeOffVsInvertir({
    user: { ...user, deudas, trm },
    cfMensual: cf,
    extraMensual: extra,
    deudas,
  });
  const frase = fraseOrden(ordenadas, fmt);
  const fraseTrade = fraseTradeOff({
    extraMensual: extra,
    labelMeses: sim.labelMeses,
    trade,
    fmt,
  });

  return {
    vacio: false,
    emptyCopy: null,
    ordenadas,
    frase,
    extra,
    extraDefault,
    usandoCF,
    cfMensual: cf,
    sim,
    trade,
    fraseTrade,
    // Hook P0.2: si el bloque está on y hay extra > 0 atacando, Metas resta esto del CF
    extraADeudas: Math.round(extra),
    cfSinPositivo: cf <= 0,
    metodo,
  };
}

export const FUENTE_CF_PLAN =
  "CF mensual post-cuotas (t.cf / FlujoAnual; mismo neteo que #19 / simT.cf).";

export const COPY_CF_NO_POSITIVO =
  "Sin CF positivo el plan es solo cuotas mínimas.";

export const CHIP_NO_AMORTIZA = "No amortiza — revisá cuota/tasa";
