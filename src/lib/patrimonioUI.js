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

/**
 * Contenido del encabezado de cada grupo (Real Estate · 3 … $380.0M 40%).
 * La celda ocupa todo el ancho de la tabla, y en el móvil la tabla es más
 * ancha que la pantalla, así que el subtotal quedaba fuera de la vista y se
 * cortaba ($380.0I, $62.0I). En angosto el contenido se ancla a la izquierda
 * del contenedor con scroll (sticky) y no pasa del ancho visible.
 */
export function estiloEncabezadoGrupo(angosto) {
  const base = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
  return angosto
    ? { ...base, position: "sticky", left: 0, boxSizing: "border-box", width: "calc(100vw - 32px)", maxWidth: "100%" }
    : base;
}

/**
 * Deudas activas (con saldo y encendidas) que no están vinculadas a ningún
 * activo del portafolio: no restan de la deuda de ninguna fila, así que la
 * suma de la columna Deuda no cuadra con el total. Se avisa en una nota.
 */
export function deudasSinActivo(deudas, activos) {
  const ids = new Set((activos || []).map((a) => a.id));
  const sueltas = (deudas || []).filter((d) => {
    const link = d.la || d.link;
    return d.sim !== false && (Number(d.mt || d.monto) || 0) > 0 && (!link || !ids.has(link));
  });
  return { n: sueltas.length, total: sueltas.reduce((s, d) => s + (Number(d.mt || d.monto) || 0), 0) };
}
