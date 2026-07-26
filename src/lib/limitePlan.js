/**
 * limitePlan — Cuántos ítems puede VER en detalle cada plan.
 *
 * 26-jul-2026. Decisión de producto de Santiago: el plan gratuito permite
 * hasta 7 ítems por sección; de ahí en adelante quedan bloqueados.
 *
 * DECISIÓN DE DISEÑO IMPORTANTE — los ítems bloqueados SIGUEN CONTANDO en
 * todos los totales. La alternativa era ocultarlos del cálculo, pero en una
 * herramienta patrimonial eso significa mostrar un patrimonio neto, una
 * concentración y un impuesto estimado calculados sobre datos parciales, sin
 * que el usuario lo sepa. Un número incompleto presentado como completo es
 * peor que una función bloqueada: la persona podría decidir sobre él.
 *
 * Así, el bloqueo quita el ACCESO (ver el detalle, editar) pero no falsea la
 * información. Y de paso presiona más a mejorar de plan, porque el usuario ve
 * cuánta plata hay del otro lado del candado.
 *
 * Sobre los datos ya cargados: nadie pierde nada. Quien tenga 16 activos los
 * conserva; simplemente no puede abrir 9 de ellos hasta que mejore el plan.
 */

export const LIMITE_FREE = 7;

/** ¿Este plan tiene tope de ítems por sección? */
export const tieneLimite = (plan) => !plan || plan === "free";

/**
 * Separa una lista en lo visible y lo bloqueado según el plan.
 * El orden de entrada manda: se bloquean los últimos, no los más valiosos.
 */
export function separarPorLimite(items = [], plan) {
  if (!tieneLimite(plan) || items.length <= LIMITE_FREE) {
    return { visibles: items, bloqueados: [], hayLimite: false };
  }
  return {
    visibles: items.slice(0, LIMITE_FREE),
    bloqueados: items.slice(LIMITE_FREE),
    hayLimite: true,
  };
}
