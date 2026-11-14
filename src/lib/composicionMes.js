// ═══════════════════════════════════════════════════════════════════════════
// composicionMes.js — Qué entró y qué salió en un mes, concepto por concepto.
//
// 14-nov-2026 (Santiago, en el detalle del año: "en noviembre me ingresaron
// 184 mm pero no me queda claro de dónde se toma ese valor […] no se ve el
// detalle de lo que ingresó ese mes y cuánto suma"; "sí veo qué aumentó o qué
// se pagó menos, pero no el listado claro de los gastos, ingresos y pagos de
// deudas de ese mes").
//
// El panel del mes solo explicaba la diferencia contra el promedio. Esto es la
// otra pregunta: la composición. Usa EXACTAMENTE las mismas reglas que
// FlujoAnual.datosMensuales (montoDelMes por ítem, cuotas por vigencia), así
// que los totales son, por construcción, las cifras del encabezado del mes.
// ═══════════════════════════════════════════════════════════════════════════

import { montoDelMes } from "./flowHelpers.js";
import { cuotaDeudaDelMes, gastoDelMes, deudaViva, fxDe } from "./flujoMes.js";
import { abonosDelMes } from "./abonosDeuda.js";

const porMonto = (a, b) => b.monto - a.monto;

/**
 * @returns {{ ingresos: Array<{nombre,cat,monto}>, totalIngresos: number,
 *   gastos: Array<{nombre,cat,monto,aporte}>, totalGastos: number,
 *   cuotas: Array<{nombre,monto}>, totalCuotas: number }}
 */
export function composicionMes({ user, año, mes, trm = 4200 }) {
  const ingresos = [];
  (user?.ingresos || []).forEach((ing) => {
    if (ing.sim === false) return;
    const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
    const monto = montoDelMes({ ...ing, mensual: montoBase }, año, mes);
    if (Math.round(monto) !== 0) ingresos.push({ nombre: ing.nombre || ing.fuente || "Ingreso", cat: ing.categoria || "", monto });
  });

  const gastos = [];
  Object.entries(user?.gas || user?.gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g) => {
      if (g.sim === false) return;
      const monto = gastoDelMes(g, año, mes, trm);
      if (Math.round(monto) !== 0) gastos.push({ nombre: g.c || cat, cat, monto, aporte: cat === "Seguridad Social" });
    });
  });

  const cuotas = [];
  (user?.deu || user?.deudas || []).forEach((d) => {
    if (!deudaViva(d)) return;
    // Mismo cálculo del simulador: respeta frecuencia variable (abonos), vigencia y moneda.
    const monto = cuotaDeudaDelMes(d, d.pago || d.pg || 0, año, mes, trm);
    const abono = abonosDelMes(d, año, mes) * fxDe(d, trm);
    if (Math.round(monto) !== 0) cuotas.push(abono > 0 ? { nombre: d.n || d.nombre || "Deuda", monto, abono } : { nombre: d.n || d.nombre || "Deuda", monto });
  });

  const suma = (xs) => xs.reduce((s, x) => s + x.monto, 0);
  return {
    ingresos: ingresos.sort(porMonto), totalIngresos: suma(ingresos),
    gastos: gastos.sort(porMonto), totalGastos: suma(gastos),
    cuotas: cuotas.sort(porMonto), totalCuotas: suma(cuotas),
  };
}
