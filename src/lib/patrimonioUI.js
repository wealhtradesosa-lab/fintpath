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
 * Tabla del portafolio en el móvil.
 * CAUSA RAÍZ: App.jsx trae una regla global `@media (max-width: 768px) {
 * table { display: block; overflow-x: auto; white-space: nowrap } }`. En el
 * móvil toda tabla es un bloque con texto sin partir: table-layout y <colgroup>
 * no se aplican, el nombre («Bogotá • Real Estate • 6% anual») ensancha la
 * columna y la fila de grupo (colSpan) mide más que la pantalla. Por eso mi
 * prueba con nombres cortos y sin esa regla no lo reproducía.
 * Historia del bug (subtotal cortado: $380.0I, $62.0I, «$38», «$6»):
 *  1) la fila de grupo usa colSpan y, con table-layout automático, la tabla
 *     medía más que la pantalla;
 *  2) table-layout:fixed + <colgroup> tampoco bastó con la cuenta real: el
 *     navegador midió las celdas por contenido (Inversión 233 px, suma 402 en
 *     un contenedor de 330) y la fila del grupo quedó en 417 px.
 * Una tabla CSS siempre puede crecer por su contenido; una grilla con
 * `minmax(0, 1fr)` no. En angosto, table/thead/tbody/tr pasan a display
 * block/grid: la columna del nombre toma el resto del ancho (y parte el
 * texto), Valor/Deuda/acciones tienen ancho fijo, y la fila de grupo ocupa
 * toda la grilla (`1 / -1`). Nada puede medir más que el contenedor.
 */
export const ANCHOS_ANGOSTO = [null, 84, 76, 44];
export const PLANTILLA_ANGOSTO = ANCHOS_ANGOSTO.map((w) => (w ? `${w}px` : "minmax(0, 1fr)")).join(" ");

export function estiloTablaPortafolio(angosto) {
  const base = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
  return angosto ? { ...base, display: "block", whiteSpace: "normal", overflowX: "hidden" } : base;
}
/** thead y tbody. */
export const estiloSeccionPortafolio = (angosto) => (angosto ? { display: "block", width: "100%" } : undefined);
/** Cada <tr>: en angosto es una grilla de 4 columnas. */
export const estiloFilaPortafolio = (angosto, extra) =>
  angosto ? { display: "grid", gridTemplateColumns: PLANTILLA_ANGOSTO, width: "100%", ...extra } : extra;
/** Celda que ocupa toda la fila (encabezado de grupo, estado vacío). */
export const estiloCeldaCompleta = (angosto, extra) =>
  angosto ? { gridColumn: "1 / -1", minWidth: 0, ...extra } : extra;

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
