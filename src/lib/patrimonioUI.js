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
 * Estilo de la tabla del portafolio y anchos de columna en el móvil.
 * Causa real del subtotal cortado ($380.0I, $62.0I…): con table-layout
 * automático la tabla medía más que la pantalla (el contenido de las celdas
 * de Valor/Deuda más la columna de nombre) y el encabezado de grupo, que usa
 * colSpan, queda del ancho de toda la tabla: su subtotal, alineado a la
 * derecha, caía fuera de la vista dentro del contenedor con scroll. En angosto
 * se usa table-layout fijo con anchos explícitos: la tabla mide siempre el
 * ancho del contenedor, el nombre se parte en líneas y el subtotal cabe.
 */
export const ANCHOS_ANGOSTO = [null, 84, 76, 44];

export function estiloTablaPortafolio(angosto) {
  const base = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
  return angosto ? { ...base, tableLayout: "fixed" } : base;
}

/** Estilo del contenido del encabezado de cada grupo (nombre · n … subtotal %). */
export function estiloEncabezadoGrupo() {
  return { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
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
