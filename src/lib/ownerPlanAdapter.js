// ownerPlanAdapter.js — Adapter entre estimarImpuesto() y OwnerPlan.
//
// OwnerPlan (SimuladorTributario.jsx) tenía históricamente un useMemo de
// ~335 líneas que duplicaba lógica del motor tributario. El problema:
// cada vez que se arreglaba un bug en taxCO.js (ej: INCRNGO, Art. 38-39
// componente inflacionario, retención en la fuente por cédula, clasificación
// por fiscalCode), había que replicarlo en OwnerPlan. Cuando no se replicaba,
// los números divergían silenciosamente.
//
// Este adapter es la nueva single source of truth para OwnerPlan:
//   1. Construye un userLike con solo este owner y sus items.
//   2. Llama a estimarImpuesto() para obtener el detalle correcto.
//   3. Enriquece con aliases legacy (ingAnual, impActual, impOptimo, etc.)
//      que el JSX de OwnerPlan usa, sin tocar el JSX.
//   4. Agrega los cosméticos que son locales del componente y no pertenecen
//      al motor: patTotal, deuTotal, gastosByCat, ingByCat.
//
// Los campos "recs" (recomendaciones textuales) siguen calculándose en
// OwnerPlan porque dependen de T (tema), fm (formatter), UVT, calcImp,
// que son del dominio del componente.
//
// CONTRATO:
//   adapterOwnerPlan({ owner, ingresos, gastos, inv, deu, trm, componenteInflacionarioPct })
//     → { type, regimen, ingAnual, impActual, tasaActual, ..., gastosByCat, ... }
//     o null si no hay ingresos.

import { estimarImpuesto, DEFAULT_AG, uvtForYear } from "./taxCO.js";
import { sugerenciaPvAfc } from "./sugerenciaPvAfc.js";
import { totalAnualItem } from "./flowHelpers.js";
import { GAS_JUR_NO_DEDUCIBLE } from "./fiscalCodes.js";

export function adapterOwnerPlan({ owner, ingresos, gastos, inv, deu, trm, componenteInflacionarioPct }) {
  if (!owner) return null;

  // gastos llega como array plano con .cat. El motor espera { cat: [items] }.
  const gasObj = {};
  for (const g of (gastos || [])) {
    const cat = g.cat || "Otro";
    if (!gasObj[cat]) gasObj[cat] = [];
    gasObj[cat].push({ ...g });
  }

  const userLike = {
    owners: [owner],
    ingresos: ingresos || [],
    gas: gasObj,
    deu: deu || [],
    inv: inv || [],
    trm: trm || 4200,
    componenteInflacionarioPct,
  };

  // Simulador y ahorro PV/AFC: AG por defecto; la UVT se deriva de ese año.
  const est = estimarImpuesto(userLike, { ag: DEFAULT_AG });
  const d = est.detalle[0];
  if (!d) return null;
  // Aporte sugerido (regla Finanzas) y ahorro: mismo helper que las recomendaciones.
  const sugPV = sugerenciaPvAfc(userLike, owner, { ag: DEFAULT_AG });

  // ── Cosméticos locales derivados de los props (no tributarios) ──
  const patTotal = (inv || []).reduce((s, i) => s + (+i.va || 0), 0);
  const deuTotal = (deu || []).reduce((s, dd) => s + (dd.mt || 0), 0);

  // Desglose de ingresos por categoría (para display).
  const ingByCat = {};
  for (const i of (ingresos || [])) {
    const cat = i.categoria || "Otro";
    const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1);
    ingByCat[cat] = (ingByCat[cat] || 0) + m;
  }

  // Desglose de gastos por categoría (total y deducible).
  // Para jurídica: deducible según fiscalCode (excluye GAS_JUR_NO_DEDUCIBLE).
  // Para natural: display completo; el motor decide qué deduce.
  const gastosByCat = {};
  for (const g of (gastos || [])) {
    const cat = g.cat || "Otro";
    const m = (g.m || 0);
    if (!gastosByCat[cat]) gastosByCat[cat] = { total: 0, deduc: 0, pct: 100 };
    gastosByCat[cat].total += m;
    // Para jurídica: deducible depende del fiscalCode.
    if (owner.type === "juridica") {
      if (g.fiscalCode !== GAS_JUR_NO_DEDUCIBLE) gastosByCat[cat].deduc += m;
    } else {
      // Natural: display puro; no intentamos duplicar lógica del motor.
      gastosByCat[cat].deduc += m;
    }
  }

  // Totales agregados para resúmenes.
  const gastosTotal = (gastos || []).reduce((s, g) => s + totalAnualItem(g), 0);
  // gastosDeducTotal coincide con lo que el motor reporta.
  const gastosDeducTotal = owner.type === "juridica"
    ? (d.gastosRegistrados || 0)
    : (d.totalDeducciones || 0);

  // ── Derivados específicos de natural (para UI de optimización) ──
  const benefCon = d.type === "natural"
    ? (d.exenta25 || 0) + (d.totalDeducciones || 0) + (d.pvMax || 0) // pvMax = tope conjunto PV+AFC
    : 0;
  const benAplicCon = d.type === "natural"
    ? Math.min(benefCon, d.lim40 || 0)
    : 0;

  // ── Objeto final: motor + aliases + cosméticos ──
  const base = { ...d };

  if (d.type === "juridica") {
    return {
      ...base,
      // Aliases legacy usados por el JSX de OwnerPlan:
      ingAnual: d.ingreso,
      // FIX abr 2026: impActual/impOptimo apuntan a impBruto (impuesto total
      // segun tabla, antes de retencion) en vez de impuesto (saldo despues
      // de retencion). Esto unifica los numeros con la Calculadora (Wizard)
      // y con el Simulador de Bienestar Financiero, que ambos usan impBruto.
      // Ver SimuladorTributario.jsx linea 118 y SimuladorAvanzado.jsx linea 336.
      impActual: d.impBruto != null ? d.impBruto : d.impuesto,
      impOptimo: d.impOptBruto != null ? d.impOptBruto : d.impOptimizado,
      tasaActual: d.tasaBruta != null ? d.tasaBruta : d.tasa,
      totalDeduc: d.gastosDeduc,
      ahorro: d.ahorroOptimo,
      // Cosméticos:
      patTotal, deuTotal, gastosByCat, ingByCat,
      gastosTotal, gastosDeducTotal,
    };
  }

  // Natural
  return {
    ...base,
    // Aliases legacy:
    ingAnual: d.ingreso,
    // FIX abr 2026 (mismo razonamiento que jurídica):
    // impSin/impCon ahora apuntan a impBruto/impOptBruto, no a saldo.
    sugPvAfc: sugPV,
    aportePvAfc: sugPV.aporte,
    ahorroPvAfc: sugPV.ahorro || 0,
    impSin: d.impBruto != null ? d.impBruto : d.impuesto,
    impCon: d.impOptBruto != null ? d.impOptBruto : d.impOptimizado,
    tasaSin: d.tasaBruta != null ? d.tasaBruta : d.tasa,
    tasaCon: d.ingreso > 0 ? ((d.impOptBruto != null ? d.impOptBruto : d.impOptimizado) / d.ingreso * 100) : 0,
    ahorro: d.ahorroOptimo,
    ag: DEFAULT_AG,
    uvt: uvtForYear(DEFAULT_AG),
    saldoAPagar: d.saldoAPagar || 0,
    saldoAFavor: d.saldoAFavor || 0,
    saldoAFavorOpt: d.saldoAFavorOpt || 0,
    deducViv: d.deducVivienda,
    gastosDeducNat: d.totalDeducciones,
    // benefSin es lo mismo que benAplic del motor:
    benefSin: d.benAplic,
    benAplicSin: d.benAplic,
    // benefCon y benAplicCon derivados:
    benefCon,
    benAplicCon,
    // Cosméticos:
    patTotal, deuTotal, gastosByCat, ingByCat,
    gastosTotal, gastosDeducTotal,
  };
}

// Ahorro de la tarjeta «Pensión voluntaria o AFC» del simulador: impuesto
// ANTES de retenciones sin el aporte sugerido − con él (impBruto − impOptBruto).
// No es saldo a pagar: las retenciones pueden cubrirlo.
export function ahorroPvAfc(fiscalData) {
  if (fiscalData?.ahorroPvAfc != null) return fiscalData.ahorroPvAfc;
  return Math.max(0, (Number(fiscalData?.impSin) || 0) - (Number(fiscalData?.impCon) || 0));
}

// Columna «(=) Saldo a pagar / a favor» del simulador: sale de taxCO.
export function saldoResumen(fd, isJ) {
  if (isJ) {
    const imp = Number(fd?.impBruto) || 0, ret = Number(fd?.retefuenteCalc) || 0;
    return { saldoAPagar: Math.max(0, imp - ret), saldoAFavor: Math.max(0, ret - imp) };
  }
  return { saldoAPagar: Number(fd?.saldoAPagar) || 0, saldoAFavor: Number(fd?.saldoAFavor) || 0 };
}

// Etiqueta «AG 2026 · UVT $52.374», derivada del año que se le pasó a taxCO.
export function etiquetaAG(fd) {
  const ag = fd?.ag || DEFAULT_AG, uvt = fd?.uvt || uvtForYear(ag);
  return `AG ${ag} · UVT $${Math.round(uvt).toLocaleString("es-CO")}`;
}

// Proyección con los aportes de hoy (wizard, simulador): AG por defecto (2026).
// La declaración F-210 AG 2025 debe pedir topePvAfcAnual(2025) → $189.236.200.
export const AG_PROYECCION = DEFAULT_AG;
export function topePvAfcAnual(ag = AG_PROYECCION) {
  const uvt = uvtForYear(ag);
  return { ag, uvt, tope: Math.round(3800 * uvt) };
}

// Medicina prepagada (Art. 387 ET): 16 UVT/mes del AG que se calcula.
export function topeMedicinaMensual(ag = AG_PROYECCION) {
  return Math.round(16 * uvtForYear(ag));
}
