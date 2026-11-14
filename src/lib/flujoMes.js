// ═══════════════════════════════════════════════════════════════════════════
// flujoMes.js — Reglas del flujo de caja de UN mes, compartidas por el
// simulador (SimuladorAvanzado), el detalle del año (FlujoAnual) y la
// composición del mes. Vivían en SimuladorAvanzado.jsx; FlujoAnual tenía su
// propia copia y calculaba distinto el mismo mes.
//
// 14-nov-2026 (Santiago: "le marqué en la deuda de Deepal que se abonó 45 mm
// este mes y ese pico no se ve"). FlujoAnual cobraba la cuota fija los 12
// meses: ignoraba la frecuencia variable de la deuda, que es donde se carga un
// abono. Noviembre daba $89,1M allá y $80,2M en el simulador.
// ═══════════════════════════════════════════════════════════════════════════
import { montoDelMes } from "./flowHelpers.js";
import { TRM_PROVISIONAL, trmUsable } from "./trm.js";

export const fxDe = (item, trm) => (item?.moneda === "USD" ? (trmUsable(trm) ?? TRM_PROVISIONAL) : 1);

// CUOTA — por montoDelMes, que respeta frecuencia (variable = abonos), vigencia
// y moneda. Si el slider mueve la cuota, escala la del mes en la misma proporción.
export const cuotaDeudaDelMes = (d, cuotaBase, año, mes, trm) => {
  const original = Number(d?.pago || d?.pg || 0) || 0;
  const fx = fxDe(d, trm);
  if (original > 0 && Number(cuotaBase) !== original) {
    const delMes = montoDelMes({ ...d, mensual: original, m: undefined }, año, mes);
    return delMes * ((Number(cuotaBase) || 0) / original) * fx;
  }
  return montoDelMes({ ...d, mensual: cuotaBase, m: undefined }, año, mes) * fx;
};

// RETENCIÓN — sigue al ingreso del mes: si un mes entra menos, retienen menos.
export const retencionDelMes = (ingresosMes, brutoRef, retencionRef) =>
  (brutoRef > 0 ? (ingresosMes / brutoRef) * retencionRef : retencionRef);

// GASTO del mes en pesos (los gastos en dólares se convierten con la TRM).
export const gastoDelMes = (g, año, mes, trm) => montoDelMes(g, año, mes) * fxDe(g, trm);

// Deudas que pesan en el flujo: con saldo y encendidas.
export const deudaViva = (d) => (d?.mt || 0) > 0 && d?.sim !== false;
