// ═══════════════════════════════════════════════════════════════════════════
// desgloseLibertad — de qué está hecha la cifra contra la que se mide el nivel.
// 13-nov-2026 (Santiago: "¿yo gasto al mes 137 MM? ¿en qué, por Dios?"). La
// pantalla mostraba una sola cifra, "gastos y cuotas", sin decir que adentro iban
// el impuesto y la cuota completa de las deudas. Ahora:
//   · el nivel se mide contra gastos + intereses (el abono a capital es ahorro);
//   · la cifra se abre en sus partes;
//   · la caja del mes (cuota completa y salario) se dice al lado, para que un
//     nivel alto nunca esconda un mes en que la plata no alcanza;
//   · se anuncia cuándo se terminan las deudas y cuánto sube la cobertura ese día.
// Funciones puras: el Dashboard y el Simulador las usan igual.
// ═══════════════════════════════════════════════════════════════════════════

import { costoCredito } from "./flowHelpers.js";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Partes de la obligación del nivel (`m.ob`), en el orden en que se leen. Omite las que son 0. */
export function partesObligacion(m = {}) {
  const gastosVida = num(m.gastosVida);
  const aportes = num(m.aportesObligatorios);
  const impuesto = num(m.impuestoNeto);
  const intereses = num(m.interesesDeuda);
  const sinTasa = num(m.deudasSinTasa?.cuota);
  // Lo que queda de G después de vida, aportes e impuesto: costos de inmuebles
  // que superan su arriendo (excesoCostos en metrics.js).
  const exceso = Math.max(0, num(m.g) - gastosVida - aportes - impuesto);
  const partes = [
    { clave: "vida", es: "Gastos de vida", en: "Living expenses", monto: gastosVida },
    { clave: "aportes", es: "Seguridad social", en: "Social security", monto: aportes },
    { clave: "inmuebles", es: "Costos de inmuebles que superan su arriendo", en: "Property costs above rent", monto: exceso },
    { clave: "intereses", es: "Intereses de deudas", en: "Debt interest", monto: Math.max(0, intereses - sinTasa) },
    { clave: "sinTasa", es: "Cuotas sin tasa (completas)", en: "Payments without a rate (full)", monto: sinTasa },
    { clave: "impuesto", es: "Impuesto de renta del mes", en: "Income tax this month", monto: impuesto },
  ];
  return partes.filter((p) => Math.round(p.monto) > 0);
}

/**
 * Lectura de caja al lado del nivel.
 *   fl                 flujo del mes (todo lo que entra − todo lo que sale, cuota completa)
 *   capital            lo que se abona a capital este mes (ahorro)
 *   rentasNoCubrenCuotas  las rentas pagan la vida + intereses pero no la cuota completa:
 *                      el abono a capital lo está pagando otro ingreso (salario, negocio)
 */
export function lecturaCaja(m = {}) {
  const ip = num(m.ip), ob = num(m.ob), obCaja = num(m.obCaja ?? m.ob);
  return {
    fl: num(m.fl),
    deficit: num(m.fl) < 0,
    capital: num(m.capitalDeuda),
    rentasNoCubrenCuotas: ip >= ob && ip < obCaja,
    faltaParaCuotas: Math.max(0, obCaja - ip),
  };
}

/**
 * Cuándo se termina la última deuda que amortiza y cuánto cubrirían las rentas
 * ese día (sin intereses). `deudas` = las mismas que entraron al cálculo.
 * null si no hay deudas con fecha de fin calculable.
 */
export function finDeudas(m = {}, deudas = [], hoy = new Date()) {
  let mesesMax = 0, conFin = 0;
  (deudas || []).forEach((d) => {
    if (!d || d.sim === false || !(num(d.mt) > 0)) return;
    const c = costoCredito(d);
    if (c && c.meses > 0) { conFin++; mesesMax = Math.max(mesesMax, c.meses); }
  });
  if (!conFin) return null;
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + mesesMax, 1);
  const obSin = Math.max(0, num(m.ob) - num(m.interesesDeuda));
  return {
    meses: mesesMax,
    anio: fecha.getFullYear(),
    coberturaSinDeudas: obSin > 0 ? (num(m.ip) / obSin) * 100 : null,
  };
}
