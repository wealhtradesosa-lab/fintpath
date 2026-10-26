import { estimarImpuesto, DEFAULT_AG } from "./taxCO.js";
import { calcularBase } from "./metrics.js";
// sugerenciaPvAfc.js — fuente única del aporte sugerido a PV/AFC y su ahorro.
// Acuerdo (Tributario, Finanzas, Cosmo): la tarjeta del simulador y las
// recomendaciones estratégicas muestran el MISMO aporte y el MISMO ahorro.
//   aporte = aporte optimizado de taxCO (detalle.pensionVol)
//   ahorro = impuesto a cargo sin aporte − con ese aporte (impBruto − impOptBruto)
export function sugerenciaPvAfcDe(det) {
  if (!det) return { aporte: 0, ahorro: 0 };
  const sin = Number(det.impBruto ?? det.impuesto) || 0;
  const con = Number(det.impOptBruto ?? det.impOptimizado) || 0;
  return { aporte: Math.round(Number(det.pensionVol) || 0), ahorro: Math.max(0, sin - con) };
}


const PV_AFC = new Set(["AP_TRIB_PV", "AP_TRIB_AFC"]);
const MESES_FONDO_EMERGENCIA = 3; // misma convención que hallazgos.js (fondoEmergencia)
const SMMLV = { 2025: 1_423_500, 2026: 1_750_905 };

// Fondo de Solidaridad Pensional (Ley 797/2003): 1% entre 4 y 16 SMMLV,
// +0,2 pp por cada SMMLV desde 16 hasta 2% a partir de 20.
function tasaFsp(ibcMes, smmlv) {
  const n = ibcMes / smmlv;
  if (n < 4) return 0;
  if (n < 16) return 0.01;
  if (n >= 20) return 0.02;
  return 0.01 + 0.002 * (Math.floor(n) - 15);
}

/**
 * Descuentos obligatorios anuales del asalariado, SIN aporte voluntario (conservador):
 *   retención   → taxCO detalle.retefuenteNat (det0, calculado sin PV/AFC)
 *   pensión     → taxCO aportesDesglose.pensionObligatoriaAnual
 *   salud       → taxCO aportesDesglose.saludObligatoriaAnual; si viene en 0 y el
 *                 salario es bruto, 4% del IBC (tope 25 SMMLV)
 *   FSP         → tasa Ley 797 sobre el IBC
 *   independ.   → aportesDesglose.ssIndependienteAnual
 */
export function descuentosObligatorios(det, ag = DEFAULT_AG) {
  const ad = det?.aportesDesglose || {};
  const smmlv = SMMLV[ag] || SMMLV[2026];
  const salMes = (Number(ad.salarioEsBruto ? ad.salarioGravableAnual : 0) || 0) / 12;
  const ibc = Math.min(salMes, 25 * smmlv);
  const retencion = Math.max(0, Number(det?.retefuenteNat ?? det?.reteN) || 0);
  const pension = Number(ad.pensionObligatoriaAnual) || 0;
  const salud = (Number(ad.saludObligatoriaAnual) || 0) || ibc * 0.04 * 12;
  const fsp = ibc * tasaFsp(ibc, smmlv) * 12;
  const independiente = Number(ad.ssIndependienteAnual) || 0;
  const total = Math.round(retencion + pension + salud + fsp + independiente);
  return { retencion, pension, salud: Math.round(salud), fsp: Math.round(fsp), independiente, total };
}

function deOwner(user, owner) {
  const mio = (x) => !x?.owner || x.owner === owner.id;
  const gas = {};
  for (const [cat, items] of Object.entries(user?.gas || {})) gas[cat] = (items || []).filter(mio);
  return { ...user, owners: [owner], ingresos: (user?.ingresos || []).filter(mio), inv: (user?.inv || []).filter(mio), deu: (user?.deu || []).filter(mio), gas };
}

/**
 * Regla Finanzas (26-sep): aporte sugerido = min(flujo libre del año después de
 * completar el fondo de emergencia, espacio fiscal que queda). Ahorro = impuesto
 * a cargo sin aporte − con ESE aporte, corriendo taxCO (sin tocar su optimizador).
 *   flujo libre  → calcularBase().fl (metrics.js, bruto) × 12 − descuentosObligatorios()
 *                  (retención sin aporte + salud + pensión + FSP), NETO
 *   fondo emerg. → 3 meses de calcularBase().ob frente a calcularBase().liquidos
 *   espacio      → aporte optimizado de taxCO (pensionVol) − lo que ya aporta
 */
export function sugerenciaPvAfc(user, owner, { ag = DEFAULT_AG } = {}) {
  const vacio = { motivo: "gastos", flujoNetoAnual: 0, descuentos: null, topeAnual: 0, aporte: 0, ahorro: null, sinFlujo: true, flujoLibreAnual: 0, faltanteEmergencia: 0, espacioFiscal: 0 };
  if (!user || !owner) return vacio;
  const u = deOwner(user, owner);
  const det0 = estimarImpuesto(u, { ag }).detalle.find((d) => d.name === owner.name);
  if (!det0) return vacio;
  const topeAnual = Math.round(Number(det0.pvMax) || 0);
  const b = calcularBase({ ingresos: u.ingresos, gastos: u.gas, deudas: u.deu, inv: u.inv, trm: u.trm });
  const descuentos = descuentosObligatorios(det0, ag);
  const flujoNetoAnual = Math.round((b.fl || 0) * 12 - descuentos.total);
  const faltanteEmergencia = Math.max(0, MESES_FONDO_EMERGENCIA * (b.ob || 0) - (b.liquidos || 0));
  const flujoLibreAnual = Math.max(0, flujoNetoAnual - faltanteEmergencia);
  const motivo = flujoNetoAnual <= 0 ? "gastos" : flujoLibreAnual <= 0 ? "fondo" : null;
  const yaAporta = Object.values(u.gas).flat().filter((g) => PV_AFC.has(g?.fiscalCode)).reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);
  const espacioFiscal = Math.max(0, sugerenciaPvAfcDe(det0).aporte - yaAporta);
  const aporte = Math.round(Math.min(flujoLibreAnual, espacioFiscal));
  if (!(aporte > 0)) return { ...vacio, motivo, flujoNetoAnual, descuentos, topeAnual, sinFlujo: flujoLibreAnual <= 0, flujoLibreAnual, faltanteEmergencia, espacioFiscal };
  const gas = { ...u.gas, "Aporte tributario": [...(u.gas["Aporte tributario"] || []), { owner: owner.id, fiscalCode: "AP_TRIB_PV", m: aporte / 12 }] };
  const det1 = estimarImpuesto({ ...u, gas }, { ag }).detalle.find((d) => d.name === owner.name);
  const ahorro = Math.round(Math.max(0, (det0.impBruto || 0) - (det1?.impBruto || 0)));
  return { motivo: null, flujoNetoAnual, descuentos, topeAnual, aporte, ahorro, sinFlujo: false, flujoLibreAnual, faltanteEmergencia, espacioFiscal };
}

export function textoSugerenciaPvAfc(s, fmt = (n) => "$" + Math.round(n).toLocaleString("es-CO")) {
  if (!s || s.sinFlujo || !(s.aporte > 0)) {
    if (s?.motivo === "fondo") return `Primero completa tu fondo de emergencia (te faltan ${fmt(s.faltanteEmergencia)}); después te sugerimos cuánto aportar.`;
    return 'Hoy tus gastos superan tus ingresos, así que no te sugerimos aportar. Revisa tus gastos en "Flujo de caja" y vuelve cuando te quede un margen.';
  }
  return `Aportando ${fmt(s.aporte / 12)}/mes (${fmt(s.aporte)} al año) pagarías ${fmt(s.ahorro)} menos de impuesto.`;
}

export function textoTopePvAfc(s, fmt = (n) => "$" + Math.round(n).toLocaleString("es-CO")) {
  return s?.topeAnual > 0 ? `Tope legal: ${fmt(s.topeAnual / 12)}/mes` : "";
}
