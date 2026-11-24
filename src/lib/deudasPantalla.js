// 24-nov-2026 — Pantalla de Deudas: las deudas en dólares se pasan a pesos con
// la TRM de hoy antes de sumarlas. Antes el total («Deuda total», cuotas,
// intereses) sumaba los USD como si fueran pesos: 10.000 USD salían como
// $10.000. Y donde sí se convertía, faltando la tasa se usaba 4200.
//
// Reglas (Finanzas + Tributario):
//  - Total de la pantalla y plan de pago: TRM de hoy.
//  - Sin TRM real: la deuda en USD NO entra al total en pesos (ni como pesos ni
//    con 4200). Se muestra en dólares y la pantalla avisa «pendiente de tasa».
//  - La declaración usa la TRM del 31-dic del año gravable (Art. 269 ET): esta
//    pantalla solo lo recuerda (LINEA_TRM_DECLARACION). La tasa del AG va en las
//    pantallas de Impuestos (notaTrmDeclaracion en App.jsx, con DEFAULT_AG).
import { trmUsable, TEXTO_PENDIENTE_TASA } from "./trm.js";

export const esDeudaUSD = (d) => String(d?.moneda || "").toUpperCase() === "USD";

/** Factor a pesos: 1 en pesos, la TRM de hoy en USD, o null si falta la tasa. */
export function factorCOP(d, trm) {
  if (!esDeudaUSD(d)) return 1;
  return trmUsable(trm);
}

/** Monto en pesos o null («pendiente de tasa»). Nunca 4200. */
export function aCOP(d, monto, trm) {
  const f = factorCOP(d, trm);
  return f == null ? null : (Number(monto) || 0) * f;
}

/** Suma en pesos de `valor(d)`; las deudas en USD sin tasa quedan por fuera. */
export function sumaCOP(deudas = [], trm, valor = (d) => d?.mt || 0) {
  return (deudas || []).reduce((s, d) => {
    const f = factorCOP(d, trm);
    return f == null ? s : s + (Number(valor(d)) || 0) * f;
  }, 0);
}

/**
 * Resumen del total de la pantalla de Deudas.
 * @returns {{ totalCOP:number, tasa:number|null, hayUSD:boolean,
 *   pendientes:Array, usdPendiente:number, pendienteTasa:boolean }}
 */
export function resumenDeudasPantalla(deudas = [], trm) {
  const tasa = trmUsable(trm);
  const lista = deudas || [];
  const usd = lista.filter(esDeudaUSD);
  const pendientes = tasa == null ? usd : [];
  return {
    totalCOP: sumaCOP(lista, trm),
    tasa,
    hayUSD: usd.length > 0,
    pendientes,
    usdPendiente: pendientes.reduce((s, d) => s + (Number(d.mt) || 0), 0),
    pendienteTasa: pendientes.length > 0,
  };
}

/** Las deudas que el plan de pago puede usar: sin tasa, las USD quedan fuera. */
export function deudasParaPlan(deudas = [], trm) {
  return trmUsable(trm) == null ? (deudas || []).filter((d) => !esDeudaUSD(d)) : (deudas || []);
}

const pesos = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const tasaTxt = (t) => "$" + Number(t).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usdTxt = (n) => "US$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

/** «TRM de hoy: $X» o «TRM de hoy: pendiente de tasa». */
export function etiquetaTrmHoy(trm) {
  const t = trmUsable(trm);
  return "TRM de hoy: " + (t == null ? TEXTO_PENDIENTE_TASA : tasaTxt(t));
}

/** Segunda línea bajo el saldo en USD: «≈ $Y» o «pendiente de tasa». */
export function subLineaDeudaUSD(d, trm, fmt = pesos) {
  const cop = aCOP(d, d?.mt, trm);
  return cop == null ? TEXTO_PENDIENTE_TASA : "≈ " + fmt(cop);
}

/** Texto bajo el monto de una deuda en USD: «US$X ≈ $Y» o «US$X · pendiente de tasa». */
export function lineaDeudaUSD(d, trm, fmt = pesos) {
  const cop = aCOP(d, d?.mt, trm);
  return usdTxt(d?.mt) + (cop == null ? " · " + TEXTO_PENDIENTE_TASA : " ≈ " + fmt(cop));
}

export const NOTA_TOTAL_PENDIENTE_TASA = "Todavía no tenemos la TRM de hoy: tus deudas en dólares quedan por fuera de los totales en pesos (pendiente de tasa). Las ves en dólares en la lista.";

/** Línea fija bajo «TRM de hoy»: la declaración no usa la tasa de hoy. */
export const LINEA_TRM_DECLARACION = "En tu declaración se usa la TRM del 31-dic.";
