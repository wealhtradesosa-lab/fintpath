// Formato de UI es-CO (coma decimal, punto de miles). Sin dependencias: lo puede
// importar cualquier módulo sin ciclos.
const ES = "es-CO";

/** Número con coma decimal: fmtNumEs(2.22, 2) → "2,22". */
export function fmtNumEs(n, dec = 1) {
  const v = Number(n);
  return (Number.isFinite(v) ? v : 0).toLocaleString(ES, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Porcentaje con coma decimal (es-CO): 4,4%. Una sola función para toda la app. */
export function fmtPctEs(n, dec = 1) {
  return fmtNumEs(n, dec) + "%";
}

/** Entero con puntos de miles: 638100 → "638.100". */
export function fmtMilesEs(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString(ES);
}

/**
 * Plata con TODOS los ceros: −$5.236.408.055. Una sola regla para toda la app.
 *
 * 9-nov-2026 (Santiago: "debemos mostrar los valores en miles con todos los
 * ceros, pues la verdad en pesos sí que se confunde uno"). «MM» se lee como
 * millones o como miles de millones según quién lo mire; «K», «M», «billón»
 * tampoco ayudan. Desde hoy ninguna cifra de plata se abrevia: si un escenario
 * es absurdo, la cantidad de ceros lo deja ver sola.
 */
export function fmtPlataEs(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString(ES);
}

/** Igual que fmtPlataEs pero en dólares, con «US$» para no confundirla con pesos. */
export function fmtDolaresEs(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "−" : "") + "US$" + Math.abs(v).toLocaleString(ES);
}

/** Etiqueta de eje de gráfica: la cifra completa sin «$» (el eje ya dice qué es). */
export function fmtEjeEs(n) {
  return fmtPlataEs(n).replace("$", "");
}

/** Nombre antiguo (antes abreviaba): hoy es la cifra completa. */
export const fmtPlataCortaEs = fmtPlataEs;

/** Lee lo que escribe el usuario ("4,5", "4.5", " 4,5 %") como número; "" → "" (campo vacío). */
export function parseDecimalEs(txt) {
  if (typeof txt === "number") return Number.isFinite(txt) ? txt : "";
  const s = String(txt ?? "").replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  if (s === "" || s === "-" || s === ".") return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : "";
}

/** Tasa guardada por el usuario (12.5 → "12,5%", 16 → "16%"): hasta 2 decimales, sin ceros de relleno. */
export function fmtTasaEs(n) {
  if (n === "" || n == null) return "";
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n) + "%";
  return v.toLocaleString(ES, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%";
}

/** Años con coma decimal y 1 decimal: 37.94 → "37,9"; 13 → "13,0". */
export function fmtAniosEs(n) {
  return fmtNumEs(n, 1);
}

/**
 * Volatilidad (desviación estándar ÷ |promedio|, como razón: 0.25 = 25%) para la UI.
 * Si el promedio está cerca de 0 la razón explota (p. ej. 12.47 → "1.247%"), así que
 * por encima de 100% se muestra ">100%" en vez de una cifra sin sentido.
 */
export function fmtVolatilidadEs(ratio) {
  const v = Math.abs(Number(ratio) || 0);
  if (v > 1) return ">100%";
  return fmtPctEs(v * 100, 0);
}

// Texto completo de la card de volatilidad.
export function fmtVolatilidadTextoEs(ratio) {
  const v = Math.abs(Number(ratio) || 0);
  if (v > 1) return "más de ±100 % del promedio";
  return `±${fmtVolatilidadEs(v)} del promedio`;
}
