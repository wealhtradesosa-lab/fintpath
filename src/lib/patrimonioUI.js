// ═══════════════════════════════════════════════════════════════════════════
// patrimonioUI.js — Ayudas puras de Patrimonio y Egresos (11-oct-2026, QA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valor y etiqueta de una opción de <select>. Las opciones pueden ser texto
 * ("Real Estate") u objetos {v, l}. Con `o.v || o`, la opción
 * {v: "", l: "— Sin asignar"} caía en `o` (el objeto entero) y React lo
 * pintaba como "[object Object]". Mismo criterio que Ingresos y Deudas.
 */
export const valorOpcion = (o) => (o !== null && typeof o === "object" ? (o.v ?? "") : o);
export const etiquetaOpcion = (o) => (o !== null && typeof o === "object" ? (o.l ?? o.v ?? "") : o);

/**
 * Gastos del usuario por categoría. Los datos viven en `u.gas`; `gastos` es
 * un nombre viejo que InversionesModule leía y que no existe, así que ningún
 * gasto vinculado a un activo se descontaba de su renta.
 */
export const gastosDelUsuario = (user) => user?.gas || user?.gastos || {};

/**
 * Columnas de la tabla del portafolio. En pantallas angostas (≤ 640 px) se
 * quitan "Tipo" (ya sale debajo del nombre) y "Ganancia" (va debajo del
 * valor), y On/Off se junta con las acciones: así Valor y Deuda caben en
 * 390 px sin desplazar la tabla.
 */
export function columnasPortafolio(angosto) {
  return angosto
    ? ["Inversión", "Valor", "Deuda", ""]
    : ["Inversión", "Tipo", "Valor", "Ganancia", "Deuda", "On/Off", ""];
}

export const ANCHO_ANGOSTO = 640;
