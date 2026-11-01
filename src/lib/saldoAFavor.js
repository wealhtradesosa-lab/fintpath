// saldoAFavor.js — 1-nov-2026 (fix/saldo-a-favor).
//
// Regla Finanzas/Tributario (#60): las sugerencias de ahorro se gatean y acotan
// con el IMPUESTO A CARGO (antes de retenciones), no con el saldo a pagar, que
// taxCO corta en 0. Si las retenciones ya superan el impuesto, el ahorro no baja
// lo que se paga: agranda la devolución. Este módulo es la fuente única de esas
// cifras y de su texto, para que el borrador, las tarjetas y las
// recomendaciones digan lo mismo.

const fmCOP = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

/** Impuesto a cargo (antes de retenciones) del detalle de taxCO. */
export function impuestoACargoDe(det) {
  return Math.max(0, Number(det?.impuestoACargo ?? det?.impBruto ?? det?.impuesto) || 0);
}

/** Retenciones y anticipos ya pagados del detalle de taxCO. */
export function retencionesDe(det) {
  if (!det) return 0;
  if (det.pagosPrevios != null) return Math.max(0, Number(det.pagosPrevios) || 0);
  return Math.max(0, Number(det.retefuenteNat ?? det.retefuenteCalc) || 0);
}

/** saldoAFavor = max(0, retenciones − impuesto a cargo). */
export function saldoAFavorDe(det) {
  if (!det) return 0;
  if (det.saldoAFavor != null) return Math.max(0, Number(det.saldoAFavor) || 0);
  return Math.max(0, retencionesDe(det) - impuestoACargoDe(det));
}

export function textoSaldoAFavor(monto, fmt = fmCOP) {
  return `Saldo a favor estimado: ${fmt(monto)}. Puedes pedir su devolución o usarlo en tu próxima declaración. Confírmalo con tu contador antes de solicitarlo`;
}

/** Nota del renglón "saldo a favor" del borrador (F-210 y F-110). null si es 0. */
export function notaSaldoAFavorRenglon(valor, fmt = fmCOP) {
  return Number(valor) > 0 ? textoSaldoAFavor(valor, fmt) + "." : null;
}

/**
 * Texto de una tarjeta de ahorro cuando ya hay saldo a favor: el ahorro se suma
 * a la devolución (de X a X + ahorro). null si no hay saldo a favor o ahorro.
 */
export function notaAhorroConSaldoAFavor(det, ahorro, fmt = fmCOP) {
  const x = saldoAFavorDe(det);
  const a = Math.max(0, Number(ahorro) || 0);
  if (!(x > 0) || !(a > 0)) return null;
  return `Como ya tienes saldo a favor, este ahorro no baja lo que pagas: se suma a tu devolución, que pasaría de ${fmt(x)} a ${fmt(x + a)}. Confírmalo con tu contador`;
}

/**
 * Tope de una sugerencia de donación o inversión: proporcional al impuesto a
 * cargo y nunca más que el flujo libre del año después de completar el fondo de
 * emergencia (sugerenciaPvAfc.flujoLibreTrasEmergencia). flujoLibre null = sin
 * dato de flujo → no se acota.
 */
export function montoSugeridoAcotado(montoPorImpuesto, flujoLibre) {
  const m = Math.max(0, Math.round(Number(montoPorImpuesto) || 0));
  if (flujoLibre == null) return m;
  return Math.min(m, Math.max(0, Math.round(Number(flujoLibre) || 0)));
}
