// ═══════════════════════════════════════════════════════════════════════════
// abonosDeuda.js — Abonos extraordinarios a una deuda.
//
// 14-nov-2026 (Santiago: "pagué 45 mm de Deepal, pues que se cargue como abono
// a ese crédito y por tanto baje lo que falta"). Los extraordinarios no van en
// una lista suelta: se registran sobre el concepto que ya existe. En una deuda
// eso es un abono con su mes, que:
//   · sale en el flujo de caja de ESE mes (cuotaDeudaDelMes lo suma),
//   · baja el saldo,
//   · y, según lo que haga el banco, baja el plazo (misma cuota) o la cuota
//     (mismo plazo).
// El abono NO es recurrente: no entra en promedios ni en el nivel de libertad.
//
// Estructura: d.abonos = [{ id, año, mes, monto, efecto: "plazo"|"cuota",
//   saldoAntes, saldoDespues, cuotaAntes, cuotaDespues, ahorroInteres, registradoEl }]
// `monto` va en la moneda de la deuda.
// ═══════════════════════════════════════════════════════════════════════════
import { costoCredito, cuotaFija } from "./flowHelpers.js";

/** Suma de abonos extraordinarios de la deuda en un mes (moneda de la deuda). */
export function abonosDelMes(d, año, mes) {
  return (d?.abonos || []).reduce((s, a) => (a && Number(a.año) === Number(año) && Number(a.mes) === Number(mes) ? s + (Number(a.monto) || 0) : s), 0);
}

const cuotaDe = (d) => Number(d?.pg || d?.pago || 0) || 0;

/**
 * Qué pasa si se abona `monto` hoy. No modifica la deuda.
 * `saldoYaDescontado`: el saldo cargado ya refleja el abono (vino de un extracto nuevo).
 */
export function simularAbono(d, monto, efecto = "plazo", { saldoYaDescontado = false } = {}) {
  const m = Math.max(0, Number(monto) || 0);
  const saldoCargado = Number(d?.mt) || 0;
  const saldoAntes = saldoYaDescontado ? saldoCargado + m : saldoCargado;
  const saldoDespues = Math.max(0, saldoAntes - m);
  const cuotaAntes = cuotaDe(d);
  const antes = costoCredito({ ...d, mt: saldoAntes, pg: cuotaAntes });
  let cuotaDespues = cuotaAntes;
  if (efecto === "cuota" && saldoDespues > 0 && antes.meses) {
    const c = cuotaFija(saldoDespues, Number(d?.ts) || 0, antes.meses);
    if (c && c > 0) cuotaDespues = Math.round(c);
  }
  const despues = saldoDespues > 0 ? costoCredito({ ...d, mt: saldoDespues, pg: cuotaDespues }) : { meses: 0, interesTotal: 0 };
  const ahorroInteres = antes.interesTotal != null && despues.interesTotal != null
    ? Math.max(0, antes.interesTotal - despues.interesTotal) : null;
  return {
    monto: m, saldoAntes, saldoDespues, cuotaAntes, cuotaDespues,
    mesesAntes: antes.meses, mesesDespues: despues.meses,
    ahorroInteres, liquida: saldoDespues === 0,
  };
}

/**
 * Devuelve la deuda con el abono registrado.
 * `ajustarTabla`: en una deuda variable cuya tabla mensual ya traía el abono en ese
 * mes, deja ese mes con la cuota normal para no contarlo dos veces.
 */
export function registrarAbono(d, { año, mes, monto, efecto = "plazo", saldoYaDescontado = false, ajustarTabla = false, hoy = new Date() }) {
  const s = simularAbono(d, monto, efecto, { saldoYaDescontado });
  const abono = {
    id: "ab_" + hoy.getTime().toString(36),
    año: Number(año), mes: Number(mes), monto: s.monto, efecto,
    saldoAntes: s.saldoAntes, saldoDespues: s.saldoDespues,
    cuotaAntes: s.cuotaAntes, cuotaDespues: s.cuotaDespues,
    ahorroInteres: s.ahorroInteres, registradoEl: hoy.toISOString().slice(0, 10),
  };
  const out = { ...d, abonos: [...(d.abonos || []), abono], mt: s.saldoDespues };
  if (ajustarTabla && Array.isArray(d.montosMensuales) && d.montosMensuales.length === 12) {
    const tabla = [...d.montosMensuales];
    tabla[mes - 1] = s.cuotaAntes;
    out.montosMensuales = tabla;
  }
  if (efecto === "cuota" && s.cuotaDespues !== s.cuotaAntes && !s.liquida) {
    if (d.pg != null) out.pg = s.cuotaDespues;
    if (d.pago != null || d.pg == null) out.pago = s.cuotaDespues;
    if (Array.isArray(out.montosMensuales) && out.montosMensuales.length === 12) {
      out.montosMensuales = out.montosMensuales.map((v, i) => (i + 1 > mes && Number(v) > 0 ? s.cuotaDespues : v));
    }
  }
  if (s.liquida) Object.assign(out, { pagada: true, pagadaMes: Number(mes), pagadaEl: abono.registradoEl, hastaMes: Number(mes) });
  return out;
}

/** Quita un abono y devuelve el saldo (y la cuota, si la había cambiado) a como estaban. */
export function eliminarAbono(d, idAbono) {
  const a = (d?.abonos || []).find((x) => x.id === idAbono);
  if (!a) return d;
  const out = { ...d, abonos: d.abonos.filter((x) => x.id !== idAbono), mt: (Number(d.mt) || 0) + (Number(a.monto) || 0) };
  if (a.efecto === "cuota" && a.cuotaAntes && cuotaDe(d) === a.cuotaDespues) {
    if (d.pg != null) out.pg = a.cuotaAntes;
    if (d.pago != null) out.pago = a.cuotaAntes;
  }
  if (d.pagada && Number(d.pagadaMes) === Number(a.mes) && a.saldoDespues === 0) {
    delete out.pagada; delete out.pagadaMes; delete out.pagadaEl; delete out.hastaMes;
  }
  return out;
}

/** ¿La tabla mensual de una deuda variable ya parece incluir este abono? */
export function tablaYaTraeAbono(d, mes, monto) {
  if (d?.frecuencia !== "variable" || !Array.isArray(d.montosMensuales)) return false;
  const v = Number(d.montosMensuales[mes - 1]) || 0;
  return v - cuotaDe(d) >= (Number(monto) || 0) * 0.9 && Number(monto) > 0;
}
