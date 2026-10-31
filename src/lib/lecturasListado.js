// 31-oct-2026 — Dos lecturas para las listas de Ingresos y Egresos.
//  · corteTrabajo: cuánto de lo que entra depende de que trabajes y cuánto no
//    (mismo criterio del motor: tipoIngreso de metrics.js).
//  · mesVsPromedio: por clase, cuánto sale (o entra) este mes contra el
//    promedio mensual del año, para decir «este mes gastaste X % más en…».
import { tipoIngreso } from "./metrics.js";
import { montoPromedioMensual, montoDelMes } from "./flowHelpers.js";

const fx = (x, trm) => (x && x.moneda === "USD" ? Number(trm) || 4200 : 1);
const activos = (items) => (items || []).filter((x) => x && x.sim !== false);

export function corteTrabajo(ingresos, trm) {
  let trabajo = 0, sinTrabajo = 0;
  activos(ingresos).forEach((i) => {
    const m = montoPromedioMensual(i) * fx(i, trm);
    if (tipoIngreso(i) === "pasivo") sinTrabajo += m; else trabajo += m;
  });
  const total = trabajo + sinTrabajo;
  return { trabajo, sinTrabajo, total, pctSin: total > 0 ? (sinTrabajo / total) * 100 : 0 };
}

/**
 * @param items     ingresos o gastos
 * @param claseDe   (item) => {id, nombre, icono}
 * @param opts      { trm, año, mes, minPct = 10, minParte = 0.02 }
 * Devuelve las clases que este mes se apartan del promedio (|%| ≥ minPct y la
 * diferencia pesa al menos minParte del total), de mayor a menor diferencia.
 */
export function mesVsPromedio(items, claseDe, { trm, año, mes, minPct = 10, minParte = 0.02 } = {}) {
  const por = {};
  let totProm = 0, totMes = 0;
  activos(items).forEach((x) => {
    const c = claseDe(x);
    const f = fx(x, trm);
    const p = montoPromedioMensual(x) * f, m = montoDelMes(x, año, mes) * f;
    const k = (por[c.id] = por[c.id] || { id: c.id, nombre: c.nombre, icono: c.icono, prom: 0, mes: 0 });
    k.prom += p; k.mes += m; totProm += p; totMes += m;
  });
  const clases = Object.values(por).map((k) => ({ ...k, dif: k.mes - k.prom, pct: k.prom > 0 ? ((k.mes - k.prom) / k.prom) * 100 : null }));
  const notables = clases
    .filter((k) => k.pct != null && Math.abs(k.pct) >= minPct && Math.abs(k.dif) >= totProm * minParte)
    .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  return { totProm, totMes, difTotal: totMes - totProm, pctTotal: totProm > 0 ? ((totMes - totProm) / totProm) * 100 : 0, clases, notables };
}
