// ═══════════════════════════════════════════════════════════════════════════
// gastosExtra.js — Gastos extraordinarios sobre un gasto que ya existe.
//
// 14-nov-2026 (Santiago: "gasté 4.500 USD en vacaciones pagado con TC […] que
// pueda marcar ese extra asociado a vacaciones"; "si no existe asociado a nada,
// poderlo crear"; "ojo, no quiero que esto se vuelva una plataforma de registrar
// hasta la salida a un restaurante").
//
// El extra vive dentro del gasto (g.extras) y por eso suma al total del año de
// esa categoría. NO es recurrente: no entra en promedios ni en el nivel.
// La forma de pago decide en qué mes sale la plata:
//   · contado      → el mismo mes;
//   · tarjeta1     → el mes siguiente (al pagar la tarjeta);
//   · cuotas       → N cuotas desde el mes siguiente, con la tasa de la tarjeta.
// Lo que caiga después de diciembre no pesa en el flujo de este año.
//
// Estructura: g.extras = [{ id, año, mes, monto, moneda, nota, pago, cuotas, tasa, registradoEl }]
// ═══════════════════════════════════════════════════════════════════════════
import { cuotaFija, montoPromedioMensual } from "./flowHelpers.js";
import { TRM_PROVISIONAL, trmUsable } from "./trm.js";

const fxM = (moneda, trm) => (moneda === "USD" ? (trmUsable(trm) ?? TRM_PROVISIONAL) : 1);

/** Pagos de caja de un extra: [{ año, mes, monto }] en la moneda del extra. */
export function calendarioExtra(x) {
  const m = Number(x?.monto) || 0;
  const año = Number(x?.año), mes = Number(x?.mes);
  if (!(m > 0) || !año || !mes) return [];
  const sig = (k) => { const t = mes - 1 + k; return { año: año + Math.floor(t / 12), mes: (t % 12) + 1 }; };
  if (x.pago === "tarjeta1") return [{ ...sig(1), monto: m }];
  if (x.pago === "cuotas") {
    const n = Math.max(1, Math.round(Number(x.cuotas) || 1));
    const c = cuotaFija(m, Number(x.tasa) || 0, n) || m / n;
    return Array.from({ length: n }, (_, i) => ({ ...sig(i + 1), monto: c }));
  }
  return [{ año, mes, monto: m }];
}

/** Lo que sale de caja en un mes por los extras de un gasto, en pesos. */
export function extrasCajaDelMes(g, año, mes, trm) {
  let t = 0;
  (g?.extras || []).forEach((x) => {
    const f = fxM(x.moneda || g.moneda, trm);
    calendarioExtra(x).forEach((p) => { if (p.año === Number(año) && p.mes === Number(mes)) t += p.monto * f; });
  });
  return t;
}

/** Valor del extra en pesos (lo que se gastó, sin intereses). */
export const extraEnPesos = (x, g, trm) => (Number(x?.monto) || 0) * fxM(x?.moneda || g?.moneda, trm);

/** Gasto mensual recurrente de referencia (para el umbral que orienta). */
export function gastoMensualReferencia(gastos, trm) {
  let t = 0;
  Object.values(gastos || {}).forEach((items) => (items || []).forEach((g) => {
    if (g.sim === false) return;
    t += montoPromedioMensual(g) * fxM(g.moneda, trm);
  }));
  return t;
}

/** ¿El valor es tan pequeño que ya cabe en los gastos del mes? (menos del 5 %) */
export const esMenorQueUmbral = (montoCOP, gastoMensual) => gastoMensual > 0 && montoCOP < gastoMensual * 0.05;

const nuevoExtra = (d, hoy = new Date()) => ({
  id: "gx_" + hoy.getTime().toString(36),
  año: Number(d.año), mes: Number(d.mes), monto: Number(d.monto) || 0, moneda: d.moneda || "COP",
  nota: (d.nota || "").trim(), pago: d.pago || "contado",
  ...(d.pago === "cuotas" ? { cuotas: Math.max(1, Math.round(Number(d.cuotas) || 1)), tasa: Number(d.tasa) || 0 } : {}),
  registradoEl: hoy.toISOString().slice(0, 10),
});

/** Agrega el extra al gasto `cat[idx]`. Devuelve el objeto de gastos nuevo. */
export function registrarExtra(gastos, cat, idx, datos, hoy) {
  const out = { ...gastos };
  out[cat] = (gastos[cat] || []).map((g, i) => (i === idx ? { ...g, extras: [...(g.extras || []), nuevoExtra(datos, hoy)] } : g));
  return out;
}

/** Crea un concepto nuevo sin monto recurrente que nace con este extra. */
export function crearConExtra(gastos, { nombre, cat }, datos, hoy) {
  const out = { ...gastos };
  const item = { c: (nombre || "").trim() || cat, m: 0, frecuencia: "mensual", soloExtras: true, extras: [nuevoExtra(datos, hoy)] };
  out[cat] = [...(gastos[cat] || []), item];
  return out;
}

export function eliminarExtra(gastos, cat, idx, id) {
  const out = { ...gastos };
  out[cat] = (gastos[cat] || [])
    .map((g, i) => (i === idx ? { ...g, extras: (g.extras || []).filter((x) => x.id !== id) } : g))
    // 14-nov-2026: un gasto que solo existía por sus pagos únicos se va con el último.
    .filter((g, i) => !(i === idx && g.soloExtras && !(g.extras || []).length));
  return out;
}
