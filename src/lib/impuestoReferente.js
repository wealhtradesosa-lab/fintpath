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
import { ultimaDeclaracion, estimarDesdeDeclaracion, calculosGODelTitular } from "./rentaDesdeDeclaracion.js";

const num = (v) => Number(v) || 0;
const bruto = (d) => (d?.impBruto != null ? num(d.impBruto) : num(d?.impuesto));

/** Calibración por titular (por nombre, que es como el motor identifica el detalle). */
export function calibracionReferente(u) {
  const owners = (u?.owners || []).filter((o) => o && ultimaDeclaracion(o));
  if (!owners.length) return {};
  let motor;
  try { motor = estimarImpuesto(u); } catch { motor = { detalle: [] }; }
  const cal = {};
  for (const o of owners) {
    const e = estimarDesdeDeclaracion(o, { ...(u?.estimadoRenta?.[o.id] || {}), goSel: "" }, { calculosGO: calculosGODelTitular(u?.calculosGO, o) });
    if (!e) continue;
    const m = (motor.detalle || []).find((d) => d.name === o.name);
    const mb = bruto(m), mr = num(m?.reteN);
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
    return { ...d, impBruto, impuestoACargo: impBruto, reteN, impuesto, saldoAPagar: impuesto,
      tasaBruta: d.ingreso > 0 ? (impBruto / d.ingreso) * 100 : d.tasaBruta,
      fuente: "declaracion", impMotor: bruto(d), reteMotor: num(d.reteN) };
  });
  for (const [name, c] of Object.entries(cal)) {
    if (vistos.has(name)) continue;
    const impuesto = Math.max(0, c.renta - c.ret);
    detalle.push({ name, type: c.type, ingreso: 0, impBruto: c.renta, impuestoACargo: c.renta, reteN: c.ret, impuesto, saldoAPagar: impuesto, fuente: "declaracion", impMotor: 0, reteMotor: 0 });
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
