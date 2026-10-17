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
