// ════════════════════════════════════════════════════════════════════════════
// Región de la sesión: idioma (es / en) y país (CO / US).
//
// 3-nov-2026 (Santiago: "en la versión USA no veo la proyección a 10 años…
// muchas secciones no las hicieron… hagámoslo al nivel que necesitamos").
// Las pantallas que Colombia y EE. UU. comparten (Mi futuro a 10 años, Año
// entrante, Deudas, Dashboard…) estaban escritas para Colombia: pesos, es-CO,
// DIAN. En vez de una copia por país, cada pantalla compartida lee de aquí:
//
//   · idioma → textos: tx("Hola", "Hello")
//   · país   → cifras y supuestos: plata(1234567) → "$1.234.567" (CO) o
//              "$1,234,567" (US); TRM, inflación por defecto, impuestos.
//
// Son dos ejes distintos a propósito: hay usuarios de EE. UU. que eligieron
// español (la mayoría con nombre hispano), y deben ver dólares con formato de
// EE. UU. y textos en español.
//
// App.jsx llama a setRegion() en cada render, antes de pintar las pantallas.
// Fuera de la app (pruebas, funciones) el valor por defecto es Colombia en
// español, así todo lo que ya existía se comporta igual.
// ════════════════════════════════════════════════════════════════════════════

let R = { idioma: "es", pais: "CO" };

export function setRegion({ idioma, pais } = {}) {
  R = {
    idioma: idioma === "en" ? "en" : "es",
    pais: pais === "US" ? "US" : "CO",
  };
}
export const getRegion = () => R;
export const esEN = () => R.idioma === "en";
export const esUS = () => R.pais === "US";

/** Texto según el idioma: tx("Tu plata", "Your money"). Sin inglés, cae al español. */
export const tx = (es, en) => (R.idioma === "en" && en != null ? en : es);

/** Locale de las cifras: depende del país, no del idioma. */
export const localeCifras = () => (R.pais === "US" ? "en-US" : "es-CO");
/** Locale de fechas y nombres de mes: depende del idioma. */
export const localeTexto = () => (R.idioma === "en" ? "en-US" : "es-CO");

/** Moneda base del país. */
export const monedaBase = () => (R.pais === "US" ? "USD" : "COP");

/** Inflación anual por defecto (%) del país. CO: 4 (metrics.js). US: 3. */
export const inflacionDefaultPct = () => (R.pais === "US" ? 3 : 4);

// ─── Cifras ──────────────────────────────────────────────────────────────
const L = () => localeCifras();
const fin = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Número con decimales del país: 2,5 (CO) · 2.5 (US). */
export const num = (n, dec = 1) => fin(n).toLocaleString(L(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
/** Porcentaje: 4,4% · 4.4%. */
export const pct = (n, dec = 1) => num(n, dec) + "%";
/** Entero con separador de miles: 638.100 · 638,100. */
export const miles = (n) => Math.round(fin(n)).toLocaleString(L());
/** Plata completa: $638.100 · $638,100. Negativos con signo menos tipográfico. */
export const plata = (n) => { const v = Math.round(fin(n)); return (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString(L()); };

/**
 * Plata abreviada para tarjetas y gráficas.
 *   CO (igual que fmtPlataCortaEs): $16.393 MM · $2,5 MM · $850 K · $1,2 billones
 *   US: $16.4B · $2.5M · $850K
 */
export function plataCorta(n) {
  const v = Math.round(fin(n)), a = Math.abs(v), sg = v < 0 ? "−" : "";
  const q = (x, dec) => x.toLocaleString(L(), { minimumFractionDigits: 0, maximumFractionDigits: dec });
  if (R.pais === "US") {
    if (a >= 1e12) return sg + "$" + q(a / 1e12, 1) + "T";
    if (a >= 1e9) return sg + "$" + q(a / 1e9, 1) + "B";
    if (a >= 1e6) return sg + "$" + q(a / 1e6, a >= 1e8 ? 0 : 1) + "M";
    if (a >= 1e3) return sg + "$" + q(a / 1e3, 0) + "K";
    return sg + "$" + q(a, 0);
  }
  if (a >= 1e12) return sg + "$" + q(a / 1e12, 1) + (a < 2e12 ? " billón" : " billones");
  if (a >= 1e7) return sg + "$" + q(a / 1e6, 0) + " MM";
  if (a >= 1e6) return sg + "$" + q(a / 1e6, 1) + " MM";
  if (a >= 1e3) return sg + "$" + q(a / 1e3, 0) + " K";
  return sg + "$" + q(a, 0);
}

/** Ejemplo de monto para placeholders: "Ej.: 57.500.000" · "e.g. 57,500". */
export const ejemploMonto = (co, us) => tx("Ej.: ", "e.g. ") + miles(R.pais === "US" ? us : co);

/** Nombre del mes (1-12) en el idioma de la sesión. */
export const nombreMes = (m, corto = false) => {
  const t = new Date(2026, Math.max(0, Math.min(11, (m || 1) - 1)), 1).toLocaleDateString(localeTexto(), { month: corto ? "short" : "long" });
  return t.charAt(0).toUpperCase() + t.slice(1).replace(".", "");
};
