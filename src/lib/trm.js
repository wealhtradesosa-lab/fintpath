// La tasa del dólar, en un solo lugar.
//
// 26-oct-2026 — El `4200` estaba escrito a mano en cinco archivos. No es una
// tasa: es el respaldo que quedó de cuando el efecto de TRM estaba muerto (vivía
// después de un `return`, ver #70), y mientras tanto era lo que de hecho veía
// todo el mundo. Tenerlo con nombre y en un módulo permite encontrarlo, probarlo
// y, cuando se decida, quitarlo de los borradores de declaración.
//
// Regla del producto: nunca inventar la tasa. Si no hay una real, se informa en
// dólares y se avisa (contextoAsesor.js), o los totales quedan «pendiente de
// tasa» (estadoTrm/totalesConTasa en App.jsx). Desde el 1-nov-2026 el motor
// de renta (taxCO.js) y los borradores F-210/F-110 tampoco lo usan: sin tasa
// real dejan los USD por fuera y avisan «pendiente de tasa»
// (usdPendienteDeTasa / NOTA_TRM_PENDIENTE).

/** Respaldo histórico. NO es una tasa real: nunca se guarda en el perfil. */
export const TRM_PROVISIONAL = 4200;

/** La tasa si es usable, o null. Un 4200 guardado no cuenta como tasa. */
export function trmUsable(trm) {
  const t = Number(trm);
  return Number.isFinite(t) && t > 0 && t !== TRM_PROVISIONAL ? t : null;
}

/**
 * 1-nov-2026 — ¿Hay montos en USD que no se pueden pasar a pesos? El motor de
 * renta y los borradores F-210/F-110 los dejan por fuera y la pantalla dice
 * «pendiente de tasa» en vez de mostrar cifras como si fueran válidas.
 */
export function usdPendienteDeTasa(user) {
  if (!user || trmUsable(user.trm) != null) return false;
  const usd = (i) => !!i && i.moneda === "USD";
  const listas = ["inv", "deu", "ingresos", "ibk"].some((k) => (user[k] || []).some(usd));
  const gastos = Object.values(user.gas || {}).some((g) => (Array.isArray(g) ? g.some(usd) : usd(g)));
  return listas || gastos;
}

export const NOTA_TRM_PENDIENTE = "Sin una TRM real, tus montos en dólares quedan fuera de este borrador: pendiente de tasa. Las cifras que ves son solo de tus montos en pesos.";
