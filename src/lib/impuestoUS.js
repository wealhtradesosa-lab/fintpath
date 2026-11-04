// ════════════════════════════════════════════════════════════════════════════
// Impuesto estimado de un usuario de EE. UU., con la MISMA forma que
// estimarImpuesto() de Colombia ({ total, mes, detalle[], sinClasificar }).
//
// 3-nov-2026: las pantallas compartidas (Año entrante, Mes a mes, Simulador,
// Dashboard) piden el impuesto a impuestoReferente.js. Cuando la sesión es de
// EE. UU. (region.js) ese módulo responde con esta función en vez del motor DIAN,
// así ninguna pantalla compartida necesita saber de qué país es el usuario.
//
// Qué calcula (año fiscal vigente, tabla única de usStateTax.js):
//   · Federal sobre el ingreso gravable ordinario (deducción estándar del estado civil).
//   · Ganancias de largo plazo y dividendos calificados por sus tramos (0/15/20 %).
//   · Estatal según el estado de residencia (user.taxConfig.state, por defecto TX).
//   · FICA del empleado (7,65 %) sobre salarios y self-employment tax (15,3 % sobre
//     el 92,35 %) sobre ingresos 1099; la mitad del SE tax resta del AGI.
// Retenciones: se asume que el empleador retiene el federal, el estatal y el FICA
// que corresponden a los salarios W-2 (reteN). El resto se paga con los 4 pagos
// estimados (abril, junio, septiembre y enero) — ver mesesDePago en impuestoReferente.
//
// Simplificaciones (documentadas para el usuario en la pantalla de impuestos):
// sin deducciones detalladas, créditos, AMT ni NIIT; los arriendos tributan sobre el
// bruto (sin depreciación ni gastos), lo que da un estimado conservador.
// ════════════════════════════════════════════════════════════════════════════
import { totalAnualItem } from "./flowHelpers.js";
import { federalTax, STANDARD_DEDUCTION, LTCG_BREAKPOINTS, US_LIMITS, calculateStateTax } from "./jurisdictions/usStateTax.js";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Clasifica un ingreso por su tipo de EE. UU. (IncomeModuleUS) o, si viene de
// las pantallas compartidas, por su categoría en español.
export function claseIngresoUS(i) {
  const t = String(i?.tipo || "").toLowerCase();
  if (t === "w2") return "w2";
  if (t === "1099nec" || t === "k1") return "se";
  if (t === "rental") return "renta";
  if (t === "lt_gains" || t === "qual_div") return "ltcg";
  if (t === "st_gains" || t === "ord_div" || t === "interest" || t === "retirement" || t === "other") return "ordinario";
  if (t === "social_sec") return "ss";
  const c = String(i?.categoria || "");
  if (/Salario|W-2|Wages/i.test(c)) return "w2";
  if (/Honorarios|Freelance|1099|Negocio|Business/i.test(c)) return "se";
  if (/Arriendo|Rental|Airbnb/i.test(c)) return "renta";
  if (/Dividend/i.test(c)) return "ltcg";
  if (/Pensi[oó]n|Social Security/i.test(c)) return "ss";
  return "ordinario";
}

/**
 * Impuesto anual de un ingreso total por clases (en dólares).
 * @param {{w2,se,renta,ltcg,ordinario,ss}} b  montos anuales
 */
export function impuestoUSAnual(b, { filingStatus = "single", state = "TX" } = {}) {
  const w2 = n(b.w2), se = n(b.se), renta = n(b.renta), ltcg = n(b.ltcg), ord = n(b.ordinario), ss = n(b.ss);
  const seBase = se * 0.9235;
  const seSS = Math.min(seBase, Math.max(0, US_LIMITS.ssWageBase - w2)) * 0.124;
  const seTax = seSS + seBase * 0.029;
  const ficaW2 = Math.min(w2, US_LIMITS.ssWageBase) * 0.062 + w2 * 0.0145;
  // Seguro Social: tributa como máximo el 85 % (simplificado; sin la fórmula de umbrales).
  const ssGravable = ss * 0.85;
  const agi = w2 + se + renta + ltcg + ord + ssGravable - seTax / 2;
  const ded = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
  const gravable = Math.max(0, agi - ded);
  const gravOrd = Math.max(0, gravable - ltcg);
  const fedOrd = federalTax(gravOrd, filingStatus).tax;
  const bp = LTCG_BREAKPOINTS[filingStatus] || LTCG_BREAKPOINTS.single;
  const piso = gravOrd, techo = gravOrd + Math.min(ltcg, gravable);
  const tramo = (d, h) => Math.max(0, Math.min(techo, h) - Math.max(piso, d));
  const fedLt = tramo(bp.cero, bp.quince) * 0.15 + tramo(bp.quince, Infinity) * 0.2;
  const federal = fedOrd + fedLt;
  const estatal = n(calculateStateTax(gravable, state)?.tax);
  const total = federal + estatal + ficaW2 + seTax;
  // Lo que retiene el empleador: la parte de federal y estatal que corresponde a los
  // salarios (proporcional a su peso en el AGI) + todo el FICA del W-2.
  const pesoW2 = agi > 0 ? w2 / agi : 0;
  const retenido = (federal + estatal) * pesoW2 + ficaW2;
  return { agi, gravable, federal, estatal, fica: ficaW2, seTax, total, retenido, deduccion: ded };
}

/** Misma forma que estimarImpuesto() de taxCO.js, para las pantallas compartidas. */
export function estimarImpuestoUS(u = {}) {
  const trm = n(u.trm) || 1;
  // Moneda base dólares: lo que esté en pesos se convierte con la TRM real.
  const fx = (x) => (String(x?.moneda || "USD").toUpperCase() === "COP" && trm > 1 ? 1 / trm : 1);
  const b = { w2: 0, se: 0, renta: 0, ltcg: 0, ordinario: 0, ss: 0 };
  (u.ingresos || []).filter((i) => i && i.sim !== false).forEach((i) => { b[claseIngresoUS(i)] += totalAnualItem(i) * fx(i); });
  const cfg = u.taxConfig || {};
  const r = impuestoUSAnual(b, { filingStatus: cfg.filingStatus || "single", state: cfg.state || "TX" });
  const ingreso = Object.values(b).reduce((a, v) => a + v, 0);
  const nombre = (u.owners || [])[0]?.name || "Personal";
  const saldo = Math.max(0, r.total - r.retenido);
  const detalle = r.total > 0 ? [{
    name: nombre, type: "natural", ingreso,
    impBruto: r.total, impuestoACargo: r.total, reteN: r.retenido, impuesto: saldo, saldoAPagar: saldo,
    tasaBruta: ingreso > 0 ? (r.total / ingreso) * 100 : 0, fuente: "motor_us",
    us: { federal: r.federal, estatal: r.estatal, fica: r.fica, seTax: r.seTax, agi: r.agi, gravable: r.gravable, deduccion: r.deduccion, estado: cfg.state || "TX", filingStatus: cfg.filingStatus || "single" },
  }] : [];
  // total = lo que sale aparte de la nómina (como en Colombia: impuesto después de retenciones).
  return { total: saldo, mes: saldo / 12, detalle, sinClasificar: 0, us: true, totalConRetenciones: r.total };
}
