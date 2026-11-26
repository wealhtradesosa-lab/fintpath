// 24-nov-2026 — Pantalla de Patrimonio y exports: qué TRM se usa y cómo se dice.
//
// Reglas (Finanzas + Tributario, 23-nov-2026):
//  - Pantallas de planeación (Patrimonio, Deudas, Ingresos, Gastos) y sus
//    exports: TRM de hoy, y lo dicen («TRM de hoy: $X»).
//  - Borrador F-210/F-110 y su PDF: TRM del 31-dic del año gravable (Art. 269
//    ET, TRM_CIERRE_ANO) y lo dicen.
//  - Sin tasa real: los montos en USD NO entran a los totales en pesos (ni
//    crudos ni con 4200). Se muestran en dólares con «pendiente de tasa».
//  - Cada export usa la tasa de la pantalla de donde sale y lleva un sello que
//    dice cuál usó.
//
// Mismo patrón que src/lib/deudasPantalla.js (#133). Este archivo no importa
// de ahí para no depender del orden de merge; las frases son las mismas.
import { trmUsable, trmCierreAno, TEXTO_PENDIENTE_TASA } from "./trm.js";

export const esUSD = (x) => String(x?.moneda || "").toUpperCase() === "USD";

const tasaTxt = (t) => "$" + Number(t).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usdTxt = (n) => "US$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

/** Monto en pesos, o null si es USD y no hay tasa real («pendiente de tasa»). Nunca 4200. */
export function montoCOP(monto, item, trm) {
  const n = Number(monto) || 0;
  if (!esUSD(item)) return n;
  const t = trmUsable(trm);
  return t == null ? null : n * t;
}

/** Para sumas: lo pendiente de tasa cuenta 0 (queda por fuera del total en pesos). */
export const montoCOPSuma = (monto, item, trm) => montoCOP(monto, item, trm) ?? 0;

/** ¿Este ítem en USD queda pendiente de tasa? */
export const pendienteDeTasa = (item, trm) => esUSD(item) && trmUsable(trm) == null;

/** Valor actual de un activo (va / valor_actual / valor). */
const valorActual = (i) => i?.va ?? i?.valor_actual ?? i?.valor ?? 0;

/**
 * Resumen de la pantalla de Patrimonio.
 * @returns {{ totalCOP:number, tasa:number|null, hayUSD:boolean,
 *   pendientes:Array, usdPendiente:number, pendienteTasa:boolean }}
 */
export function resumenPatrimonioPantalla(activos = [], trm) {
  const tasa = trmUsable(trm);
  const lista = (activos || []).filter((i) => i && i.sim !== false);
  const usd = lista.filter(esUSD);
  const pendientes = tasa == null ? usd : [];
  return {
    totalCOP: lista.reduce((s, i) => s + montoCOPSuma(valorActual(i), i, trm), 0),
    tasa,
    hayUSD: usd.length > 0,
    pendientes,
    usdPendiente: pendientes.reduce((s, i) => s + (Number(valorActual(i)) || 0), 0),
    pendienteTasa: pendientes.length > 0,
  };
}

/** «TRM de hoy: $X» o «TRM de hoy: pendiente de tasa». */
export function etiquetaTrmHoy(trm) {
  const t = trmUsable(trm);
  return "TRM de hoy: " + (t == null ? TEXTO_PENDIENTE_TASA : tasaTxt(t));
}

/** Línea fija bajo «TRM de hoy»: la declaración no usa la tasa de hoy. */
export const LINEA_TRM_DECLARACION = "En tu declaración se usa la TRM del 31-dic.";

export const NOTA_PATRIMONIO_PENDIENTE_TASA = "Todavía no tenemos la TRM de hoy: tus activos en dólares quedan por fuera de los totales en pesos (pendiente de tasa). Los ves en dólares en la lista.";

/** Texto bajo el valor de un activo en USD: «US$X ≈ $Y» o «US$X · pendiente de tasa». */
export function lineaActivoUSD(i, trm, fmt) {
  const f = fmt || ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  const cop = montoCOP(valorActual(i), i, trm);
  return usdTxt(valorActual(i)) + (cop == null ? " · " + TEXTO_PENDIENTE_TASA : " ≈ " + f(cop));
}

// ── Sellos de los exports ───────────────────────────────────────────────────

/** ¿Hay algún monto en USD en estas listas de ítems (o en un objeto de gastos por categoría)? */
export function hayUSDEn(...listas) {
  const plano = (x) => (Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x).flat() : []);
  return listas.some((l) => plano(l).some((i) => esUSD(i)));
}

/**
 * Sello de un export de una pantalla de planeación (TRM de hoy).
 * Devuelve una o dos líneas de texto.
 */
export function selloTrmHoy(trm, hayUSD) {
  if (!hayUSD) return ["Tasa del dólar: no hay montos en dólares en este archivo, no se usó TRM."];
  const t = trmUsable(trm);
  if (t == null) {
    return [
      "Tasa del dólar: " + etiquetaTrmHoy(trm) + ". Tus montos en dólares quedan por fuera de los totales en pesos.",
      LINEA_TRM_DECLARACION,
    ];
  }
  return [
    "Tasa del dólar: " + etiquetaTrmHoy(trm) + ". Tus montos en dólares se pasaron a pesos con esta tasa.",
    LINEA_TRM_DECLARACION,
  ];
}

/**
 * 24-nov-2026 (copy aprobado por Tributario) — Qué pasa con «pendiente de tasa»
 * del 31-dic. No dice «sola»: /api/trm solo trae la TRM de hoy; la del 31-dic
 * sale de TRM_CIERRE_ANO (se agrega en el código) o de user.trmCierre, que
 * ninguna pantalla llena sola. El año es el mismo de la nota (AG).
 */
export const completaTrmCierre = (ano) => "Se completa cuando se conozca la TRM vigente el 31-dic-" + ano + ".";

/** Sello del PDF del borrador F-210/F-110: TRM del 31-dic del año gravable (Art. 269 ET). */
export function selloTrmCierre(user, ano, hayUSD) {
  if (!hayUSD) return "Tasa del dólar: no hay montos en dólares, no se usó TRM.";
  const t = trmCierreAno(user, ano);
  return "Tasa del dólar: TRM del 31-dic-" + ano + ": " + (t == null ? TEXTO_PENDIENTE_TASA : tasaTxt(t)) + " (Art. 269 ET)." +
    (t == null ? " " + completaTrmCierre(ano) : "");
}

/**
 * Sello del informe/resumen para el contador (sale de Impuestos): TRM del
 * 31-dic del año gravable para lo que está en dólares (datosParaContador).
 */
export const LINEA_CONTADOR_USD = "Ingresos en dólares: van con la TRM del día de cada pago. Patrimonio y deudas en dólares: con la TRM del 31-dic.";

export function selloTrmContador(datos) {
  if (!datos?.hayUSD) return ["Tasa del dólar: no hay montos en dólares, no se usó TRM."];
  const t = trmUsable(datos.tasa);
  return [
    "Tasa del dólar: TRM del 31-dic-" + datos.ano + ": " + (t == null ? TEXTO_PENDIENTE_TASA : tasaTxt(t)) + " (Art. 269 ET)." +
      (t == null ? " " + completaTrmCierre(datos.ano) + " Tus montos en dólares quedan por fuera de los totales en pesos." : ""),
    LINEA_CONTADOR_USD,
  ];
}

/** Celda de un monto del informe del contador: pesos, o «US$X · pendiente de tasa». */
export const celdaContador = (x, campo, fmt) => (x?.pendienteTasa ? usdTxt(x.usd) + " · " + TEXTO_PENDIENTE_TASA : fmt(x?.[campo]));

/** Fecha de generación en hora de Bogotá: «Generado el 24 de noviembre de 2026». */
export function lineaGenerado(fecha = new Date()) {
  return "Generado el " + fecha.toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" });
}
