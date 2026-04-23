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

import { estimarImpuesto } from "./taxCO.js";
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

  const est = estimarImpuesto(userLike);
  const d = est.detalle[0];
  if (!d) return null;

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
  const gastosTotal = (gastos || []).reduce((s, g) => s + (g.m || 0), 0) * 12;
  // gastosDeducTotal coincide con lo que el motor reporta.
  const gastosDeducTotal = owner.type === "juridica"
    ? (d.gastosRegistrados || 0)
    : (d.totalDeducciones || 0);

  // ── Derivados específicos de natural (para UI de optimización) ──
  const benefCon = d.type === "natural"
    ? (d.exenta25 || 0) + (d.totalDeducciones || 0) + (d.pvMax || 0) + (d.afcMax || 0)
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
      impActual: d.impuesto,
      impOptimo: d.impOptimizado,
      tasaActual: d.tasa,
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
    impSin: d.impuesto,
    impCon: d.impOptimizado,
    tasaSin: d.tasa,
    tasaCon: d.ingreso > 0 ? (d.impOptimizado / d.ingreso * 100) : 0,
    ahorro: d.ahorroOptimo,
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
