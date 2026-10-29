// ═══════════════════════════════════════════════════════════════════════════
// Impuesto referente de toda la plataforma
// ─────────────────────────────────────────────────────────────────────────
// 29-oct-2026 (Santiago: "cuando uno hace el cálculo de impuestos, ese es el
// que queda para los simuladores como referente"). Hasta hoy el Dashboard, el
// flujo de caja y los simuladores usaban estimarImpuesto(u), que arma la renta
// desde cero con lo registrado y salía muy por encima de lo que declara el
// contador.
//
// Regla: si un titular tiene declaración cargada, su impuesto de referencia es
// el de «Lo que viene» (rentaDesdeDeclaracion.js, con sus respuestas guardadas).
// El motor completo se sigue usando para la SENSIBILIDAD: en un simulador, si
// subes un ingreso, el impuesto se mueve como diga el motor, pero escalado al
// nivel calibrado con la declaración (factor = referente / motor de hoy).
// Titulares sin declaración: motor tal cual. Ganancia ocasional: no entra al
// impuesto mensual (es de una sola vez); vive en «Lo que viene».
// ═══════════════════════════════════════════════════════════════════════════

import { estimarImpuesto } from "./taxCO.js";
import { ultimaDeclaracion, declaracionesOrdenadas, estimarDesdeDeclaracion, calculosGODelTitular, impuestoDeclarado, retencionDeclarada, lista2026DesdeIngresos } from "./rentaDesdeDeclaracion.js";

const num = (v) => Number(v) || 0;
const bruto = (d) => (d?.impBruto != null ? num(d.impBruto) : num(d?.impuesto));

/**
 * Calibración por titular (por nombre, que es como el motor identifica el detalle).
 *
 * 29-oct-2026 (Santiago: "eso me tenía bien confundido en mis números"):
 *   modo "actual"  → el año en curso. Lo que se PAGA este año sale de la declaración
 *                    del año anterior, que ya es real: retenciones + saldo que se pagó.
 *                    (La renta de este año se declara y paga el año que viene.)
 *   modo "estimado"→ años siguientes (Simulador Futuro): el estimado de la Calculadora.
 * Si el titular no tiene la declaración del año anterior, «actual» usa el estimado.
 */
export function calibracionReferente(u, { modo = "actual", hoy = new Date() } = {}) {
  const owners = (u?.owners || []).filter((o) => o && ultimaDeclaracion(o));
  if (!owners.length) return {};
  let motor;
  try { motor = estimarImpuesto(u); } catch { motor = { detalle: [] }; }
  const cal = {};
  for (const o of owners) {
    const m = (motor.detalle || []).find((d) => d.name === o.name);
    const mb = bruto(m), mr = num(m?.reteN);
    const anoPasado = hoy.getFullYear() - 1;
    const real = modo === "actual" ? declaracionesOrdenadas(o).find((d) => Number(d.anoGravable) === anoPasado) : null;
    if (real) {
      // Lo que sale de la caja este año: retenciones (cada mes) + el saldo de la declaración del año pasado.
      const ret = retencionDeclarada(real), saldo = Math.max(0, num(real.renglones.saldoPagar));
      const renta = ret + saldo;
      cal[o.name] = { ownerId: o.id, type: o.type || "natural", renta, ret, ano: anoPasado + 1, real: true, impDeclarado: impuestoDeclarado(real),
        fImp: mb > renta * 0.05 ? renta / mb : null, fRet: mr > 0 && ret > 0 ? ret / mr : null };
      continue;
    }
    const resp = { ...(u?.estimadoRenta?.[o.id] || {}), goSel: "" };
    if (resp.lista2026 == null) { const l = lista2026DesdeIngresos(u, o.id); if (l.length) resp.lista2026 = l; } // igual que la Calculadora
    const e = estimarDesdeDeclaracion(o, resp, { calculosGO: calculosGODelTitular(u?.calculosGO, o) });
    if (!e) continue;
    // Si el motor casi no ve ingresos de este titular, no sirve como base de escala: valor absoluto.
    cal[o.name] = {
      ownerId: o.id, type: o.type || (e.nat ? "natural" : "juridica"), renta: e.renta, ret: e.ret, ano: e.anoEst,
      fImp: mb > e.renta * 0.05 ? e.renta / mb : null,
      fRet: mr > 0 && e.ret > 0 ? e.ret / mr : null,
    };
  }
  return cal;
}

/** Aplica la calibración a un resultado de estimarImpuesto (de hoy o simulado). */
export function aplicarReferente(est, cal) {
  if (!est || !cal || !Object.keys(cal).length) return est;
  const vistos = new Set();
  const detalle = (est.detalle || []).map((d) => {
    const c = cal[d.name]; if (!c) return d;
    vistos.add(d.name);
    const impBruto = c.fImp != null ? bruto(d) * c.fImp : c.renta;
    const reteN = c.fRet != null ? num(d.reteN) * c.fRet : c.ret;
    const impuesto = Math.max(0, impBruto - reteN);
    // impOptBruto también: el Simulador lo usa cuando el titular tiene «optimizado» activo.
    const impOptBruto = d.impOptBruto != null ? (c.fImp != null ? num(d.impOptBruto) * c.fImp : Math.min(c.renta, impBruto)) : undefined;
    return { ...d, impBruto, impOptBruto, impuestoACargo: impBruto, reteN, impuesto, saldoAPagar: impuesto,
      tasaBruta: d.ingreso > 0 ? (impBruto / d.ingreso) * 100 : d.tasaBruta,
      fuente: c.real ? "declaracion_real" : "declaracion", impMotor: bruto(d), reteMotor: num(d.reteN) };
  });
  for (const [name, c] of Object.entries(cal)) {
    if (vistos.has(name)) continue;
    const impuesto = Math.max(0, c.renta - c.ret);
    detalle.push({ name, type: c.type, ingreso: 0, impBruto: c.renta, impuestoACargo: c.renta, reteN: c.ret, impuesto, saldoAPagar: impuesto, fuente: c.real ? "declaracion_real" : "declaracion", impMotor: 0, reteMotor: 0 });
  }
  const total = detalle.reduce((a, d) => a + num(d.impuesto), 0);
  return { ...est, detalle, total, mes: total / 12, referente: true };
}

/**
 * Impuesto de referencia. `cal` se calcula con los datos REALES de hoy (en App)
 * y se pasa a los simuladores dentro del usuario como `_calRef`, porque el
 * usuario simulado ya no es el de hoy.
 */
export function estimarImpuestoReferente(u, cal) {
  const est = estimarImpuesto(u);
  return aplicarReferente(est, cal || u?._calRef || calibracionReferente(u));
}

// ─── En qué mes se paga ───────────────────────────────────────────────────
// 29-oct-2026 (Santiago: "los impuestos no se pagan cada mes: uno paga en el mes que
// le toca el valor que le toca"). Las retenciones sí salen cada mes (las descuenta
// quien paga); el saldo de la declaración sale de un golpe:
//   personas  → un pago, entre agosto y octubre según los dos últimos dígitos de la cédula;
//   sociedades→ dos cuotas iguales, cerca de mayo y julio (último dígito del NIT).
// owner.mesDeclaracion (1-12) fija el mes; si no está, persona → septiembre, sociedad → mayo.
export function mesesDePago(owner) {
  const jur = owner?.type === "juridica";
  const m = Number(owner?.mesDeclaracion) || (jur ? 5 : 9);
  return jur ? [{ mes: m, fraccion: 0.5 }, { mes: Math.min(12, m + 2), fraccion: 0.5 }] : [{ mes: m, fraccion: 1 }];
}
/** Saldo del impuesto que se paga en un mes dado (sin retenciones), sumando todos los titulares. */
export function saldoImpuestoDelMes(detalle, owners, mes) {
  let total = 0;
  for (const d of detalle || []) {
    const saldo = Math.max(0, num(d.impBruto ?? d.impuesto) - num(d.reteN));
    if (!saldo) continue;
    const o = (owners || []).find((x) => x.name === d.name) || { type: d.type };
    for (const p of mesesDePago(o)) if (p.mes === mes) total += saldo * p.fraccion;
  }
  return total;
}
