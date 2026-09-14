// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · proyeccionPatrimonio.js
//
// Proyecta el patrimonio neto si se SOSTIENE el cash flow anual simulado.
// Bloque NUEVO bajo el chart del SimuladorAvanzado — no toca el motor simT
// ni taxCO.js.
//
// Fórmula (Finanzas, conservadora, año a año):
//   activos_t   = activos_{t-1} × (1 + r) + CF_anual
//   deudas_t    = max(0, deudas_{t-1} − amortización_anual_estimada)
//   patrimonio_t = activos_t − deudas_t
//
// Donde:
//   · CF_anual = flujo anual neto YA después de egresos y debt service
//     (ingresos − egresos − cuotas). Si el CF del simulador incluye impuesto,
//     ese impuesto es saldo a pagar (post-rete), NUNCA impuesto a cargo —
//     el simulador ya lo calcula así vía estimarImpuesto aliases
//     (saldoAPagar / impuestoNeto).
//   · r = valorización anual de TODO el patrimonio (editable).
//     OJO con el nombre histórico: la clave sigue siendo `retornoExcedente`
//     por retrocompatibilidad, pero NO es el retorno del excedente de caja.
//     La línea `activos = baseActivos * (1 + r) + cfAnual` aplica r sobre el
//     total de activos. Santiago lo señaló el 14-sep-2026 al no entender la
//     etiqueta en la UI; ahí se renombró a "Valorización anual del patrimonio",
//     que es lo que de verdad hace.
//   · amortización ≈ porción de capital de las cuotas (costoCredito.capitalMes×12),
//     topeada al saldo. No se resta del patrimonio: bajar el pasivo LO SUBE.
//     Se modela explícitamente en el lado deudas.
//
// "Se come" vs "Crece": compara patrimonio nominal (y real deflactado por
// inflación visible) contra el de hoy.
// ═══════════════════════════════════════════════════════════════════════════

import { vaCOP, costoCredito } from "./flowHelpers.js";

/** Defaults conservadores (Colombia, nominales). Editables en UI. */
export const DEFAULTS_PROYECCION = {
  inflacionAnual: 0.04,       // 4%
  retornoExcedente: 0.06,     // 6% nominal sobre el TOTAL de activos (ver nota arriba)
  horizontes: [3, 5, 10],
};

/**
 * Estima amortización de capital anual a partir de user.deudas.
 * Usa costoCredito (mismo helper del resto de la app). Conservador:
 * si la cuota no cubre interés → amort = 0.
 */
export function estimarAmortizacionAnual(deudas = [], trm = 4200) {
  let total = 0;
  (deudas || []).forEach((d) => {
    if (d?.sim === false) return;
    const mt = (Number(d.mt) || 0) * (d.moneda === "USD" ? trm : 1);
    if (mt <= 0) return;
    // costoCredito opera sobre mt/pg en la moneda del registro; convertimos
    // el capital mensual resultante a COP si aplica.
    const cc = costoCredito(d);
    if (cc.noAmortiza) return;
    const capitalAnual =
      (Number(cc.capitalMes) || 0) * 12 * (d.moneda === "USD" ? trm : 1);
    total += Math.max(0, Math.min(mt, capitalAnual));
  });
  return Math.round(total);
}

/**
 * Activos / deudas / NW en COP a partir de user (o overrides del totals).
 */
export function snapshotPatrimonio(user = {}, overrides = {}) {
  const trm = user?.trm || 4200;
  let activos = overrides.activos;
  let deudasTotales = overrides.deudasTotales;
  if (activos == null) {
    activos = (user.inv || []).reduce((s, i) => {
      if (i?.sim === false) return s;
      return s + vaCOP(i, trm);
    }, 0);
  }
  if (deudasTotales == null) {
    deudasTotales = (user.deudas || []).reduce((s, d) => {
      if (d?.sim === false) return s;
      return s + (Number(d.mt) || 0) * (d.moneda === "USD" ? trm : 1);
    }, 0);
  }
  const patrimonioNeto =
    overrides.patrimonioNeto != null
      ? overrides.patrimonioNeto
      : activos - deudasTotales;
  return {
    activos: Math.round(activos),
    deudasTotales: Math.round(deudasTotales),
    patrimonioNeto: Math.round(patrimonioNeto),
    trm,
  };
}

/**
 * Serie año a año hasta max(horizontes).
 *
 * @param {object} input
 * @param {number} input.patrimonioNeto0
 * @param {number} input.activos0
 * @param {number} input.deudas0
 * @param {number} input.cfAnual  flujo anual neto (después de debt service)
 * @param {number} [input.retornoExcedente=0.06]
 * @param {number} [input.inflacionAnual=0.04]
 * @param {number} [input.amortizacionAnual=0]
 * @param {number[]} [input.horizontes=[3,5,10]]
 */
export function proyectarPatrimonio(input = {}) {
  const r =
    input.retornoExcedente != null
      ? Number(input.retornoExcedente)
      : DEFAULTS_PROYECCION.retornoExcedente;
  const infl =
    input.inflacionAnual != null
      ? Number(input.inflacionAnual)
      : DEFAULTS_PROYECCION.inflacionAnual;
  const horizontes = input.horizontes || DEFAULTS_PROYECCION.horizontes;
  const maxY = Math.max(0, ...horizontes);
  const cfAnual = Number(input.cfAnual) || 0;
  const amortAnual = Math.max(0, Number(input.amortizacionAnual) || 0);

  let activos = Number(input.activos0) || 0;
  let deudas = Math.max(0, Number(input.deudas0) || 0);
  // Si solo viene NW, reparte de forma neutra (todo a activos, sin deuda).
  if (
    (input.activos0 == null || input.deudas0 == null) &&
    input.patrimonioNeto0 != null
  ) {
    const nw0 = Number(input.patrimonioNeto0) || 0;
    if (input.activos0 == null && input.deudas0 == null) {
      activos = Math.max(0, nw0);
      deudas = 0;
    } else if (input.activos0 == null) {
      activos = nw0 + deudas;
    } else if (input.deudas0 == null) {
      deudas = Math.max(0, activos - nw0);
    }
  }

  const serie = [
    {
      año: 0,
      label: "Hoy",
      activos: Math.round(activos),
      deudas: Math.round(deudas),
      patrimonio: Math.round(activos - deudas),
      patrimonioReal: Math.round(activos - deudas),
      cfAcumulado: 0,
      amortAcumulada: 0,
      retornoAcumulado: 0,
    },
  ];

  let cfAcum = 0;
  let amortAcum = 0;
  let retornoAcum = 0;

  for (let y = 1; y <= maxY; y++) {
    const baseActivos = activos;
    const crecimiento = baseActivos * r;
    retornoAcum += crecimiento;
    activos = baseActivos * (1 + r) + cfAnual;
    cfAcum += cfAnual;

    const amort = Math.min(deudas, amortAnual);
    deudas = Math.max(0, deudas - amort);
    amortAcum += amort;

    const patrimonio = activos - deudas;
    const deflactor = Math.pow(1 + infl, y);
    serie.push({
      año: y,
      label: `+${y}a`,
      activos: Math.round(activos),
      deudas: Math.round(deudas),
      patrimonio: Math.round(patrimonio),
      patrimonioReal: Math.round(patrimonio / deflactor),
      cfAcumulado: Math.round(cfAcum),
      amortAcumulada: Math.round(amortAcum),
      retornoAcumulado: Math.round(retornoAcum),
    });
  }

  const hoy = serie[0].patrimonio;
  const porHorizonte = horizontes.map((h) => {
    const row = serie.find((s) => s.año === h) || serie[serie.length - 1];
    const delta = row.patrimonio - hoy;
    const deltaReal = row.patrimonioReal - hoy;
    // Veredicto: "crece" si el patrimonio real (deflactado) no cae.
    // Si inflación=0, equivale al nominal.
    const veredicto = deltaReal >= 0 ? "crece" : "se_come";
    return {
      horizonte: h,
      patrimonio: row.patrimonio,
      patrimonioReal: row.patrimonioReal,
      delta,
      deltaReal,
      veredicto,
      pct: hoy !== 0 ? delta / Math.abs(hoy) : delta > 0 ? 1 : delta < 0 ? -1 : 0,
    };
  });

  return {
    serie,
    porHorizonte,
    supuestos: {
      retornoExcedente: r,
      inflacionAnual: infl,
      cfAnual,
      amortizacionAnual: amortAnual,
      patrimonio0: hoy,
      activos0: serie[0].activos,
      deudas0: serie[0].deudas,
    },
  };
}