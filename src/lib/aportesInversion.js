// ═══════════════════════════════════════════════════════════════════════════
// aportesInversion.js — Aportes extraordinarios a una inversión.
//
// 14-nov-2026 (Santiago: "este mes invertí 5 mm en IBKR, pues que eso lo
// sepa"). Igual que el abono a deudas: se registra sobre la inversión que ya
// existe. El aporte:
//   · sale en el flujo de caja de ese mes como inversión (no como gasto),
//   · sube el valor y el costo de la inversión (el patrimonio no baja: la
//     plata cambió de lugar),
//   · no entra en promedios ni en el nivel de libertad.
// Estructura: inv.aportes = [{ id, año, mes, monto, registradoEl }], en la moneda de la inversión.
// ═══════════════════════════════════════════════════════════════════════════
import { TRM_PROVISIONAL, trmUsable } from "./trm.js";

const fx = (inv, trm) => (inv?.moneda === "USD" ? (trmUsable(trm) ?? TRM_PROVISIONAL) : 1);
const valorDe = (i) => Number(i?.va ?? i?.valor_actual ?? i?.valor ?? 0) || 0;
const costoDe = (i) => Number(i?.vc ?? i?.valor_compra ?? i?.costo ?? 0) || 0;

/** Aportes de una inversión en un mes (moneda de la inversión). */
export function aportesDelMes(inv, año, mes) {
  return (inv?.aportes || []).reduce((s, a) => (a && Number(a.año) === Number(año) && Number(a.mes) === Number(mes) ? s + (Number(a.monto) || 0) : s), 0);
}

/** Total en pesos de los aportes a inversiones de un mes, con el detalle por inversión. */
export function aportesInversionDelMes(user, año, mes, trm) {
  const items = [];
  (user?.inv || user?.inversiones || []).forEach((inv) => {
    const m = aportesDelMes(inv, año, mes);
    if (m > 0) items.push({ nombre: inv.n || inv.nombre || "Inversión", monto: m * fx(inv, trm) });
  });
  return { total: items.reduce((t, x) => t + x.monto, 0), items: items.sort((a, b) => b.monto - a.monto) };
}

/** Registra el aporte. `yaIncluido`: el valor cargado ya refleja el aporte. */
export function registrarAporte(inv, { año, mes, monto, yaIncluido = false, hoy = new Date() }) {
  const m = Math.max(0, Number(monto) || 0);
  const aporte = { id: "ap_" + hoy.getTime().toString(36), año: Number(año), mes: Number(mes), monto: m, yaIncluido: !!yaIncluido, registradoEl: hoy.toISOString().slice(0, 10) };
  const out = { ...inv, aportes: [...(inv.aportes || []), aporte] };
  if (!yaIncluido) { out.va = valorDe(inv) + m; out.vc = costoDe(inv) + m; }
  return out;
}

/** Quita un aporte y devuelve valor y costo a como estaban (si el aporte los había movido). */
export function eliminarAporte(inv, id) {
  const a = (inv?.aportes || []).find((x) => x.id === id);
  if (!a) return inv;
  const out = { ...inv, aportes: inv.aportes.filter((x) => x.id !== id) };
  if (!a.yaIncluido) { out.va = Math.max(0, valorDe(inv) - a.monto); out.vc = Math.max(0, costoDe(inv) - a.monto); }
  return out;
}
