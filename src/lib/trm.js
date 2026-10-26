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
// tasa» (estadoTrm/totalesConTasa en App.jsx). El respaldo de abajo sobrevive
// solo donde el cálculo no puede quedar en blanco: los borradores de
// declaración, que además muestran NOTA_TRM_DECLARACION avisando que no sirven
// para declarar.

/** Respaldo histórico. NO es una tasa real: nunca se guarda en el perfil. */
export const TRM_PROVISIONAL = 4200;

/** La tasa si es usable, o null. Un 4200 guardado no cuenta como tasa. */
export function trmUsable(trm) {
  const t = Number(trm);
  return Number.isFinite(t) && t > 0 && t !== TRM_PROVISIONAL ? t : null;
}
