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
 * Plata abreviada para tarjetas y gráficas, SIEMPRE con puntos de miles.
 *
 * 21-oct-2026 (Santiago: "por favor separar en miles esto es terrible", "lo
 * hemos pedido mucho", "siempre lo hace"). Había SEIS copias de esta función
 * —MiPlan (dos), caminos, LandingLibertad, RentaAnoTrasAno, SimuladorFuturo—
 * y todas abreviaban con `toFixed()`, que no pone separador de miles. Mientras
 * la cifra cabía en tres dígitos no se notaba; apenas una pasó de los mil
 * millones salió "$6018241,6 mil M" en la tarjeta de Escenarios. Arreglarla en
 * una copia dejaba las otras cinco rotas, así que vive acá, una sola vez.
 *
 * 22-oct-2026 — Faltaba el escalón de arriba. "$62.550,1 mil M al mes" se lee
 * como "62" y Santiago preguntó tres veces si eran 62 millones: son 62
 * BILLONES. Mil millones de mil millones no le cabe a nadie en la cabeza
 * escrito como "mil M". Pasado el billón se dice billones, que es la palabra
 * que usa la gente, y ahí el absurdo se ve solo.
 *
 *   62.550.100.000.000.000 → "$62,6 billones"
 *   1.234.567.890.123 → "$1,2 billones"
 *   28.500.000        → "$29 M"    (de 10 M para arriba, entero)
 *   2.500.000         → "$2,5 M"
 *   850.000           → "$850 K"
 */
export function fmtPlataCortaEs(n) {
  const v = Math.round(Number(n) || 0), a = Math.abs(v), sg = v < 0 ? "−" : "";
  const q = (x, dec) => x.toLocaleString(ES, { minimumFractionDigits: 0, maximumFractionDigits: dec });
  if (a >= 1e12) return sg + "$" + q(a / 1e12, 1) + (a < 2e12 ? " billón" : " billones");
  if (a >= 1e9) return sg + "$" + q(a / 1e9, 1) + " mil M";
  if (a >= 1e7) return sg + "$" + q(a / 1e6, 0) + " M";
  if (a >= 1e6) return sg + "$" + q(a / 1e6, 1) + " M";
  if (a >= 1e3) return sg + "$" + q(a / 1e3, 0) + " K";
  return sg + "$" + q(a, 0);
}

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
