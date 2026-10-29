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
import { ultimaDeclaracion, declaracionesOrdenadas, estimarDesdeDeclaracion, calculosGODelTitular, impuestoDeclarado, retencionDeclarada, lista2026DesdeIngresos, saldoDeclarado } from "./rentaDesdeDeclaracion.js";

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
      const ret = retencionDeclarada(real), sd = saldoDeclarado(real), saldo = Math.max(0, sd.valor);
      const renta = ret + saldo;
      cal[o.name] = { ownerId: o.id, type: o.type || "natural", renta, ret, ano: anoPasado + 1, real: true, impDeclarado: impuestoDeclarado(real), totalAlDeclarar: saldo, anoDeclaracion: anoPasado, saldoAjustado: sd.ajustado || false,
        fImp: mb > renta * 0.05 ? renta / mb : null, fRet: mr > 0 && ret > 0 ? ret / mr : null };
      continue;
    }
    const resp = { ...(u?.estimadoRenta?.[o.id] || {}), goSel: "" };
    if (resp.lista2026 == null) { const l = lista2026DesdeIngresos(u, o.id); if (l.length) resp.lista2026 = l; } // igual que la Calculadora
    const gos = { calculosGO: calculosGODelTitular(u?.calculosGO, o) };
    const e = estimarDesdeDeclaracion(o, resp, gos);
    if (!e) continue;
    // El pago al declarar sí lleva la ganancia ocasional (se paga en la misma declaración):
    // mismo número que «Te toca pagar» de la Calculadora.
    const respTodo = { ...(u?.estimadoRenta?.[o.id] || {}) };
    if (respTodo.lista2026 == null && resp.lista2026) respTodo.lista2026 = resp.lista2026;
    let eTodo = e; try { eTodo = estimarDesdeDeclaracion(o, respTodo, gos) || e; } catch { /* sin GO */ }
    // Si el motor casi no ve ingresos de este titular, no sirve como base de escala: valor absoluto.
    cal[o.name] = {
      ownerId: o.id, type: o.type || (e.nat ? "natural" : "juridica"), renta: e.renta, ret: e.ret, ano: e.anoEst,
      // Lo que se paga al presentar la declaración de e.anoEst (en e.anoEst + 1): saldo + anticipo del año siguiente.
      saldo: eTodo.saldo, anticipoSiguiente: eTodo.anticipoSiguiente, totalAlDeclarar: eTodo.totalAlDeclarar, anoDeclaracion: e.anoEst,
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
// 29-oct-2026: la fecha sale sola del NIT/cédula leído en la declaración (calendario DIAN
// personas naturales 2026, por los dos últimos dígitos; para años siguientes se asume el mismo
// patrón hasta que salga el nuevo decreto). Sociedades: 1.ª cuota en mayo y 2.ª en julio.
const CAL_PN = [[8,12],[8,13],[8,14],[8,18],[8,19],[8,20],[8,21],[8,24],[8,25],[8,26],[8,27],[8,28],[8,31],[9,1],[9,2],[9,3],[9,4],[9,7],[9,8],[9,9],[9,10],[9,11],[9,14],[9,15],[9,16],[9,17],[9,18],[9,21],[9,22],[9,23],[9,24],[9,25],[9,28],[10,1],[10,2],[10,5],[10,6],[10,7],[10,8],[10,9],[10,13],[10,14],[10,15],[10,16],[10,19],[10,20],[10,21],[10,22],[10,23],[10,26]];
export function nitDe(owner) {
  if (owner?.nit) return String(owner.nit);
  const ds = Array.isArray(owner?.declaraciones) ? [...owner.declaraciones].reverse() : [];
  const d = ds.find((x) => x?.nit);
  return d ? String(d.nit) : null;
}
/** Vencimiento de persona natural por los dos últimos dígitos del NIT (sin dígito de verificación). */
export function fechaPersonaNatural(nit) {
  const lim = String(nit || "").split("-")[0].replace(/[^0-9]/g, "");
  if (lim.length < 2) return null;
  let d = Number(lim.slice(-2)); if (d === 0) d = 100;
  const [mes, dia] = CAL_PN[Math.ceil(d / 2) - 1];
  return { mes, dia };
}
export function mesesDePago(owner) {
  const jur = owner?.type === "juridica";
  const fijo = Number(owner?.mesDeclaracion) || null;
  if (jur) { const m = fijo || 5; return [{ mes: m, fraccion: 0.5 }, { mes: Math.min(12, m + 2), fraccion: 0.5 }]; }
  const f = fijo ? null : fechaPersonaNatural(nitDe(owner));
  if (f) return [{ mes: f.mes, dia: f.dia, fraccion: 1, auto: true }];
  return [{ mes: fijo || 9, fraccion: 1 }];
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

/**
 * 29-oct-2026 (Santiago: "en la proyección del año siguiente uno no ve el impuesto del 2026,
 * el que se generó"; "debería ser por persona natural y por jurídica").
 * Lo que cada titular paga de UN golpe en el año del simulador por la declaración del año
 * anterior. Fuente: la calibración (Calculadora o declaración real); si el titular no tiene
 * declaración, el motor sobre los ingresos de ese año anterior (detalleRespaldo).
 * Devuelve { titulares: [{name, type, ano, total, saldo, anticipo, fuente, meses}], porMes: [12] }.
 */
export function pagosDeclaracion(owners, cal, detalleRespaldo, anoDeclaracion) {
  const porMes = Array(12).fill(0);
  const titulares = [];
  const nombres = new Set([...(owners || []).map((o) => o.name), ...Object.keys(cal || {})]);
  for (const name of nombres) {
    const o = (owners || []).find((x) => x.name === name) || { name, type: cal?.[name]?.type };
    const c = cal?.[name];
    let total, saldo, anticipo = 0, fuente;
    if (c && c.totalAlDeclarar != null) {
      total = Math.max(0, num(c.totalAlDeclarar)); saldo = c.saldo != null ? num(c.saldo) : total; anticipo = num(c.anticipoSiguiente);
      fuente = c.real ? "real" : "calculadora";
    } else if (c) {
      total = Math.max(0, num(c.renta) - num(c.ret)); saldo = total; fuente = c.real ? "real" : "calculadora";
    } else {
      const d = (detalleRespaldo || []).find((x) => x.name === name);
      if (!d) continue;
      total = Math.max(0, bruto(d) - num(d.reteN)); saldo = total; fuente = "motor";
    }
    const meses = mesesDePago(o);
    for (const m of meses) porMes[m.mes - 1] += total * m.fraccion;
    titulares.push({ name, type: o.type || "natural", ano: c?.anoDeclaracion ?? anoDeclaracion, total, saldo, anticipo, fuente, meses });
  }
  return { titulares, porMes, total: porMes.reduce((a, v) => a + v, 0) };
}
